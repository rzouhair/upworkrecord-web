-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "clientInfo" TEXT,
    "tokens" TEXT,
    "codeVerifier" TEXT,
    "oauthState" TEXT,
    "tools" JSONB,
    "connectedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);
