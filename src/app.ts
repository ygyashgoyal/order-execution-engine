import Fastify from "fastify";
import websocket from "@fastify/websocket";
import orderRoutes from "./routes/order.route";

const app = Fastify();
app.register(websocket);
app.register(orderRoutes);

app.get("/", async () => {
  return { message: "Order Execution Engine Running 🚀" };
});

const start = async () => {
  try {
    await app.listen({ port: 3000 });
    console.log("Server running on http://localhost:3000");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
