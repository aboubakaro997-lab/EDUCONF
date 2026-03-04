from app.rate_limiter import InMemoryRateLimiter


def test_inmemory_rate_limiter_blocks_after_limit():
    limiter = InMemoryRateLimiter()
    key = "login:127.0.0.1"

    assert limiter.check(key, limit=2, window_seconds=60) is True
    assert limiter.check(key, limit=2, window_seconds=60) is True
    assert limiter.check(key, limit=2, window_seconds=60) is False
