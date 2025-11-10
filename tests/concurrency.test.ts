import Fastify from "fastify";
import websocket from "@fastify/websocket";
import WebSocket from "ws";

describe("Concurrency Test - Multiple Orders", () => {
  let app: ReturnType<typeof Fastify>;
  let port: number;

  const orderStatusMap = new Map<
    string,
    { socket: any; tokenIn: string; tokenOut: string; amount: number }
  >();

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(websocket);

    // Mock WebSocket route
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

        // Simulate real order lifecycle updates (fake but realistic timing)
        const sendStatus = (status: string, delay: number) => {
          setTimeout(() => {
            connection.send(JSON.stringify({ orderId, status }));
            if (status === "confirmed") connection.close();
          }, delay);
        };

        sendStatus("pending", 50);
        sendStatus("routing", 150);
        sendStatus("building", 250);
        sendStatus("submitted", 400);
        sendStatus("confirmed", 600);
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

  it("should handle 5 simultaneous orders and confirm all", async () => {
    const totalOrders = 5;
    const orderIds = Array.from(
      { length: totalOrders },
      (_, i) => `order-${i}`
    );
    const results: Record<string, string[]> = {};

    // preload fake orders
    orderIds.forEach((id) => {
      orderStatusMap.set(id, {
        socket: null,
        tokenIn: "SOL",
        tokenOut: "USDC",
        amount: 10,
      });
      results[id] = [];
    });

    // open 5 WebSockets simultaneously
    await Promise.all(
      orderIds.map(
        (orderId) =>
          new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(
              `ws://localhost:${port}/api/orders/execute?orderId=${orderId}`
            );

            ws.on("message", (data) => {
              const msg = JSON.parse(data.toString());
              results[orderId].push(msg.status);
              if (msg.status === "confirmed") resolve();
            });

            ws.on("error", reject);
          })
      )
    );

    // verify each order received the full lifecycle
    orderIds.forEach((id) => {
      const statuses = results[id];
      expect(statuses).toContain("pending");
      expect(statuses).toContain("routing");
      expect(statuses).toContain("building");
      expect(statuses).toContain("submitted");
      expect(statuses).toContain("confirmed");
    });
  }, 10000); // 10s total timeout
});
