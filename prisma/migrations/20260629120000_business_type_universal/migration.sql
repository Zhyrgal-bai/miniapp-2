-- Universal commerce template: flexible catalog for any business vertical.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'BusinessType' AND e.enumlabel = 'universal'
  ) THEN
    ALTER TYPE "BusinessType" ADD VALUE 'universal';
  END IF;
END$$;
