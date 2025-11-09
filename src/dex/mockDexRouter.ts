export class MockDexRouter {
  // 🔹 Raydium price simulation
  // 🔹 Raydium price simulation
  async getRaydiumQuote(tokenIn: string, tokenOut: string, amount: number) {
    await this.sleep(300); // Simulate network latency

    // Base price around 100
    const basePrice = 100;
    // Simulate price between 98% and 102%
    const priceFluctuation = basePrice * (0.98 + Math.random() * 0.04);
    // Add mock liquidity impact: larger trades get slightly worse price
    const liquidityImpact = priceFluctuation * (1 - amount * 0.0005);

    return {
      dex: "Raydium",
      price: parseFloat(liquidityImpact.toFixed(4)),
      basePrice,
      tokenIn,
      tokenOut,
    };
  }

  // 🔹 Meteora price simulation
  async getMeteoraQuote(tokenIn: string, tokenOut: string, amount: number) {
    await this.sleep(300);

    // Base price around 100
    const basePrice = 100;
    // Simulate price between 97% and 102%
    const priceFluctuation = basePrice * (0.97 + Math.random() * 0.05);
    // Simulate slightly worse liquidity impact
    const liquidityImpact = priceFluctuation * (1 - amount * 0.0007);

    return {
      dex: "Meteora",
      price: parseFloat(liquidityImpact.toFixed(4)),
      basePrice,
      tokenIn,
      tokenOut,
    };
  }

  // 🔹 Compare and return best DEX quote
  async getBestPrice(tokenIn: string, tokenOut: string, amount: number) {
    const [raydium, meteora] = await Promise.all([
      this.getRaydiumQuote(tokenIn, tokenOut, amount),
      this.getMeteoraQuote(tokenIn, tokenOut, amount),
    ]);

    const best = raydium.price > meteora.price ? raydium : meteora;

    console.log(
      `🔎 Routing Decision → Raydium: ${raydium.price}, Meteora: ${meteora.price} | ✅ Selected: ${best.dex}`
    );

    return best;
  }

  // Utility sleep function
  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
