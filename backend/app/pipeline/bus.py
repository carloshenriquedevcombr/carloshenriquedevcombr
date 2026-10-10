"""Pipeline Extract → Transform → Load + detecção, com broadcast para WebSockets.

Fica em memória, por processo: com várias réplicas cada uma mostraria o
próprio tráfego (os contadores, esses sim, vão para o Redis).
"""

import asyncio
import contextlib
import logging
from collections import deque

from app.core.metrics import metrics
from app.pipeline.detection import Detector
from app.pipeline.events import Alert, LabEvent

logger = logging.getLogger("lab.pipeline")

RECENT_EVENTS = 30
RECENT_ALERTS = 10


class PipelineBus:
    def __init__(self) -> None:
        self.detector = Detector()
        self.recent_events: deque[dict] = deque(maxlen=RECENT_EVENTS)
        self.recent_alerts: deque[dict] = deque(maxlen=RECENT_ALERTS)
        self._subscribers: set[asyncio.Queue] = set()
        self.loop: asyncio.AbstractEventLoop | None = None
        self._tasks: set[asyncio.Task] = set()

    def bind(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop

    def submit(self, event: LabEvent) -> None:
        """Envia um evento para a pipeline a partir de qualquer contexto (sync ou async)."""
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is not None:
            task = running.create_task(self.ingest(event))
            # Guarda a referência: tarefas soltas podem ser coletadas pelo GC
            self._tasks.add(task)
            task.add_done_callback(self._tasks.discard)
        elif self.loop is not None and self.loop.is_running():
            asyncio.run_coroutine_threadsafe(self.ingest(event), self.loop)

    async def ingest(self, event: LabEvent) -> list[Alert]:
        # Extract: o evento chegou. Transform: classificação pelas regras. Load: agregação.
        try:
            alerts = self.detector.analyze(event)
            malicious = bool(alerts)
            await metrics.incr("pipeline_extracted")
            await metrics.incr("pipeline_transformed")
            await metrics.incr("pipeline_blocked" if malicious else "pipeline_loaded")
            if alerts:
                await metrics.incr("pipeline_alerts", len(alerts))
        except Exception:  # noqa: BLE001 — a pipeline nunca derruba quem emitiu o evento
            logger.exception("falha ao processar evento da pipeline")
            return []

        public = event.public(malicious)
        self.recent_events.append(public)
        self._broadcast({"type": "event", "event": public})
        for alert in alerts:
            data = alert.public()
            self.recent_alerts.append(data)
            self._broadcast({"type": "alert", "alert": data})
        return alerts

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)

    def _broadcast(self, message: dict) -> None:
        for queue in self._subscribers:
            # Cliente lento perde mensagens em vez de travar a pipeline
            with contextlib.suppress(asyncio.QueueFull):
                queue.put_nowait(message)

    def reset(self) -> None:
        self.detector.reset()
        self.recent_events.clear()
        self.recent_alerts.clear()


bus = PipelineBus()
