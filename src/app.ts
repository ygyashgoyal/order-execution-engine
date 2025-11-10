import Fastify from "fastify";
import websocket from "@fastify/websocket";
import orderRoutes from "./routes/order.route";

const app = Fastify({
  logger: false,
});

app.register(websocket);
app.register(orderRoutes);

// Root route for Railway/healthcheck
app.get("/", async () => {
  return { message: "Order Execution Engine Running 🚀" };
});

// Export app for Jest or other tests
export default app;

// Start server function
export async function startServer(port = 4000) {
  await app.listen({
    port,
    host: "0.0.0.0", // Required for Railway/Render deployment
  });
  return app;
}

// Stop server function (for tests)
export async function stopServer() {
  try {
    await app.close();
  } catch (err) {
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
