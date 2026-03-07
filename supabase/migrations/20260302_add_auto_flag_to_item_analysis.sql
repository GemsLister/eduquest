-- Add auto_flag column to item_analysis table
ALTER TABLE public.item_analysis ADD COLUMN IF NOT EXISTS auto_flag VARCHAR(50) DEFAULT 'pending';

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_item_analysis_auto_flag ON public.item_analysis(auto_flag);

-- Update flag values in questions table to match new naming convention
-- 'approved' -> 'retain', 'needs_revision' -> 'needs_revision', 'pending' -> 'pending', 'discard' -> 'discard'
