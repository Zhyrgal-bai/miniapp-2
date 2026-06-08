-- Phase 12: target business templates (electronics/autoparts/cosmetics/furniture).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'BusinessType' AND e.enumlabel = 'electronics'
  ) THEN
    ALTER TYPE "BusinessType" ADD VALUE 'electronics';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'BusinessType' AND e.enumlabel = 'autoparts'
  ) THEN
    ALTER TYPE "BusinessType" ADD VALUE 'autoparts';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'BusinessType' AND e.enumlabel = 'cosmetics'
  ) THEN
    ALTER TYPE "BusinessType" ADD VALUE 'cosmetics';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'BusinessType' AND e.enumlabel = 'furniture'
  ) THEN
    ALTER TYPE "BusinessType" ADD VALUE 'furniture';
  END IF;
END$$;

