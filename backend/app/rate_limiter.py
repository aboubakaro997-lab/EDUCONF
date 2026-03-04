import time
import logging
from collections import defaultdict

from fastapi import Request

from .config import settings

try:
    import redis
except Exception:  # pragma: no cover - dépend de l'environnement
    redis = None


logger = logging.getLogger("educonf.rate_limiter")


class InMemoryRateLimiter:
    def __init__(self):
        self._hits = defaultdict(list)

    def check(self, key: str, limit: int, window_seconds: int) -> bool:
        now = time.time()
        window_start = now - window_seconds
        bucket = [ts for ts in self._hits[key] if ts >= window_start]
        self._hits[key] = bucket
        if len(bucket) >= limit:
            return False
        bucket.append(now)
        self._hits[key] = bucket
        return True


class RedisRateLimiter:
    def __init__(self, redis_url: str, prefix: str = "educonf:ratelimit"):
        self._client = redis.Redis.from_url(redis_url, decode_responses=True)
        self._prefix = prefix

    def check(self, key: str, limit: int, window_seconds: int) -> bool:
        redis_key = f"{self._prefix}:{key}"
        current = self._client.incr(redis_key)
        if current == 1:
            self._client.expire(redis_key, window_seconds)
        return current <= limit


class HybridRateLimiter:
    def __init__(self):
        self._memory = InMemoryRateLimiter()
        self._redis = None
        redis_url = (settings.REDIS_URL or "").strip()

        if not redis_url:
            return
        if redis is None:
            logger.warning("REDIS_URL set but redis package is not installed. Falling back to in-memory limiter.")
            return

        try:
            candidate = RedisRateLimiter(
                redis_url=redis_url,
                prefix=settings.RATE_LIMIT_REDIS_PREFIX,
            )
            candidate._client.ping()
            self._redis = candidate
            logger.info("Redis rate limiter enabled")
        except Exception as exc:
            logger.warning("Redis unavailable (%s). Falling back to in-memory limiter.", exc)

    def check(self, key: str, limit: int, window_seconds: int) -> bool:
        if self._redis is not None:
            try:
                return self._redis.check(key, limit, window_seconds)
            except Exception as exc:
                logger.warning("Redis rate limiter error (%s). Using in-memory fallback.", exc)

        return self._memory.check(key, limit, window_seconds)


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


limiter = HybridRateLimiter()
