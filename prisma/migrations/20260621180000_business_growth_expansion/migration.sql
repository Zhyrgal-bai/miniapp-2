-- CreateTable
CREATE TABLE "PlatformStoreListing" (
    "businessId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "tagline" TEXT,
    "logoUrl" TEXT,
    "businessType" "BusinessType" NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredRank" INTEGER,
    "trendScore" INTEGER NOT NULL DEFAULT 0,
    "delistedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformStoreListing_pkey" PRIMARY KEY ("businessId")
);

-- CreateTable
CREATE TABLE "MerchantReferralCode" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "signups" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantReferralSignup" (
    "id" SERIAL NOT NULL,
    "referralCodeId" INTEGER NOT NULL,
    "referrerBusinessId" INTEGER NOT NULL,
    "applicantTelegramId" TEXT NOT NULL,
    "registrationRequestId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantReferralSignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformStoreListing_slug_key" ON "PlatformStoreListing"("slug");

-- CreateIndex
CREATE INDEX "PlatformStoreListing_isPublic_isFeatured_idx" ON "PlatformStoreListing"("isPublic", "isFeatured");

-- CreateIndex
CREATE INDEX "PlatformStoreListing_businessType_isPublic_idx" ON "PlatformStoreListing"("businessType", "isPublic");

-- CreateIndex
CREATE INDEX "PlatformStoreListing_trendScore_idx" ON "PlatformStoreListing"("trendScore");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantReferralCode_businessId_key" ON "MerchantReferralCode"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantReferralCode_code_key" ON "MerchantReferralCode"("code");

-- CreateIndex
CREATE INDEX "MerchantReferralCode_code_idx" ON "MerchantReferralCode"("code");

-- CreateIndex
CREATE INDEX "MerchantReferralSignup_referrerBusinessId_createdAt_idx" ON "MerchantReferralSignup"("referrerBusinessId", "createdAt");

-- CreateIndex
CREATE INDEX "MerchantReferralSignup_applicantTelegramId_idx" ON "MerchantReferralSignup"("applicantTelegramId");

-- AddForeignKey
ALTER TABLE "PlatformStoreListing" ADD CONSTRAINT "PlatformStoreListing_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantReferralCode" ADD CONSTRAINT "MerchantReferralCode_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantReferralSignup" ADD CONSTRAINT "MerchantReferralSignup_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "MerchantReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
