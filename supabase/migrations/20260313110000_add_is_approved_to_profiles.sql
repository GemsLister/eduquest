-- Add is_approved column to profiles
-- New registrations default to false (pending admin review)
-- Existing instructor accounts are set to true (already active)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;

-- Mark all existing accounts as approved so current instructors aren't locked out
UPDATE public.profiles SET is_approved = true WHERE is_approved = false;

-- Allow admins to update is_approved on any profile
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );
