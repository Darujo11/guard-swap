-- Enable realtime for swap_requests table
ALTER TABLE public.swap_requests REPLICA IDENTITY FULL;

-- Add the table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.swap_requests;