-- Adicionar campo is_shift_chief na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN is_shift_chief BOOLEAN NOT NULL DEFAULT false;