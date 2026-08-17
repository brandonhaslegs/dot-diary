-- Immutable snapshots for public diary links. The random ID is the secret:
-- anyone who knows it can read its intentionally-selected snapshot.
create table if not exists public.public_shares (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{8,32}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.public_shares enable row level security;

create policy "Anyone can open a public share by its unguessable ID"
  on public.public_shares for select using (true);

create policy "Users can create their own public shares"
  on public.public_shares for insert to authenticated
  with check (auth.uid() = user_id);
