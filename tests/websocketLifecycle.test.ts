// tests/websocketLifecycle.test.ts
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import WebSocket from "ws";

describe("WebSocket Lifecycle (mocked flow)", () => {
  let app: ReturnType<typeof Fastify>;
  let port: number;

  const orderStatusMap = new Map<
    string,
    { socket: any; tokenIn: string; tokenOut: string; amount: number }
  >();

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(websocket);

    // Mock POST route
    app.post(
      "/api/orders/execute",
      async (
        req: { body: any },
        reply: { send: (arg0: { orderId: string }) => any }
      ) => {
        const { tokenIn, tokenOut, amount } = req.body as any;
        const orderId = "fixed-test-order";
        orderStatusMap.set(orderId, {
          socket: null,
          tokenIn,
          tokenOut,
          amount,
        });
        return reply.send({ orderId });
      }
    );

    // Mock WS route
    app.get(
      "/api/orders/execute",
      { websocket: true },
      async (
        connection: { send: (arg0: string) => void; close: () => void },
        request: { query: any }
      ) => {
        const { orderId } = request.query as any;
        const order = orderStatusMap.get(orderId);
        if (!order) {
          connection.send(JSON.stringify({ error: "Invalid orderId" }));
          return connection.close();
        }

        order.socket = connection;
        orderStatusMap.set(orderId, order);

        // Simulate realistic lifecycle
        const statuses = [
          "pending",
          "routing",
          "building",
          "submitted",
          "confirmed",
        ];
        statuses.forEach((status, i) => {
          setTimeout(() => {
            connection.send(JSON.stringify({ orderId, status }));
            if (status === "confirmed") connection.close();
          }, i * 150); // ~150ms between statuses
        });
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

  it("should receive full lifecycle updates", async () => {
    const statuses: string[] = [];

    // Simulate POST (creates order)
    const res = await app.inject({
      method: "POST",
      url: "/api/orders/execute",
      payload: { tokenIn: "SOL", tokenOut: "USDC", amount: 10 },
    });
    expect(res.statusCode).toBe(200);

    // Connect WebSocket
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(
        `ws://localhost:${port}/api/orders/execute?orderId=fixed-test-order`
      );

      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        statuses.push(msg.status);
        if (msg.status === "confirmed") {
          ws.close();
          resolve();
        }
      });

      ws.on("error", reject);
    });

    // Assertions
    expect(statuses).toEqual([
      "pending",
      "routing",
      "building",
      "submitted",
      "confirmed",
    ]);
  }, 5000);
});
