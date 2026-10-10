from functools import lru_cache

import redis
import redis.asyncio as aioredis

from app.core.config import get_settings


@lru_cache
def get_sync_redis() -> redis.Redis | None:
    url = get_settings().redis_url
    return redis.Redis.from_url(url, decode_responses=True) if url else None


@lru_cache
def get_async_redis() -> aioredis.Redis | None:
    url = get_settings().redis_url
    return aioredis.Redis.from_url(url, decode_responses=True) if url else None
