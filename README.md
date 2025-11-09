# Order Execution Engine (Market Order + Mock DEX + WebSocket + Queue)

A high-performance backend system that simulates a decentralized exchange (DEX) **Order Execution Engine** with real-time WebSocket updates, price routing between Raydium & Meteora, Redis-backed job queues, PostgreSQL persistence, and fault-tolerant order processing.

---

## ✅ Features Implemented

✔ **Market Order Execution** (chosen order type)  
✔ **Mock DEX routing (Raydium vs Meteora)** with realistic price simulation (+5% to -5%)  
✔ **WebSocket live order status updates**  
✔ **Queue system (BullMQ + Redis)** → supports 10 concurrent orders  
✔ **PostgreSQL + Prisma** for order history (confirmed + failed orders)  
✔ **Retry logic + exponential backoff** (≤3 attempts)  
✔ **Slippage protection & failure handling**  
✔ **Wrapped SOL → wSOL handling (mock)**  
✔ **Fully compliant with assignment requirements**

---

## 🛒 Why Market Order?

I chose **Market Order** because it is:

- The **simplest and most widely used** order type.
- It executes immediately at the best available price.
- It allows me to focus on **core architecture**: routing, queue, WebSocket, persistence.

### 🔄 How to extend to Limit & Sniper Orders:

| Order Type   | How to Extend This Engine                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| Limit Order  | Store target price in DB → continuously check market price → execute when reached.                    |
| Sniper Order | Listen to token launch events on Solana or liquidity pool creation → instantly submit a market order. |

---

## ⚙️ **Architecture Overview**

```text
        ┌────────────┐      ┌──────────────────┐
        │   Client   │─────▶│ POST /execute    │
        └────────────┘      └──────┬───────────┘
                                    │
                     Returns { orderId }
                                    │
        ┌────────────┐      ┌──────▼───────────┐
        │   Client   │─────▶│ WebSocket /execute?orderId=... │
        └────────────┘      └──────┬───────────┘
                                    │
                              status: connected
                                    │
                         (BullMQ + Redis Queue)
                                    │
         ┌──────────────────────────────────────────────────────────┐
         │ Order Worker (10 concurrency)                          │
         │  ✅ pending → routing → building → submitted → confirmed│
         │  ✅ Slippage protection & retry (max 3)                 │
         │  ✅ Fallback to failed + save error to DB              │
         └──────────────────────────────────────────────────────────┘
                                    │
                           ⬇ PostgreSQL (Prisma)
```
