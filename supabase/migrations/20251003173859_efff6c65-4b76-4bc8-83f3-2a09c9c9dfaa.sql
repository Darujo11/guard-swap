-- Add phone column to profiles table for WhatsApp
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;