-- CreateTable
CREATE TABLE "ShopBilling" (
    "shop" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopBilling_pkey" PRIMARY KEY ("shop")
);
