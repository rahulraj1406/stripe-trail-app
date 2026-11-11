create table if not exists runs (
  id bigint generated always as identity primary key,
  "user" text not null,
  distance_km numeric not null check (distance_km > 0),
  recorded_at timestamptz default now()
);
create table if not exists entries (
  session_id text primary key,
  email text,
  amount_cents int,
  paid_at timestamptz default now()
);
-- PoC policies (anon key); tighten before production
alter table runs enable row level security;
alter table entries enable row level security;
create policy "anon read runs" on runs for select using (true);
create policy "anon insert runs" on runs for insert with check (true);
create policy "anon write entries" on entries for all using (true) with check (true);
