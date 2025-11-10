import { Queue, Worker, JobsOptions } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { MockDexRouter } from "../dex/mockDexRouter";
import { orderStatusMap } from "../routes/order.route";

const prisma = new PrismaClient();
const dexRouter = new MockDexRouter();
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const isMockMode = process.env.NODE_ENV === "production"; // 🚀 Render will use this
let orderQueue: any;

console.log(
  isMockMode ? "⚙️ Running in MOCK mode (no Redis)" : "🔗 Using Redis queue"
);

// ✅ Reusable function for order execution (shared between both modes)
async function processOrder(data: any) {
  const { orderId, tokenIn, tokenOut, amount } = data;
  const order = orderStatusMap.get(orderId);
  const ws = order?.socket;

  const send = (status: string, extra: any = {}) => {
    if (ws && ws.send) {
      ws.send(JSON.stringify({ orderId, status, ...extra }));
    }
  };

  const normalizeToken = (token: string) => (token === "SOL" ? "wSOL" : token);

  try {
    const tokenInNorm = normalizeToken(tokenIn);
    const tokenOutNorm = normalizeToken(tokenOut);
    if (tokenIn !== tokenInNorm || tokenOut !== tokenOutNorm) {
      console.log(`🔁 Wrapping SOL → wSOL (mock)`);
    }

    // Pending
    send("pending");

    // Routing
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

    // Slippage protection (mock)
    const slippageBps = 50;
    const quotedPrice = bestDex.price;
    const minAcceptable = quotedPrice * (1 - slippageBps / 10000);
    const executionPrice = quotedPrice * (1 - 0.003 + Math.random() * 0.006);

    if (executionPrice < minAcceptable) {
      throw new Error(
        `Slippage exceeded: executionPrice=${executionPrice.toFixed(
          4
        )} < minAcceptable=${minAcceptable.toFixed(4)}`
      );
    }

    // Building transaction
    send("building", { message: "Building transaction..." });
    await delay(1000);

    // Submitted
    const txHash = `tx-${Math.random().toString(36).substr(2, 9)}`;
    send("submitted", { txHash });

    await delay(1000);

    // Confirmed
    send("confirmed", {
      message: "Transaction confirmed",
      executedOn: bestDex.dex,
      price: executionPrice,
    });

    await prisma.order.upsert({
      where: { id: orderId },
      update: {
        status: "confirmed",
        executedOn: bestDex.dex,
        price: executionPrice,
        txHash,
      },
      create: {
        id: orderId,
        tokenIn,
        tokenOut,
        amount,
        status: "confirmed",
        executedOn: bestDex.dex,
        price: executionPrice,
        txHash,
      },
    });
  } catch (error: any) {
    console.error("Worker error:", error);
    send("failed", {
      message: "Order failed",
      reason: error.message || String(error),
    });

    await prisma.order.upsert({
      where: { id: orderId },
      update: { status: "failed", failedReason: String(error) },
      create: {
        id: orderId,
        tokenIn,
        tokenOut,
        amount,
        status: "failed",
        failedReason: String(error),
      },
    });
  }
}

// Local mode → use Redis + BullMQ
if (!isMockMode) {
  const connection = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  };

  orderQueue = new Queue("orderQueue", {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    } as JobsOptions,
  });

  new Worker("orderQueue", async (job) => await processOrder(job.data), {
    connection,
    concurrency: 10,
  });
} else {
  // Render (mock mode) → execute immediately, no Redis
  orderQueue = {
    add: async (_jobName: string, data: any) => {
      await processOrder(data);
    },
  };
}

export { orderQueue };

// import { Queue, Worker, JobsOptions } from "bullmq";
// import { PrismaClient } from "@prisma/client";
// import { MockDexRouter } from "../dex/mockDexRouter";
// import { orderStatusMap } from "../routes/order.route";

// const connection = {
//   host: process.env.REDIS_HOST || "127.0.0.1",
//   port: Number(process.env.REDIS_PORT) || 6379,
//   password: process.env.REDIS_PASSWORD || undefined,
// };

