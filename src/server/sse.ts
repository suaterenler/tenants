import "server-only";

export type Emit = (event: string, data: unknown) => void;

const HEARTBEAT_MS = 20_000;

export function eventStream(request: Request, open: (emit: Emit) => () => void, headers: Record<string, string> = {}): Response {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    cleanup?.();
    cleanup = null;
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit: Emit = (event, data) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          stop();
        }
      };
      controller.enqueue(encoder.encode(": open\n\n"));
      cleanup = open(emit);
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          stop();
        }
      }, HEARTBEAT_MS);
      request.signal.addEventListener("abort", () => {
        stop();
        try {
          controller.close();
        } catch {
          return;
        }
      });
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...headers,
    },
  });
}
