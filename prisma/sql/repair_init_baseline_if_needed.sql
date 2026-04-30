-- "Bad baseline" only when init was marked applied but NO app tables were ever created.
-- If "User" (or "Business") already exists, do nothing — re-applying init would hit 42P07.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = '_prisma_migrations' AND c.relkind IN ('r', 'p')
  ) THEN
    DELETE FROM public."_prisma_migrations"
    WHERE migration_name = '20250430120000_init'
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c2
        JOIN pg_catalog.pg_namespace n2 ON n2.oid = c2.relnamespace
        WHERE n2.nspname = 'public' AND c2.relname = 'Business' AND c2.relkind IN ('r', 'p')
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c3
        JOIN pg_catalog.pg_namespace n3 ON n3.oid = c3.relnamespace
        WHERE n3.nspname = 'public' AND c3.relname = 'User' AND c3.relkind IN ('r', 'p')
      );
  END IF;
END $$;
