-- Add email column to profiles for easy instructor listing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Add is_admin boolean for admin role identification
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
