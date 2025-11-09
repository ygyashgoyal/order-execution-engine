import { MockDexRouter } from "../src/dex/mockDexRouter";

const dexRouter = new MockDexRouter();

describe("DEX Router", () => {
  it("should return either Raydium or Meteora as best DEX", async () => {
    const best = await dexRouter.getBestPrice("SOL", "USDC", 10);
    expect(["Raydium", "Meteora"]).toContain(best.dex);
  });
});
