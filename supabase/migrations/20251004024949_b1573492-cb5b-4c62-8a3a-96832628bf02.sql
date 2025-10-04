-- Add quantity column to extras table
ALTER TABLE public.extras 
ADD COLUMN quantity integer NOT NULL DEFAULT 1;

-- Add a check constraint to ensure quantity is positive
ALTER TABLE public.extras 
ADD CONSTRAINT extras_quantity_positive CHECK (quantity > 0);