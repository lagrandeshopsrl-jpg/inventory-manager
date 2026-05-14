-- Inventory Manager - Protezione con login Supabase
-- Prima crea un utente: Supabase > Authentication > Users > Add user
-- Poi esegui questo SQL per proteggere i dati.
-- ATTENZIONE: dopo questo, solo utenti autenticati possono leggere/scrivere.

alter table public.products enable row level security;
alter table public.import_sessions enable row level security;

drop policy if exists "public read products" on public.products;
drop policy if exists "public insert products" on public.products;
drop policy if exists "public update products" on public.products;
drop policy if exists "public delete products" on public.products;

drop policy if exists "auth read products" on public.products;
drop policy if exists "auth insert products" on public.products;
drop policy if exists "auth update products" on public.products;
drop policy if exists "auth delete products" on public.products;

create policy "auth read products" on public.products for select to authenticated using (true);
create policy "auth insert products" on public.products for insert to authenticated with check (true);
create policy "auth update products" on public.products for update to authenticated using (true) with check (true);
create policy "auth delete products" on public.products for delete to authenticated using (true);

drop policy if exists "public read import sessions" on public.import_sessions;
drop policy if exists "public insert import sessions" on public.import_sessions;
drop policy if exists "public update import sessions" on public.import_sessions;
drop policy if exists "public delete import sessions" on public.import_sessions;

drop policy if exists "auth read import sessions" on public.import_sessions;
drop policy if exists "auth insert import sessions" on public.import_sessions;
drop policy if exists "auth update import sessions" on public.import_sessions;
drop policy if exists "auth delete import sessions" on public.import_sessions;

create policy "auth read import sessions" on public.import_sessions for select to authenticated using (true);
create policy "auth insert import sessions" on public.import_sessions for insert to authenticated with check (true);
create policy "auth update import sessions" on public.import_sessions for update to authenticated using (true) with check (true);
create policy "auth delete import sessions" on public.import_sessions for delete to authenticated using (true);
