-- Add 'retain' as a valid flag value
ALTER TABLE public.questions 
DROP CONSTRAINT IF EXISTS questions_flag_check,
ADD CONSTRAINT questions_flag_check 
CHECK (flag IN ('pending', 'approved', 'needs_revision', 'discard', 'retain'));

-- Also update the item_analysis table if it has similar constraint
ALTER TABLE public.item_analysis 
DROP CONSTRAINT IF EXISTS item_analysis_auto_flag_check,
ADD CONSTRAINT item_analysis_auto_flag_check 
CHECK (auto_flag IN ('pending', 'approved', 'needs_revision', 'discard', 'retain'));
