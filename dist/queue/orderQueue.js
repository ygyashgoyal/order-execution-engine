"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderQueue = void 0;
const bullmq_1 = require("bullmq");
const client_1 = require("@prisma/client");
const mockDexRouter_1 = require("../dex/mockDexRouter");
const order_route_1 = require("../routes/order.route");
const connection = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
};
exports.orderQueue = new bullmq_1.Queue("orderQueue", {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 2000, // retry delays in milliseconds
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});
const prisma = new client_1.PrismaClient();
const dexRouter = new mockDexRouter_1.MockDexRouter();
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
// Normalize SOL → wSOL
const normalizeToken = (token) => {
    if (token === "SOL")
        return "wSOL";
    return token;
};
new bullmq_1.Worker("orderQueue", async (job) => {
    const { orderId, tokenIn, tokenOut, amount } = job.data;
    const order = order_route_1.orderStatusMap.get(orderId);
    const ws = order?.socket;
    const send = (status, extra = {}) => {
        if (ws && ws.send) {
            ws.send(JSON.stringify({ orderId, status, ...extra }));
        }
    };
    try {
        // Normalization (SOL → wSOL)
        const tokenInNorm = normalizeToken(tokenIn);
        const tokenOutNorm = normalizeToken(tokenOut);
        if (tokenIn !== tokenInNorm || tokenOut !== tokenOutNorm) {
            console.log(`🔁 Wrapping SOL → wSOL (mock)`);
        }
        // Pending
        send("pending");
        // Routing
        send("routing", { message: "Comparing DEX prices..." });
        const bestDex = await dexRouter.getBestPrice(tokenInNorm, tokenOutNorm, amount);
        send("routing", {
            message: `Best price found on ${bestDex.dex}`,
            price: bestDex.price,
        });
        // Slippage protection mock
        const slippageBps = 50; // 0.5%
        const quotedPrice = bestDex.price;
        const minAcceptable = quotedPrice * (1 - slippageBps / 10000);
        // Simulate actual execution price fluctuating by -0.3% to +0.3%
        const executionPrice = quotedPrice * (1 - 0.003 + Math.random() * 0.006);
        if (executionPrice < minAcceptable) {
            throw new Error(`Slippage exceeded: executionPrice=${executionPrice.toFixed(4)} < minAcceptable=${minAcceptable.toFixed(4)}`);
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
        // Prevent duplicate insert if retry
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
    }
    catch (error) {
        console.error(`Worker error:`, error);
        send("failed", {
            message: "Order failed",
            reason: error.message || String(error),
        });
        // Save failure to DB
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
}, { connection, concurrency: 10 });
