from collections import defaultdict
from threading import Lock

from starlette.websockets import WebSocket

from app.core.config import get_settings


def origin_allowed(websocket: WebSocket) -> bool:
    """Bloqueia Cross-Site WebSocket Hijacking.

    O CORS não se aplica a WebSockets: qualquer site poderia abrir uma conexão
    a partir do navegador da vítima. Navegadores sempre enviam Origin, então
    rejeitamos origens fora da lista. Clientes sem navegador (ex.: wscat) não
    mandam Origin e são aceitos — eles não carregam credenciais de ninguém.
    """
    origin = websocket.headers.get("origin")
    return origin is None or origin in get_settings().cors_origin_list


class ConnectionTracker:
    """Limita conexões simultâneas por IP e informa quantas estão abertas."""

    def __init__(self, max_per_key: int) -> None:
        self.max_per_key = max_per_key
        self._open: dict[str, int] = defaultdict(int)
        self._lock = Lock()

    def acquire(self, key: str) -> bool:
        with self._lock:
            if self._open[key] >= self.max_per_key:
                return False
            self._open[key] += 1
            return True

    def release(self, key: str) -> None:
        with self._lock:
            self._open[key] -= 1
            if self._open[key] <= 0:
                del self._open[key]

    @property
    def total(self) -> int:
        with self._lock:
            return sum(self._open.values())

    def reset(self) -> None:
        with self._lock:
            self._open.clear()


connections = ConnectionTracker(get_settings().ws_max_connections_per_ip)
