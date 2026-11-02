create extension if not exists pgcrypto with schema extensions;

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  tags text not null,
  description text not null,
  pure_veg boolean not null default false,
  eta_min int not null default 10,
  color text not null default '#F59E0B',
  open boolean not null default true,
  sort int not null default 0
);
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  description text not null default '',
  price int not null check (price >= 0),
  veg boolean not null default true,
  stock int not null default 50,
  sort int not null default 0
);
create table public.students (
  id uuid primary key default gen_random_uuid(),
  student_code text unique not null,
  name text not null,
  campus text not null default 'IIM Bangalore',
  wallet int not null default 0 check (wallet >= 0),
  notes_count int not null default 0
);
create table public.student_auth (
  student_id uuid primary key references public.students(id) on delete cascade,
  password_hash text not null,
  token text unique
);
create table public.store_auth (
  store_id uuid primary key references public.stores(id) on delete cascade,
  pin_hash text not null,
  token text unique
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  student_id uuid not null references public.students(id),
  store_id uuid not null references public.stores(id),
  total int not null,
  discount int not null default 0,
  status text not null default 'new' check (status in ('new','preparing','ready','done')),
  created_at timestamptz not null default now()
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_id uuid references public.menu_items(id) on delete set null,
  name text not null,
  qty int not null check (qty > 0),
  price int not null
);
create table public.voice_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  student_id uuid not null references public.students(id),
  store_id uuid not null references public.stores(id),
  duration_sec int not null default 0,
  topics text[] not null default '{}',
  path text,
  created_at timestamptz not null default now()
);
create index on public.menu_items(store_id);
create index on public.orders(store_id, created_at desc);
create index on public.orders(student_id, created_at desc);

alter table public.stores enable row level security;
alter table public.menu_items enable row level security;
alter table public.students enable row level security;
alter table public.student_auth enable row level security;
alter table public.store_auth enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.voice_notes enable row level security;

create policy "public read stores" on public.stores for select to anon, authenticated using (true);
create policy "public read menu" on public.menu_items for select to anon, authenticated using (true);

create or replace function public._student_from_token(p_token text) returns uuid
language sql security definer set search_path = public as $$
  select student_id from student_auth where token = p_token and p_token is not null
$$;
create or replace function public._store_from_token(p_token text) returns uuid
language sql security definer set search_path = public as $$
  select store_id from store_auth where token = p_token and p_token is not null
$$;
revoke all on function public._student_from_token(text), public._store_from_token(text) from public, anon, authenticated;

create or replace function public.student_json(p_id uuid) returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'code', student_code, 'name', name, 'campus', campus,
    'wallet', wallet, 'notes_count', notes_count) from students where id = p_id
$$;
revoke all on function public.student_json(uuid) from public, anon, authenticated;

