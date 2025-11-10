import request from "supertest";

// we only need the running server
const baseURL = "http://localhost:4000";

describe("Order API", () => {
  it("should return orderId when valid request", async () => {
    const response = await request(baseURL)
      .post("/api/orders/execute")
      .send({ tokenIn: "SOL", tokenOut: "USDC", amount: 10 });

    expect(response.statusCode).toBe(200);
    expect(response.body.orderId).toBeDefined();
  });

  it("should return 400 if missing parameters", async () => {
    const response = await request(baseURL)
      .post("/api/orders/execute")
      .send({ tokenIn: "SOL" });

    expect(response.statusCode).toBe(400);
  });
});
