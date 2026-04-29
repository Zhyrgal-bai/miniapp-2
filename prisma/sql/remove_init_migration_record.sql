-- One-time recovery: init was marked applied (baseline) but tables were never created.
-- After this, run: npx prisma migrate deploy
DELETE FROM "_prisma_migrations" WHERE migration_name = '20250430120000_init';
