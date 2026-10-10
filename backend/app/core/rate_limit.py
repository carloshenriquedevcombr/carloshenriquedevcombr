import time
import uuid
from collections import defaultdict, deque
from threading import Lock
from typing import Protocol

import redis


class RateLimiter(Protocol):
    def allow(self, key: str) -> bool: ...

    def reset(self) -> None: ...


class SlidingWindowRateLimiter:
    """Rate limiter em memória (janela deslizante), para uma única instância da API."""

    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


class RedisRateLimiter:
    """Janela deslizante em Redis (sorted set por chave): vale para várias réplicas."""

    def __init__(
        self, client: redis.Redis, limit: int, window_seconds: int, prefix: str = "rl"
    ) -> None:
        self.client = client
        self.limit = limit
        self.window = window_seconds
        self.prefix = prefix

    def allow(self, key: str) -> bool:
        redis_key = f"{self.prefix}:{key}"
        now = time.time()
        member = uuid.uuid4().hex
        # Registra e conta na mesma transação (MULTI/EXEC) para não haver corrida
        # entre réplicas; se estourou o limite, desfaz o registro.
        pipe = self.client.pipeline(transaction=True)
        pipe.zremrangebyscore(redis_key, 0, now - self.window)
        pipe.zadd(redis_key, {member: now})
        pipe.zcard(redis_key)
        pipe.expire(redis_key, self.window)
        _, _, count, _ = pipe.execute()
        if count > self.limit:
            self.client.zrem(redis_key, member)
            return False
        return True

    def reset(self) -> None:
        for key in self.client.scan_iter(f"{self.prefix}:*"):
            self.client.delete(key)


def build_rate_limiter(
    client: redis.Redis | None, limit: int, window_seconds: int, prefix: str
) -> RateLimiter:
    if client is None:
        return SlidingWindowRateLimiter(limit, window_seconds)
    return RedisRateLimiter(client, limit, window_seconds, prefix)
