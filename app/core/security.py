from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext
import redis

from app.core.config import settings

pwd_context = CryptContext(
    schemes=["bcrypt"],
    bcrypt__rounds=settings.BCRYPT_COST_FACTOR,
    deprecated="auto"
)

_redis_client = None


def _get_redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True
        )
    return _redis_client


def _set_redis_client(client):
    global _redis_client
    _redis_client = client


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: UUID, role: str, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": str(subject),
        "role": role,
        "type": "access",
        "exp": expire
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(subject: UUID, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode = {
        "sub": str(subject),
        "type": "refresh",
        "exp": expire
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def check_login_failure(username: str) -> tuple[bool, int]:
    key = f"login_fail:{username}"
    failures = _get_redis().get(key)
    if failures is None:
        return False, 0
    count = int(failures)
    if count >= settings.LOGIN_MAX_FAILURES:
        return True, count
    return False, count


def increment_login_failure(username: str) -> None:
    key = f"login_fail:{username}"
    pipe = _get_redis().pipeline()
    pipe.incr(key)
    pipe.expire(key, settings.LOGIN_LOCKOUT_MINUTES * 60)
    pipe.execute()


def clear_login_failure(username: str) -> None:
    key = f"login_fail:{username}"
    _get_redis().delete(key)


def init_session_cache(student_id: UUID) -> None:
    key = f"session:{student_id}"
    _get_redis().hset(key, mapping={
        "current_module": "",
        "recent_answers": "[]",
        "cognitive_load": "low",
        "last_interaction_ts": str(int(datetime.utcnow().timestamp()))
    })
    _get_redis().expire(key, 7200)


def clear_session_cache(student_id: UUID) -> None:
    key = f"session:{student_id}"
    _get_redis().delete(key)
