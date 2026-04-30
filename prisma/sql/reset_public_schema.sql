-- Destructive: drops everything in public (all data). Used only when RESET_PUBLIC_SCHEMA=1 on Render.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
