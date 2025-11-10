"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockDexRouter = void 0;
class MockDexRouter {
    constructor() {
        this.isTest = process.env.NODE_ENV === "test";
    }
    // Raydium price simulation
    async getRaydiumQuote(tokenIn, tokenOut, amount) {
        await this.sleep(300); // Simulate network latency (no-op in tests)
        const basePrice = 100;
        const priceFluctuation = basePrice * (0.98 + Math.random() * 0.04);
        const liquidityImpact = priceFluctuation * (1 - amount * 0.0005);
        return {
            dex: "Raydium",
            price: parseFloat(liquidityImpact.toFixed(4)),
            basePrice,
            tokenIn,
            tokenOut,
        };
    }
    // Meteora price simulation
    async getMeteoraQuote(tokenIn, tokenOut, amount) {
        await this.sleep(300);
        const basePrice = 100;
        const priceFluctuation = basePrice * (0.97 + Math.random() * 0.05);
        const liquidityImpact = priceFluctuation * (1 - amount * 0.0007);
        return {
            dex: "Meteora",
            price: parseFloat(liquidityImpact.toFixed(4)),
            basePrice,
            tokenIn,
            tokenOut,
        };
    }
    // Compare and return best DEX quote
    async getBestPrice(tokenIn, tokenOut, amount) {
        const [raydium, meteora] = await Promise.all([
            this.getRaydiumQuote(tokenIn, tokenOut, amount),
            this.getMeteoraQuote(tokenIn, tokenOut, amount),
        ]);
        const best = raydium.price > meteora.price ? raydium : meteora;
        if (!this.isTest) {
            console.log(`🔎 Routing Decision → Raydium: ${raydium.price}, Meteora: ${meteora.price} | ✅ Selected: ${best.dex}`);
        }
        return best;
    }
    // Utility sleep function (skips delay in test mode)
    sleep(ms) {
        if (this.isTest)
            return Promise.resolve();
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.MockDexRouter = MockDexRouter;
