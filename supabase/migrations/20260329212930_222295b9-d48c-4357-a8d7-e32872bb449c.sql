-- Add status and protocol columns to leaves table
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'PENDING';
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS protocol text;

-- Update existing records to APPROVED (they were created before the approval flow)
UPDATE public.leaves SET status = 'APPROVED' WHERE status = 'PENDING';