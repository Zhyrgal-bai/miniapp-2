-- Trial SaaS: один пробный период на Telegram-аккаунт (User), не на каждый магазин.
ALTER TABLE "User" ADD COLUMN "hasUsedTrial" BOOLEAN NOT NULL DEFAULT false;
