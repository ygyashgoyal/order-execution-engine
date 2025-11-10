"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderRoutes = exports.orderStatusMap = void 0;
const orderQueue_1 = require("../queue/orderQueue");
const uuid_1 = require("uuid");
exports.orderStatusMap = new Map();
const orderRoutes = async (app) => {
    // POST /api/orders/execute — Create order entry
    app.post("/api/orders/execute", async (request, reply) => {
        const { tokenIn, tokenOut, amount } = request.body;
        if (!tokenIn || !tokenOut || !amount) {
            return reply.status(400).send({ error: "Missing parameters" });
        }
        const orderId = (0, uuid_1.v4)();
        if (process.env.NODE_ENV !== "test") {
            console.log(`✅ Order received: ${orderId}`);
        }
        // Store order temporarily until WebSocket connects
        exports.orderStatusMap.set(orderId, {
            socket: null,
            tokenIn,
            tokenOut,
            amount,
        });
        reply.send({ orderId });
    });
    // WebSocket /api/orders/execute?orderId=...
    app.get("/api/orders/execute", { websocket: true }, async (connection, request) => {
        const { orderId } = request.query;
        const order = exports.orderStatusMap.get(orderId);
        // If invalid orderId, reject connection
        if (!order) {
            connection.send(JSON.stringify({ error: "Invalid or missing orderId" }));
            return connection.close();
        }
        if (process.env.NODE_ENV !== "test") {
            console.log(`🔌 WebSocket connected for order: ${orderId}`);
        }
        // Attach WebSocket to order
        order.socket = connection;
        exports.orderStatusMap.set(orderId, order);
        // Confirm connection established
        connection.send(JSON.stringify({
            orderId,
            status: "connected",
            message: "WebSocket connection established",
        }));
        // Enqueue order job *after* connection ready
        await orderQueue_1.orderQueue.add("processOrder", {
            orderId,
            tokenIn: order.tokenIn,
            tokenOut: order.tokenOut,
            amount: order.amount,
        }, {
            removeOnComplete: true,
            attempts: 3,
            backoff: { type: "exponential", delay: 500 },
        });
        // Handle WebSocket close
        connection.on("close", () => {
            // Disable noisy logs during tests
            if (process.env.NODE_ENV !== "test") {
                console.log(`WebSocket closed for order ${orderId}`);
            }
            const saved = exports.orderStatusMap.get(orderId);
            if (saved) {
                saved.socket = null;
                exports.orderStatusMap.set(orderId, saved);
            }
        });
        connection.on("error", (err) => {
            if (process.env.NODE_ENV !== "test") {
                console.error(`WebSocket error for order ${orderId}:`, err.message);
            }
        });
    });
};
exports.orderRoutes = orderRoutes;
exports.default = exports.orderRoutes;
