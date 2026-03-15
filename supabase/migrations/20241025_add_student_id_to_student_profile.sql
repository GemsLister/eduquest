-- Migration: Add student_id column to student_profile
-- Extracts ID from email (e.g., 230... from 230abc@student.buksu.edu.ph)

ALTER TABLE public.student_profile 
ADD COLUMN student_id text UNIQUE;

-- Optional: Backfill existing (parse from student_email)
-- UPDATE public.student_profile SET student_id = split_part(student_email, '@', 1);
