"use client";

import { useEffect, useRef, useState } from "react";
import { PUBLIC_API_URL } from "./api";

export type SocketStatus = "connecting" | "open" | "closed";

export function wsUrl(path: string): string {
  return PUBLIC_API_URL.replace(/^http/, "ws") + path;
}

/**
 * WebSocket com reconexão automática (backoff exponencial até 15s).
 * Devolve o status e uma função para enviar texto.
 */
export function useReconnectingSocket(path: string, onMessage: (data: unknown) => void) {
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const socket = useRef<WebSocket | null>(null);
  const handler = useRef(onMessage);

  useEffect(() => {
    handler.current = onMessage;
  });

  useEffect(() => {
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const connect = () => {
      setStatus("connecting");
      const ws = new WebSocket(wsUrl(path));
      socket.current = ws;
      ws.onopen = () => {
        retry = 0;
        setStatus("open");
      };
      ws.onmessage = (e) => {
        try {
          handler.current(JSON.parse(e.data));
        } catch {
          // mensagem inválida: ignora
        }
      };
      ws.onclose = () => {
        setStatus("closed");
        if (disposed) return;
        timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000));
      };
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      socket.current?.close();
    };
  }, [path]);

  const send = (text: string) => {
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(text);
      return true;
    }
    return false;
  };

  return { status, send };
}
