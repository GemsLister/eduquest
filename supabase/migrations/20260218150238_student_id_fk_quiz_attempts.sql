ALTER TABLE public.quiz_attempts
ADD CONSTRAINT fk_student
FOREIGN KEY (student_id) 
REFERENCES public.student_profile(id)
ON DELETE CASCADE;