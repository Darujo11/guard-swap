-- Enable the pg_cron extension to schedule jobs
create extension if not exists pg_cron;

-- Create a table to track the keep-alive pings
create table if not exists public.keep_alive (
  id int primary key default 1,
  last_ping timestamptz default now(),
  -- Ensure only one row exists
  constraint single_row check (id = 1)
);

-- Insert the initial row or update it if it exists
insert into public.keep_alive (id, last_ping)
values (1, now())
on conflict (id) do update set last_ping = now();

-- Schedule the cron job to run every day at 03:00 AM (UTC)
-- The job updates the timestamp in the keep_alive table
select cron.schedule(
  'keep-alive-daily', -- Job name
  '0 3 * * *',        -- Cron schedule (03:00 AM daily)
  $$ update public.keep_alive set last_ping = now() where id = 1 $$
);
