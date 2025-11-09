import Fastify from "fastify";
import websocket from "@fastify/websocket";
import orderRoutes from "./routes/order.route";

const app = Fastify();
app.register(websocket);
app.register(orderRoutes);

// ✅ Export Fastify app for Jest or other modules
export default app;

// ✅ Export helpers to start/stop the server in tests
export async function startServer(port = 4000) {
  await app.listen({ port });
  return app;
}

export async function stopServer() {
  try {
    await app.close();
  } catch (err) {
    console.error("Error closing Fastify:", err);
  }
}

// ✅ Only auto-start if not testing
if (process.env.NODE_ENV !== "test") {
  startServer(3000).then(() => {
    console.log("Server running on http://localhost:3000");
  });
}
