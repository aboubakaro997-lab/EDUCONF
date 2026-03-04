import base64
import hashlib

import bcrypt

from app import auth


def test_create_and_verify_token_pair():
    tokens = auth.create_token_pair({"sub": "1", "email": "user@example.com"})

    assert "access_token" in tokens
    assert "refresh_token" in tokens
    assert tokens["token_type"] == "bearer"

    access_payload = auth.verify_token(tokens["access_token"])
    refresh_payload = auth.verify_refresh_token(tokens["refresh_token"])

    assert access_payload is not None
    assert access_payload.get("sub") == "1"
    assert refresh_payload is not None
    assert refresh_payload.get("sub") == "1"


def test_verify_password_legacy_fallback():
    password = "StrongPass123!"
    digest = hashlib.sha256(password.encode("utf-8")).digest()
    legacy_prepared = base64.b64encode(digest)
    legacy_hash = bcrypt.hashpw(legacy_prepared, bcrypt.gensalt()).decode("utf-8")

    assert auth.verify_password(password, legacy_hash) is True
