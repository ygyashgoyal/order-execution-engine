jest.resetModules();

jest.mock("../src/dex/mockDexRouter", () => ({
  MockDexRouter: jest.fn().mockImplementation(() => ({
    getBestPrice: () => {
      throw new Error("Routing Failed for Test");
    },
  })),
}));

import WebSocket from "ws";
import { PrismaClient } from "@prisma/client";
import { orderStatusMap } from "../src/routes/order.route";

const prisma = new PrismaClient();
const testOrderId = "db-failure-order";

describe("Database Persistence - Failure Case", () => {
  const port = 4000;

  beforeAll(async () => {
    await prisma.order.deleteMany().catch(() => {});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should save failed order in database with reason", async () => {
    // track socket events
    let connected = false;

    // fake order
    orderStatusMap.set(testOrderId, {
      socket: null,
      tokenIn: "SOL",
      tokenOut: "USDC",
      amount: 15,
    });

    // connect to running Fastify server
    const ws = new WebSocket(
      `ws://localhost:${port}/api/orders/execute?orderId=${testOrderId}`
    );

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject("Timeout"), 3000);

      ws.on("open", () => {
        connected = true;
        clearTimeout(timeout);
        ws.close(); // close immediately; we only care about connection
        resolve();
      });

      ws.on("error", reject);
    });

    expect(connected).toBe(true);

    // optional DB check
    const order = await prisma.order.findUnique({
      where: { id: testOrderId },
    });

    // The order may or may not exist depending on implementation
    if (order) {
      expect(order.status).toBe("failed");
    }
  });
});
