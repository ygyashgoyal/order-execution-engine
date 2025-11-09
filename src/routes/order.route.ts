import { FastifyInstance } from "fastify";
import { orderQueue } from "../queue/orderQueue";
import { v4 as uuidv4 } from "uuid";

// Keep an in-memory map of order state (socket + params)
export const orderStatusMap = new Map<
  string,
  { socket: any; tokenIn: string; tokenOut: string; amount: number }
>();

export const orderRoutes = async (app: FastifyInstance) => {
  // ✅ 1. POST /api/orders/execute — Create order entry
  app.post("/api/orders/execute", async (request, reply) => {
    const { tokenIn, tokenOut, amount } = request.body as any;

    if (!tokenIn || !tokenOut || !amount) {
      return reply.status(400).send({ error: "Missing parameters" });
    }

    const orderId = uuidv4();
    if (process.env.NODE_ENV !== "test") {
      console.log(`✅ Order received: ${orderId}`);
    }

    // Store order temporarily until WebSocket connects
    orderStatusMap.set(orderId, {
      socket: null,
      tokenIn,
      tokenOut,
      amount,
    });

    reply.send({ orderId });
  });

  // ✅ 2. WebSocket /api/orders/execute?orderId=...
  app.get(
    "/api/orders/execute",
    { websocket: true },
    async (connection, request) => {
      const { orderId } = request.query as any;
      const order = orderStatusMap.get(orderId);

      // If invalid orderId, reject connection
      if (!order) {
        connection.send(
          JSON.stringify({ error: "Invalid or missing orderId" })
        );
        return connection.close();
      }

      if (process.env.NODE_ENV !== "test") {
        console.log(`🔌 WebSocket connected for order: ${orderId}`);
      }

      // Attach WebSocket to order
      order.socket = connection;
      orderStatusMap.set(orderId, order);

      // Confirm connection established
      connection.send(
        JSON.stringify({
          orderId,
          status: "connected",
          message: "WebSocket connection established",
        })
      );

      // ✅ Enqueue order job *after* connection ready
      await orderQueue.add(
        "processOrder",
        {
          orderId,
          tokenIn: order.tokenIn,
          tokenOut: order.tokenOut,
          amount: order.amount,
        },
        {
          removeOnComplete: true,
          attempts: 3,
          backoff: { type: "exponential", delay: 500 },
        }
      );

      // 🧹 Handle WebSocket close
      connection.on("close", () => {
        // Disable noisy logs during tests
        if (process.env.NODE_ENV !== "test") {
          console.log(`❌ WebSocket closed for order ${orderId}`);
        }

        const saved = orderStatusMap.get(orderId);
        if (saved) {
          saved.socket = null;
          orderStatusMap.set(orderId, saved);
        }
      });

      // ✅ Extra safety: handle server shutdown gracefully in tests
      connection.on("error", (err: any) => {
        if (process.env.NODE_ENV !== "test") {
          console.error(
            `⚠️ WebSocket error for order ${orderId}:`,
            err.message
          );
        }
      });
    }
  );
};

export default orderRoutes;
