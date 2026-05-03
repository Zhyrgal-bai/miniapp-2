-- Subscription reminder anti-spam (platform cron).
ALTER TABLE "Business" ADD COLUMN "lastReminder3DaysAt" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN "lastReminder1DayAt" TIMESTAMP(3);
