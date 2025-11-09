// tests/websocketFailure.test.ts
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import WebSocket from "ws";

describe("WebSocket Failure Case", () => {
  let app: ReturnType<typeof Fastify>;
  let port: number;
  const orderId = "fail-test";

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(websocket);

    // Minimal WebSocket route that simulates an immediate failure
    app.get(
      "/api/orders/execute",
      { websocket: true },
      async (
        connection: { send: (arg0: string) => void; close: () => void },
        request: { query: any }
      ) => {
        const { orderId } = request.query as any;

        // Send a "failed" message after a short delay
        setTimeout(() => {
          connection.send(
            JSON.stringify({
              orderId,
              status: "failed",
              reason: "Simulated Error",
            })
          );
          connection.close();
        }, 100);
      }
    );

    await app.listen({ port: 0 });
    const addr = app.server.address() as any;
    port = typeof addr === "object" && addr ? addr.port : 3000;
  });

  afterAll(async () => {
    try {
      await app.close();
    } catch {}
  });

  it("should receive a 'failed' status message", async () => {
    const statuses: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(
        `ws://localhost:${port}/api/orders/execute?orderId=${orderId}`
      );

      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

      ws.on("message", (msg) => {
        const data = JSON.parse(msg.toString());
        statuses.push(data.status);
        if (data.status === "failed") {
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      });

      ws.on("error", reject);
    });

    expect(statuses).toContain("failed");
  }, 7000);
});
