create extension if not exists pgcrypto;

create table if not exists public.restaurant_votes (
    restaurant_id text not null check (char_length(btrim(restaurant_id)) between 1 and 80),
    device_id text not null check (char_length(btrim(device_id)) between 1 and 120),
    created_at timestamptz not null default now(),
    primary key (restaurant_id, device_id)
);

create table if not exists public.shop_comments (
    id uuid primary key default gen_random_uuid(),
    restaurant_id text not null check (char_length(btrim(restaurant_id)) between 1 and 80),
    device_id text not null check (char_length(btrim(device_id)) between 1 and 120),
    text text not null check (char_length(btrim(text)) between 1 and 36),
    created_at timestamptz not null default now()
);

create table if not exists public.free_notes (
    id uuid primary key default gen_random_uuid(),
    device_id text not null check (char_length(btrim(device_id)) between 1 and 120),
    shop_name text not null check (char_length(btrim(shop_name)) between 1 and 12),
    text text not null check (char_length(btrim(text)) between 1 and 28),
    created_at timestamptz not null default now()
);

create or replace view public.vote_counts as
select restaurant_id, count(*)::int as vote_count
from public.restaurant_votes
group by restaurant_id;

create index if not exists idx_shop_comments_restaurant_created
    on public.shop_comments (restaurant_id, created_at desc);

create index if not exists idx_free_notes_created
    on public.free_notes (created_at desc);

alter table public.restaurant_votes enable row level security;
alter table public.shop_comments enable row level security;
alter table public.free_notes enable row level security;

drop policy if exists restaurant_votes_insert_anon on public.restaurant_votes;
drop policy if exists shop_comments_read_anon on public.shop_comments;
drop policy if exists shop_comments_insert_anon on public.shop_comments;
drop policy if exists free_notes_read_anon on public.free_notes;
drop policy if exists free_notes_insert_anon on public.free_notes;

create policy restaurant_votes_insert_anon
    on public.restaurant_votes
    for insert
    to anon
    with check (
        char_length(btrim(restaurant_id)) between 1 and 80
        and char_length(btrim(device_id)) between 1 and 120
    );

create policy shop_comments_read_anon
    on public.shop_comments
    for select
    to anon
    using (true);

create policy shop_comments_insert_anon
    on public.shop_comments
    for insert
    to anon
    with check (
        char_length(btrim(restaurant_id)) between 1 and 80
        and char_length(btrim(device_id)) between 1 and 120
        and char_length(btrim(text)) between 1 and 36
    );

create policy free_notes_read_anon
    on public.free_notes
    for select
    to anon
    using (true);

create policy free_notes_insert_anon
    on public.free_notes
    for insert
    to anon
    with check (
        char_length(btrim(device_id)) between 1 and 120
        and char_length(btrim(shop_name)) between 1 and 12
        and char_length(btrim(text)) between 1 and 28
    );

grant usage on schema public to anon;
grant insert on public.restaurant_votes to anon;
grant select, insert on public.shop_comments to anon;
grant select, insert on public.free_notes to anon;
grant select on public.vote_counts to anon;
