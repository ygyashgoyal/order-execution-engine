# ⚡ Order Execution Engine

This project implements a **Market Order Execution Engine** with **DEX routing**, **real-time WebSocket status updates**, **BullMQ queue for concurrent processing**, and **PostgreSQL persistence** using Prisma ORM.

It follows the complete order lifecycle from submission → routing → simulated execution → database storage, as per the assignment specifications.

---

## 🚀 Tech Stack

| Component    | Technology                                    |
| ------------ | --------------------------------------------- |
| Backend      | **Node.js + TypeScript**                      |
| Framework    | **Fastify** (with built-in WebSocket support) |
| Queue System | **BullMQ + Redis**                            |
| Database     | **PostgreSQL + Prisma ORM**                   |
| Testing      | **Jest + Supertest**                          |
| Hosting      | **Railway**                                   |
| API Testing  | **Postman**                                   |

---

## 💡 Why Market Order?

Market Orders are the most fundamental type — they execute immediately at the best available price.  
This order type was chosen for simplicity and speed, demonstrating the engine’s ability to handle **routing, concurrency, and updates in real-time**.

### 🧭 Extending to Other Orders

- **Limit Orders** → Add price condition logic before queue submission.
- **Sniper Orders** → Trigger execution on specific token launches or liquidity events.

---

## ⚙️ System Architecture

```
    ┌────────────────────┐
    │  User / Frontend   │
    └────────┬───────────┘
             │
  POST /api/orders/execute
             │
             ▼
  ┌────────────────────┐
  │ Fastify API Server │
  └────────┬───────────┘
           │
   WebSocket connection (live updates)
           │
           ▼
   ┌──────────────────────┐
   │ BullMQ Order Queue   │
   ├──────────────────────┤
   │ Redis (active orders)│
   └────────┬─────────────┘
            │
     Processed by Worker
            │
            ▼
   ┌──────────────────────┐
   │ Mock DEX Router      │
   │ (Raydium & Meteora)  │
   └────────┬─────────────┘
            │
   Save Results to PostgreSQL
            │
            ▼
   ┌──────────────────────┐
   │ Prisma ORM (Orders)  │
   └──────────────────────┘
```

---

## 🧠 Features

✅ Market Order execution flow  
✅ DEX routing (Raydium vs Meteora mock prices)  
✅ Live WebSocket order lifecycle updates  
✅ BullMQ Queue (up to 10 concurrent workers)  
✅ PostgreSQL persistence  
✅ Automatic retry and failure handling  
✅ 10+ Jest tests for routing, queue & WebSocket lifecycle  
✅ Postman Collection included

---

## 🧰 Installation & Setup

### 1️⃣ Clone Repository

```bash
git clone https://github.com/ygyashgoyal/order-execution-engine.git
cd order-execution-engine
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Setup PostgreSQL + Redis

Make sure both are running locally.

Example PostgreSQL connection:

```
postgresql://postgres:postgres@localhost:5432/order_db?schema=public
```

Example Redis (Docker):

```bash
docker run -d -p 6379:6379 redis
```

### 4️⃣ Create `.env` file

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/order_db?schema=public"
```

### 5️⃣ Initialize Prisma

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 6️⃣ Start Server

```bash
npm run dev
```

> Server runs on `http://localhost:3000`

---

## 🌐 API Endpoints (Used Postman)

### 🔹 Submit Order

**POST** `/api/orders/execute`

```json
{
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amount": 10
}
```

✅ Response:

```json
{
  "orderId": "1234-5678-..."
}
```

---

### 🔹 Track Order (WebSocket)

Connect manually using:

```
ws://localhost:3000/api/orders/execute?orderId=<orderId>
```

✅ Expected Messages:

```
connected
pending
routing
building
submitted
confirmed (or failed)
```

---

## 📦 Order Lifecycle (via WebSocket)

| Status      | Meaning                         |
| ----------- | ------------------------------- |
| `pending`   | Order received and queued       |
| `routing`   | Fetching Raydium/Meteora prices |
| `building`  | Simulating transaction build    |
| `submitted` | Transaction broadcasted         |
| `confirmed` | Transaction confirmed           |
| `failed`    | Error or slippage exceeded      |

---

## 📊 Testing (10 Unit + Integration Tests)

All tests are located inside the tests/
directory.
They cover both unit and integration logic for the Order Execution Engine.

### 🧪 Run All Tests

```
npm test
```

### 📁 Test Structure

```
tests/
├── __mocks__/                 # Mocked dependencies for isolated testing
├── concurrency.test.ts        # Concurrency + parallel execution handling
├── dbFailure.test.ts          # Simulated DB failure scenarios
├── dbSuccess.test.ts          # Successful DB operations
├── dexRouter.test.ts          # DEX Router logic
├── orderAPI.test.ts           # API order validation
├── orderQueue.test.ts         # Queue behavior and sequencing
├── websocketLifecycle.test.ts # WebSocket lifecycle events
├── websocketFailure.test.ts   # WebSocket failure + retry handling
└── setup.ts                   # Jest setup and environment config

```

### ✅ Includes

✅ DEX Router logic  
✅ API order validation  
✅ Queue behavior  
✅ WebSocket lifecycle  
✅ Failure and retry handling  
✅ DB success & failure handling  
✅ Concurrency testing

### 🧰 Notes

Framework: Jest (configured via jest.config.js)  
Mocks: Located in tests/**mocks**/

#### Coverage report:

```
npm run test:coverage
```

---

## 🧪 Postman Setup

Import the included Postman collection:

- `postman_collection.json`
- `postman_environment.json`

Then:

1. Send a POST request to create an order.
2. Copy the `orderId`.
3. Open a **WebSocket tab** in Postman and connect using `ws://localhost:3000/api/orders/execute?orderId=<orderId>`
4. Watch all live updates.

---

## 🧱 Deployment (Optional)

To deploy on **Railway**:

1. Push to GitHub
2. Connect repo to Railway
3. Set environment variables:

   - `DATABASE_URL`
   - `REDIS_URL`

4. Use start command:

   ```bash
   npm run start
   ```

5. Expose port `3000` or `process.env.PORT`

---

## 🎥 Demo Video

📺 **YouTube Demo:** [https://www.youtube.com/watch?v=UVPr_4nMHM8](https://www.youtube.com/watch?v=UVPr_4nMHM8)

This demo shows:

- Order submission via Postman
- WebSocket updates
- DEX routing logs
- Queue handling multiple orders
- Database persistence

---

## 👨‍💻 Author

**Yash Goyal**
[GitHub](https://github.com/ygyashgoyal) • [LinkedIn](https://www.linkedin.com/in/yash-goyal-8642b1253/)

---

## 🏁 Summary

✅ Market Order Engine  
✅ Real-Time WebSocket Updates  
✅ BullMQ Queue & Redis  
✅ PostgreSQL with Prisma  
✅ DEX Routing Simulation  
✅ Tested & Documented
