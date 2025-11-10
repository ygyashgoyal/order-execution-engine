import Fastify from "fastify";
import websocket from "@fastify/websocket";
import WebSocket from "ws";
import request from "supertest";
import { v4 as uuidv4 } from "uuid";

// Mocked queue
const mockAdd = jest.fn().mockResolvedValue({ id: "mock-job-id" });

describe("Queue Behavior (WS triggers queue.add)", () => {
  let app: ReturnType<typeof Fastify>;
  let port: number;

  // in-memory store
  const orderStatusMap = new Map<
    string,
    { socket: any; tokenIn: string; tokenOut: string; amount: number }
  >();

  beforeAll(async () => {
    app = Fastify({ logger: false }); // quiet server
    await app.register(websocket);

    // POST route
    app.post(
      "/api/orders/execute",
      async (
        request: { body: any },
        reply: {
          status: (arg0: number) => {
            (): any;
            new (): any;
            send: { (arg0: { error: string }): any; new (): any };
          };
          send: (arg0: { orderId: string }) => any;
        }
      ) => {
        const { tokenIn, tokenOut, amount } = request.body as any;
        if (!tokenIn || !tokenOut || !amount) {
          return reply.status(400).send({ error: "Missing parameters" });
        }
        const orderId = uuidv4();
        orderStatusMap.set(orderId, {
          socket: null,
          tokenIn,
          tokenOut,
          amount,
        });
        return reply.send({ orderId });
      }
    );

    // WS route
    app.get(
      "/api/orders/execute",
      { websocket: true },
      async (
        connection: { send: (arg0: string) => void; close: () => void },
        request: { query: any }
      ) => {
        try {
          const { orderId } = request.query as any;
          const order = orderStatusMap.get(orderId);
          if (!order) {
            connection.send(
              JSON.stringify({ error: "Invalid or missing orderId" })
            );
            return connection.close();
          }

          order.socket = connection;
          orderStatusMap.set(orderId, order);
          connection.send(JSON.stringify({ orderId, status: "connected" }));

          await mockAdd(
            "processOrder",
            {
              orderId,
              tokenIn: order.tokenIn,
              tokenOut: order.tokenOut,
              amount: order.amount,
            },
            { removeOnComplete: true }
          );

          connection.close();
        } catch (err: any) {
          connection.send(JSON.stringify({ error: err.message }));
          connection.close();
        }
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

  it("should add an order to the mocked queue when WS connects", async () => {
    const res = await request(`http://localhost:${port}`)
      .post("/api/orders/execute")
      .send({ tokenIn: "SOL", tokenOut: "USDC", amount: 5 });

    expect(res.statusCode).toBe(200);
    const orderId = res.body.orderId;
    expect(orderId).toBeDefined();

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(
        `ws://localhost:${port}/api/orders/execute?orderId=${orderId}`
      );
      ws.on("open", () => resolve());
      ws.on("error", reject);
    });

    // confirm mocked queue called
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith(
      "processOrder",
      expect.objectContaining({
        orderId,
        tokenIn: "SOL",
        tokenOut: "USDC",
        amount: 5,
      }),
      expect.any(Object)
    );
  });
});
