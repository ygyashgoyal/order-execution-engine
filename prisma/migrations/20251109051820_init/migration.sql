-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "tokenIn" TEXT NOT NULL,
    "tokenOut" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "executedOn" TEXT,
    "price" DOUBLE PRECISION,
    "txHash" TEXT,
    "failedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);
