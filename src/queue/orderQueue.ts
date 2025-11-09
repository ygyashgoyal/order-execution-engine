import { Queue, Worker, JobsOptions } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { MockDexRouter } from "../dex/mockDexRouter";
import { orderStatusMap } from "../routes/order.route";

const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

export const orderQueue = new Queue("orderQueue", {
  connection,
  // ✅ Add retry behaviour here
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000, // 2s, 4s, 8s retry delays
    },
    removeOnComplete: true,
    removeOnFail: false,
  } as JobsOptions,
});

const prisma = new PrismaClient();
const dexRouter = new MockDexRouter();
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// ✅ Utility: Normalize SOL → wSOL (mock)
const normalizeToken = (token: string) => {
  if (token === "SOL") return "wSOL";
  return token;
};

new Worker(
  "orderQueue",
  async (job) => {
    const { orderId, tokenIn, tokenOut, amount } = job.data;
    const order = orderStatusMap.get(orderId);
    const ws = order?.socket;

    const send = (status: string, extra: any = {}) => {
      if (ws && ws.send) {
        ws.send(JSON.stringify({ orderId, status, ...extra }));
      }
    };

    try {
      // ✅ 0. Normalization (SOL → wSOL)
      const tokenInNorm = normalizeToken(tokenIn);
      const tokenOutNorm = normalizeToken(tokenOut);
      if (tokenIn !== tokenInNorm || tokenOut !== tokenOutNorm) {
        console.log(`🔁 Wrapping SOL → wSOL (mock)`);
      }

      // 1. Pending
      send("pending");

      // 2. Routing
      send("routing", { message: "Comparing DEX prices..." });
      const bestDex = await dexRouter.getBestPrice(
        tokenInNorm,
        tokenOutNorm,
        amount
      );

      send("routing", {
        message: `Best price found on ${bestDex.dex}`,
        price: bestDex.price,
      });

      // ✅ 3. Slippage protection mock
      const slippageBps = 50; // 0.5%
      const quotedPrice = bestDex.price;
      const minAcceptable = quotedPrice * (1 - slippageBps / 10000);

      // Simulate actual execution price fluctuating by -0.3% to +0.3%
      const executionPrice = quotedPrice * (1 - 0.003 + Math.random() * 0.006);

      if (executionPrice < minAcceptable) {
        throw new Error(
          `Slippage exceeded: executionPrice=${executionPrice.toFixed(
            4
          )} < minAcceptable=${minAcceptable.toFixed(4)}`
        );
      }

      // 4. Building transaction
      send("building", { message: "Building transaction..." });
      await delay(1000);

      // 5. Submitted
      const txHash = `tx-${Math.random().toString(36).substr(2, 9)}`;
      send("submitted", { txHash });

      await delay(1000);

      // 6. Confirmed
      send("confirmed", {
        message: "Transaction confirmed",
        executedOn: bestDex.dex,
        price: executionPrice,
      });

      // ✅ Prevent duplicate insert if retry
      await prisma.order.upsert({
        where: { id: orderId },
        update: {
          status: "confirmed",
          executedOn: bestDex.dex,
          price: executionPrice,
          txHash: txHash,
        },
        create: {
          id: orderId,
          tokenIn,
          tokenOut,
          amount,
          status: "confirmed",
          executedOn: bestDex.dex,
          price: executionPrice,
          txHash: txHash,
        },
      });
    } catch (error: any) {
      console.error(`❌ Worker error:`, error);

      send("failed", {
        message: "Order failed",
        reason: error.message || String(error),
      });

      // ✅ Save failure to DB (upsert so retries don't cause duplication)
      await prisma.order.upsert({
        where: { id: orderId },
        update: {
          status: "failed",
          failedReason: String(error),
        },
        create: {
          id: orderId,
          tokenIn,
          tokenOut,
          amount,
          status: "failed",
          failedReason: String(error),
        },
      });

      // Re-throw error → BullMQ will retry if attempts remain
      throw error;
    }
  },
  { connection, concurrency: 10 }
);
