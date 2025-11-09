import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { orderQueue } from "../queue/orderQueue";

export const orderStatusMap = new Map<
  string,
  { socket: any; tokenIn: string; tokenOut: string; amount: number }
>();

const orderRoutes = async (app: FastifyInstance) => {
  // ✅ 1. POST request — Create order, return orderId (but DO NOT enqueue yet)
  app.post("/api/orders/execute", async (request, reply) => {
    const { tokenIn, tokenOut, amount } = request.body as any;

    if (!tokenIn || !tokenOut || !amount) {
      return reply.status(400).send({ error: "Missing parameters" });
    }

    const orderId = uuidv4();
    console.log(`✅ Order received: ${orderId}`);

    // Temporarily store the data until the WebSocket connects
    orderStatusMap.set(orderId, {
      socket: null,
      tokenIn,
      tokenOut,
      amount,
    });

    reply.send({ orderId });
  });

  // ✅ 2. WebSocket — Client connects using same endpoint with query orderId
  app.get(
    "/api/orders/execute",
    { websocket: true },
    async (connection, request) => {
      const orderId = (request.query as any).orderId;
      const order = orderStatusMap.get(orderId);

      if (!order) {
        connection.send(
          JSON.stringify({ error: "Invalid or missing orderId" })
        );
        return connection.close();
      }

      console.log(`🔌 WebSocket connected for order: ${orderId}`);

      // Attach WebSocket connection to saved order
      order.socket = connection;
      orderStatusMap.set(orderId, order);

      // Send confirmation of WebSocket connection
      connection.send(
        JSON.stringify({
          orderId,
          status: "connected",
          message: "WebSocket connection established",
        })
      );

      // ✅ Once WebSocket is ready → Add job to BullMQ queue
      await orderQueue.add("processOrder", {
        orderId,
        tokenIn: order.tokenIn,
        tokenOut: order.tokenOut,
        amount: order.amount,
      });

      // 🛑 Optional cleanup: Remove socket reference if client disconnects
      connection.on("close", () => {
        console.log(`❌ WebSocket closed for order ${orderId}`);
        const saved = orderStatusMap.get(orderId);
        if (saved) {
          saved.socket = null;
          orderStatusMap.set(orderId, saved);
        }
      });
    }
  );
};

export default orderRoutes;
