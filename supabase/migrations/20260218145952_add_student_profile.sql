-- 1. Enable the extension for random UUIDs
create extension IF not exists "pgcrypto";

create table public.student_profile (
  -- 2. Ensure the ID cannot be empty and uses the correct default function
  id uuid primary key default gen_random_uuid (),
  -- 3. Use UNIQUE to prevent duplicate student entries
  student_email text not null unique,
  -- 4. Set a default for the score so it isn't 'null' initially
  avg_score float8 default 0.0
);