// export const orderQueue = new Queue("orderQueue", {
//   connection,
//   defaultJobOptions: {
//     attempts: 3,
//     backoff: {
//       type: "exponential",
//       delay: 2000, // retry delays in milliseconds
//     },
//     removeOnComplete: true,
//     removeOnFail: false,
//   } as JobsOptions,
// });

// const prisma = new PrismaClient();
// const dexRouter = new MockDexRouter();
// const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// // Normalize SOL → wSOL
// const normalizeToken = (token: string) => {
//   if (token === "SOL") return "wSOL";
//   return token;
// };

// new Worker(
//   "orderQueue",
//   async (job) => {
//     const { orderId, tokenIn, tokenOut, amount } = job.data;
//     const order = orderStatusMap.get(orderId);
//     const ws = order?.socket;

//     const send = (status: string, extra: any = {}) => {
//       if (ws && ws.send) {
//         ws.send(JSON.stringify({ orderId, status, ...extra }));
//       }
//     };

//     try {
//       // Normalization (SOL → wSOL)
//       const tokenInNorm = normalizeToken(tokenIn);
//       const tokenOutNorm = normalizeToken(tokenOut);
//       if (tokenIn !== tokenInNorm || tokenOut !== tokenOutNorm) {
//         console.log(`🔁 Wrapping SOL → wSOL (mock)`);
//       }

//       // Pending
//       send("pending");

//       // Routing
//       send("routing", { message: "Comparing DEX prices..." });
//       const bestDex = await dexRouter.getBestPrice(
//         tokenInNorm,
//         tokenOutNorm,
//         amount
//       );

//       send("routing", {
//         message: `Best price found on ${bestDex.dex}`,
//         price: bestDex.price,
//       });

//       // Slippage protection mock
//       const slippageBps = 50; // 0.5%
//       const quotedPrice = bestDex.price;
//       const minAcceptable = quotedPrice * (1 - slippageBps / 10000);

//       // Simulate actual execution price fluctuating by -0.3% to +0.3%
//       const executionPrice = quotedPrice * (1 - 0.003 + Math.random() * 0.006);

//       if (executionPrice < minAcceptable) {
//         throw new Error(
//           `Slippage exceeded: executionPrice=${executionPrice.toFixed(
//             4
//           )} < minAcceptable=${minAcceptable.toFixed(4)}`
//         );
//       }

//       // Building transaction
//       send("building", { message: "Building transaction..." });
//       await delay(1000);

//       // Submitted
//       const txHash = `tx-${Math.random().toString(36).substr(2, 9)}`;
//       send("submitted", { txHash });

//       await delay(1000);

//       // Confirmed
//       send("confirmed", {
//         message: "Transaction confirmed",
//         executedOn: bestDex.dex,
//         price: executionPrice,
//       });

//       // Prevent duplicate insert if retry
//       await prisma.order.upsert({
//         where: { id: orderId },
//         update: {
//           status: "confirmed",
//           executedOn: bestDex.dex,
//           price: executionPrice,
//           txHash: txHash,
//         },
//         create: {
//           id: orderId,
//           tokenIn,
//           tokenOut,
//           amount,
//           status: "confirmed",
//           executedOn: bestDex.dex,
//           price: executionPrice,
//           txHash: txHash,
//         },
//       });
//     } catch (error: any) {
//       console.error(`Worker error:`, error);

//       send("failed", {
//         message: "Order failed",
//         reason: error.message || String(error),
//       });

//       // Save failure to DB
//       await prisma.order.upsert({
//         where: { id: orderId },
//         update: {
//           status: "failed",
//           failedReason: String(error),
//         },
//         create: {
//           id: orderId,
//           tokenIn,
//           tokenOut,
//           amount,
//           status: "failed",
//           failedReason: String(error),
//         },
//       });

//       // Re-throw error → BullMQ will retry if attempts remain
//       throw error;
//     }
//   },
//   { connection, concurrency: 10 }
// );