create or replace function public.student_login(p_code text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare sid uuid; tok text;
begin
  select s.id into sid from students s join student_auth a on a.student_id = s.id
   where lower(s.student_code) = lower(p_code) and a.password_hash = crypt(p_password, a.password_hash);
  if sid is null then raise exception 'Invalid student ID or password'; end if;
  tok := encode(gen_random_bytes(24), 'hex');
  update student_auth set token = tok where student_id = sid;
  return student_json(sid) || jsonb_build_object('token', tok);
end $$;

create or replace function public.student_me(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := _student_from_token(p_token);
begin
  if sid is null then raise exception 'Session expired'; end if;
  return student_json(sid);
end $$;

create or replace function public.top_up(p_token text, p_amount int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := _student_from_token(p_token);
begin
  if sid is null then raise exception 'Session expired'; end if;
  if p_amount < 1 or p_amount > 2000 then raise exception 'Top up between 1 and 2000'; end if;
  update students set wallet = wallet + p_amount where id = sid;
  return student_json(sid);
end $$;

create or replace function public.place_order(p_token text, p_store uuid, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  sid uuid := _student_from_token(p_token);
  subtotal int := 0; disc int := 0; tot int; oid uuid; rec record; seqn bigint; stu students;
begin
  if sid is null then raise exception 'Session expired'; end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then raise exception 'Cart is empty'; end if;
  if not exists (select 1 from stores where id = p_store and open) then raise exception 'Store is closed'; end if;
  select * into stu from students where id = sid for update;
  for rec in
    select m.id, m.name, m.price, m.stock, (e->>'qty')::int as qty
    from jsonb_array_elements(p_items) e join menu_items m on m.id = (e->>'item_id')::uuid and m.store_id = p_store
  loop
    if rec.qty < 1 or rec.qty > 20 then raise exception 'Bad quantity'; end if;
    if rec.stock < rec.qty then raise exception '% is out of stock', rec.name; end if;
    subtotal := subtotal + rec.price * rec.qty;
  end loop;
  if subtotal = 0 then raise exception 'Cart is empty'; end if;
  if stu.notes_count >= 5 and subtotal > 150 then
    disc := round(subtotal * 0.05);
  end if;
  tot := subtotal - disc;
  if stu.wallet < tot then raise exception 'Not enough wallet balance'; end if;
  update students set wallet = wallet - tot,
    notes_count = case when disc > 0 then notes_count - 5 else notes_count end where id = sid;
  insert into orders(student_id, store_id, total, discount) values (sid, p_store, tot, disc)
    returning id, seq into oid, seqn;
  for rec in
    select m.id, m.name, m.price, (e->>'qty')::int as qty
    from jsonb_array_elements(p_items) e join menu_items m on m.id = (e->>'item_id')::uuid and m.store_id = p_store
  loop
    insert into order_items(order_id, item_id, name, qty, price) values (oid, rec.id, rec.name, rec.qty, rec.price);
    update menu_items set stock = stock - rec.qty where id = rec.id;
  end loop;
  return jsonb_build_object('order_id', oid, 'seq', seqn, 'total', tot, 'discount', disc, 'student', student_json(sid));
end $$;

create or replace function public.save_voice_note(p_token text, p_order uuid, p_duration int, p_topics text[], p_path text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := _student_from_token(p_token); sto uuid;
begin
  if sid is null then raise exception 'Session expired'; end if;
  select store_id into sto from orders where id = p_order and student_id = sid;
  if sto is null then raise exception 'Order not found'; end if;
  insert into voice_notes(order_id, student_id, store_id, duration_sec, topics, path)
    values (p_order, sid, sto, least(greatest(p_duration,0),60), coalesce(p_topics,'{}'), p_path);
  update students set notes_count = notes_count + 1 where id = sid;
  return student_json(sid);
end $$;

create or replace function public.my_orders(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := _student_from_token(p_token);
begin
  if sid is null then raise exception 'Session expired'; end if;
  return coalesce((select jsonb_agg(o order by o.created_at desc) from (
    select ord.id, ord.seq, ord.total, ord.discount, ord.status, ord.created_at, s.name as store_name,
      (select string_agg(oi.name || ' x' || oi.qty, ', ') from order_items oi where oi.order_id = ord.id) as items,
      exists(select 1 from voice_notes v where v.order_id = ord.id) as has_note
    from orders ord join stores s on s.id = ord.store_id where ord.student_id = sid limit 50) o), '[]'::jsonb);
end $$;

create or replace function public.vendor_login(p_store uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare tok text;
begin
  if not exists (select 1 from store_auth where store_id = p_store and pin_hash = crypt(p_pin, pin_hash)) then
    raise exception 'Wrong staff PIN';
  end if;
  tok := encode(gen_random_bytes(24), 'hex');
  update store_auth set token = tok where store_id = p_store;
  return jsonb_build_object('token', tok, 'store_id', p_store);
end $$;

create or replace function public.vendor_dashboard(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sto uuid := _store_from_token(p_token); res jsonb;
begin
  if sto is null then raise exception 'Session expired'; end if;
  select jsonb_build_object(
    'store', (select to_jsonb(s) from stores s where s.id = sto),
    'orders_today', (select count(*) from orders where store_id = sto and created_at >= date_trunc('day', now())),
    'revenue_today', (select coalesce(sum(total),0) from orders where store_id = sto and created_at >= date_trunc('day', now())),
    'voice_notes', (select count(*) from voice_notes where store_id = sto),
    'orders_total', (select count(*) from orders where store_id = sto),
    'low_stock', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'stock', stock)), '[]'::jsonb)
                  from menu_items where store_id = sto and stock <= 10),
    'topics', (select coalesce(jsonb_object_agg(t, c), '{}'::jsonb) from (
                 select unnest(topics) t, count(*) c from voice_notes where store_id = sto group by 1) x),
    'queue', (select coalesce(jsonb_agg(q order by q.created_at desc), '[]'::jsonb) from (
        select o.id, o.seq, o.total, o.status, o.created_at, st.name as student_name,
          (select string_agg(oi.name || case when oi.qty > 1 then ' x' || oi.qty else '' end, ', ') from order_items oi where oi.order_id = o.id) as items,
          (select max(v.duration_sec) from voice_notes v where v.order_id = o.id) as note_sec
        from orders o join students st on st.id = o.student_id
        where o.store_id = sto and o.status <> 'done' order by o.created_at desc limit 30) q)
  ) into res;
  return res;
end $$;

create or replace function public.vendor_set_status(p_token text, p_order uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare sto uuid := _store_from_token(p_token);
begin
  if sto is null then raise exception 'Session expired'; end if;
  if p_status not in ('new','preparing','ready','done') then raise exception 'Bad status'; end if;
  update orders set status = p_status where id = p_order and store_id = sto;
end $$;

create or replace function public.vendor_restock(p_token text, p_item uuid, p_qty int) returns void
language plpgsql security definer set search_path = public as $$
declare sto uuid := _store_from_token(p_token);
begin
  if sto is null then raise exception 'Session expired'; end if;
  update menu_items set stock = stock + greatest(p_qty,0) where id = p_item and store_id = sto;
end $$;

revoke all on function public.student_login(text,text), public.student_me(text), public.top_up(text,int),
  public.place_order(text,uuid,jsonb), public.save_voice_note(text,uuid,int,text[],text), public.my_orders(text),
  public.vendor_login(uuid,text), public.vendor_dashboard(text), public.vendor_set_status(text,uuid,text),
  public.vendor_restock(text,uuid,int) from public;
grant execute on function public.student_login(text,text), public.student_me(text), public.top_up(text,int),
  public.place_order(text,uuid,jsonb), public.save_voice_note(text,uuid,int,text[],text), public.my_orders(text),
  public.vendor_login(uuid,text), public.vendor_dashboard(text), public.vendor_set_status(text,uuid,text),
  public.vendor_restock(text,uuid,int) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-notes', 'voice-notes', false, 2097152, array['audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav'])
on conflict (id) do nothing;
create policy "anon upload voice notes" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'voice-notes');
