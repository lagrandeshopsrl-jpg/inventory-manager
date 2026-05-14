-- Inventory Manager Cloud - Supabase setup
-- Supabase > SQL Editor > New query > incolla tutto > Run

create table if not exists public.products (
  barcode text primary key,
  name text,
  supplier text,
  buy_price text,
  sell_price text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.import_sessions (
  session_id text primary key,
  file_name text,
  products jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table public.products enable row level security;
alter table public.import_sessions enable row level security;

drop policy if exists "public read products" on public.products;
drop policy if exists "public insert products" on public.products;
drop policy if exists "public update products" on public.products;
drop policy if exists "public delete products" on public.products;

create policy "public read products" on public.products for select to anon using (true);
create policy "public insert products" on public.products for insert to anon with check (true);
create policy "public update products" on public.products for update to anon using (true) with check (true);
create policy "public delete products" on public.products for delete to anon using (true);

drop policy if exists "public read import sessions" on public.import_sessions;
drop policy if exists "public insert import sessions" on public.import_sessions;
drop policy if exists "public update import sessions" on public.import_sessions;
drop policy if exists "public delete import sessions" on public.import_sessions;

create policy "public read import sessions" on public.import_sessions for select to anon using (true);
create policy "public insert import sessions" on public.import_sessions for insert to anon with check (true);
create policy "public update import sessions" on public.import_sessions for update to anon using (true) with check (true);
create policy "public delete import sessions" on public.import_sessions for delete to anon using (true);
