"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
exports.stopServer = stopServer;
const fastify_1 = __importDefault(require("fastify"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const order_route_1 = __importDefault(require("./routes/order.route"));
const app = (0, fastify_1.default)({
    logger: false,
});
app.register(websocket_1.default);
app.register(order_route_1.default);
app.get("/", async () => {
    return { message: "Order Execution Engine Running 🚀" };
});
exports.default = app;
// Start server function
async function startServer(port = 4000) {
    await app.listen({
        port,
        host: "0.0.0.0",
    });
    return app;
}
// Stop server function (for tests)
async function stopServer() {
    try {
        await app.close();
    }
    catch (err) {
        console.error("Error closing Fastify:", err);
    }
}
// If NOT in test mode, start automatically
if (process.env.NODE_ENV !== "test") {
    const port = Number(process.env.PORT) || 3000;
    startServer(port).then(() => {
        console.log(`🚀 Server running on port ${port}`);
    });
}
