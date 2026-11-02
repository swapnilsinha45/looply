-- Accounts (student + vendor signup), SKUs / product management, voice transcripts + sentiment

alter table public.students add column email text unique, add column verified boolean not null default false;
update public.students set email = 'durgesh@iimb.ac.in', verified = true where student_code = 'PGP2026-114';

alter table public.stores add column owner_name text, add column phone text;
alter table public.store_auth rename column pin_hash to password_hash;
alter table public.store_auth add column email text unique, add column owner_name text, add column phone text;
update public.store_auth sa
   set email = lower(split_part(s.code, '-', 1)) || '@looply.demo',
       owner_name = 'Demo owner',
       password_hash = extensions.crypt('looply123', extensions.gen_salt('bf'))
  from public.stores s where s.id = sa.store_id;

alter table public.menu_items add column sku text, add column active boolean not null default true;
update public.menu_items m set sku = split_part(s.code, '-', 1) || '-' || lpad(m.sort::text, 3, '0')
  from public.stores s where s.id = m.store_id;
alter table public.menu_items alter column sku set not null;
create unique index menu_items_store_sku on public.menu_items(store_id, sku);

alter table public.voice_notes
  add column transcript text, add column sentiment text, add column sentiment_score real,
  add column aspects jsonb not null default '{}'::jsonb;

drop function if exists public.vendor_login(uuid, text);
drop function if exists public.save_voice_note(text, uuid, int, text[], text);

drop function if exists public.student_login(text, text);
create or replace function public.student_login(p_id text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare sid uuid; tok text;
begin
  select s.id into sid from students s join student_auth a on a.student_id = s.id
   where (lower(s.student_code) = lower(trim(p_id)) or lower(s.email) = lower(trim(p_id)))
     and a.password_hash = crypt(p_password, a.password_hash);
  if sid is null then raise exception 'Invalid email / student ID or password'; end if;
  tok := encode(gen_random_bytes(24), 'hex');
  update student_auth set token = tok where student_id = sid;
  return student_json(sid) || jsonb_build_object('token', tok);
end $$;

create or replace function public.student_signup(p_name text, p_email text, p_password text, p_code text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare em text := lower(trim(p_email)); code text; sid uuid; tok text;
begin
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'Enter your full name'; end if;
  if em !~ '^[a-z0-9._%+-]+@iimb\.ac\.in$' then raise exception 'Students must sign up with an @iimb.ac.in email'; end if;
  if length(coalesce(p_password,'')) < 8 then raise exception 'Password must be at least 8 characters'; end if;
  if exists (select 1 from students where email = em) then raise exception 'An account with this email already exists'; end if;
  code := coalesce(nullif(upper(trim(p_code)), ''), upper(split_part(em, '@', 1)));
  if exists (select 1 from students where student_code = code) then raise exception 'That student ID is already taken'; end if;
  insert into students(student_code, name, email, verified, wallet) values (code, trim(p_name), em, true, 0) returning id into sid;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into student_auth(student_id, password_hash, token) values (sid, crypt(p_password, gen_salt('bf')), tok);
  return student_json(sid) || jsonb_build_object('token', tok);
end $$;

create or replace function public.vendor_login(p_email text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare sto uuid; tok text;
begin
  select store_id into sto from store_auth
   where lower(email) = lower(trim(p_email)) and password_hash = crypt(p_password, password_hash);
  if sto is null then raise exception 'Invalid email or password'; end if;
  tok := encode(gen_random_bytes(24), 'hex');
  update store_auth set token = tok where store_id = sto;
  return jsonb_build_object('token', tok, 'store_id', sto);
end $$;

create or replace function public.vendor_signup(
  p_owner text, p_email text, p_password text, p_phone text, p_name text, p_tags text,
  p_description text, p_pure_veg boolean, p_eta int, p_color text, p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare em text := lower(trim(p_email)); sto uuid; tok text; code text; prefix text; rec record;
begin
  if length(trim(coalesce(p_owner,''))) < 2 then raise exception 'Enter the owner name'; end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'Enter the store name'; end if;
  if em !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then raise exception 'Enter a valid email'; end if;
  if length(coalesce(p_password,'')) < 8 then raise exception 'Password must be at least 8 characters'; end if;
  if exists (select 1 from store_auth where lower(email) = em) then raise exception 'A vendor account with this email already exists'; end if;
  prefix := upper(substr(md5(random()::text), 1, 4));
  code := prefix || '-' || lpad((select count(*) + 1 from stores)::text, 3, '0');
  insert into stores(code, name, tags, description, pure_veg, eta_min, color, owner_name, phone, sort)
    values (code, trim(p_name), coalesce(nullif(trim(p_tags), ''), 'Campus store'),
            coalesce(nullif(trim(p_description), ''), 'Campus store on Looply.'),
            coalesce(p_pure_veg, false), least(greatest(coalesce(p_eta, 10), 1), 90),
            coalesce(nullif(p_color, ''), '#F59E0B'), trim(p_owner), nullif(trim(p_phone), ''),
            (select coalesce(max(sort), 0) + 1 from stores))
    returning id into sto;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into store_auth(store_id, email, owner_name, phone, password_hash, token)
    values (sto, em, trim(p_owner), nullif(trim(p_phone), ''), crypt(p_password, gen_salt('bf')), tok);
  for rec in
    select e.value as v, e.ordinality as n from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality e
  loop
    if length(trim(coalesce(rec.v->>'name', ''))) = 0 then continue; end if;
    insert into menu_items(store_id, sku, name, description, price, veg, stock, sort)
      values (sto,
        coalesce(nullif(upper(trim(rec.v->>'sku')), ''), prefix || '-' || lpad(rec.n::text, 3, '0')),
        trim(rec.v->>'name'), coalesce(rec.v->>'description', ''),
        least(greatest(coalesce((rec.v->>'price')::int, 0), 0), 100000),
        coalesce((rec.v->>'veg')::boolean, true),
        least(greatest(coalesce((rec.v->>'stock')::int, 0), 0), 100000), rec.n);
  end loop;
  return jsonb_build_object('token', tok, 'store_id', sto);
exception when unique_violation then
  raise exception 'Two products share the same SKU, or this account already exists. SKUs must be unique.';
end $$;

create or replace function public.vendor_dashboard(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sto uuid := _store_from_token(p_token); res jsonb;
begin
  if sto is null then raise exception 'Session expired'; end if;
  select jsonb_build_object(
    'store', (select to_jsonb(s) from stores s where s.id = sto),
    'owner', (select jsonb_build_object('name', owner_name, 'email', email, 'phone', phone) from store_auth where store_id = sto),
    'orders_today', (select count(*) from orders where store_id = sto and created_at >= date_trunc('day', now())),
    'revenue_today', (select coalesce(sum(total),0) from orders where store_id = sto and created_at >= date_trunc('day', now())),
    'voice_notes', (select count(*) from voice_notes where store_id = sto),
    'orders_total', (select count(*) from orders where store_id = sto),
    'items', (select coalesce(jsonb_agg(to_jsonb(m) - 'store_id' order by m.sort, m.name), '[]'::jsonb) from menu_items m where m.store_id = sto),
    'low_stock', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'stock', stock)), '[]'::jsonb)
                  from menu_items where store_id = sto and active and stock <= 10),
    'topics', (select coalesce(jsonb_object_agg(t, c), '{}'::jsonb) from (
                 select unnest(topics) t, count(*) c from voice_notes where store_id = sto group by 1) x),
    'sentiment', (select jsonb_build_object(
        'positive', count(*) filter (where sentiment = 'positive'),
        'neutral',  count(*) filter (where sentiment = 'neutral'),
        'negative', count(*) filter (where sentiment = 'negative'),
        'avg', coalesce(round(avg(sentiment_score)::numeric, 2), 0)) from voice_notes where store_id = sto),
    'aspects', (select coalesce(jsonb_object_agg(k, jsonb_build_object('avg', a, 'n', n)), '{}'::jsonb) from (
                  select key k, round(avg(value::numeric), 2) a, count(*) n
                  from voice_notes, jsonb_each_text(aspects) where store_id = sto group by key) z),
    'notes', (select coalesce(jsonb_agg(n order by n.created_at desc), '[]'::jsonb) from (
        select v.id, v.transcript, v.sentiment, v.sentiment_score, v.duration_sec, v.topics, v.created_at,
               split_part(st.name, ' ', 1) as student, o.seq
        from voice_notes v join students st on st.id = v.student_id left join orders o on o.id = v.order_id
        where v.store_id = sto order by v.created_at desc limit 25) n),
    'queue', (select coalesce(jsonb_agg(q order by q.created_at desc), '[]'::jsonb) from (
        select o.id, o.seq, o.total, o.status, o.created_at, st.name as student_name,
          (select string_agg(oi.name || case when oi.qty > 1 then ' x' || oi.qty else '' end, ', ') from order_items oi where oi.order_id = o.id) as items,
          (select max(v.duration_sec) from voice_notes v where v.order_id = o.id) as note_sec,
          (select max(v.sentiment) from voice_notes v where v.order_id = o.id) as note_sentiment
        from orders o join students st on st.id = o.student_id
        where o.store_id = sto and o.status <> 'done' order by o.created_at desc limit 30) q)
  ) into res;
  return res;
end $$;

create or replace function public.vendor_upsert_item(
  p_token text, p_id uuid, p_sku text, p_name text, p_desc text, p_price int, p_veg boolean, p_stock int, p_active boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare sto uuid := _store_from_token(p_token); sku text := upper(trim(coalesce(p_sku, '')));
begin
  if sto is null then raise exception 'Session expired'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Product name is required'; end if;
  if p_price < 0 or p_price > 100000 then raise exception 'Price must be between 0 and 100000'; end if;
  if p_stock < 0 or p_stock > 100000 then raise exception 'Stock must be between 0 and 100000'; end if;
  if p_id is null then
    if sku = '' then
      sku := (select split_part(code, '-', 1) from stores where id = sto) || '-' ||
             lpad(((select coalesce(max(sort), 0) from menu_items where store_id = sto) + 1)::text, 3, '0');
    end if;
    insert into menu_items(store_id, sku, name, description, price, veg, stock, active, sort)
      values (sto, sku, trim(p_name), coalesce(p_desc, ''), p_price, p_veg, p_stock, coalesce(p_active, true),
              (select coalesce(max(sort), 0) + 1 from menu_items where store_id = sto));
  else
    update menu_items set sku = case when upsert_sku = '' then menu_items.sku else upsert_sku end,
      name = trim(p_name), description = coalesce(p_desc, ''), price = p_price, veg = p_veg,
      stock = p_stock, active = coalesce(p_active, true)
    from (select sku as upsert_sku) x
    where menu_items.id = p_id and menu_items.store_id = sto;
    if not found then raise exception 'Product not found'; end if;
  end if;
exception when unique_violation then
  raise exception 'SKU % is already used by another product', sku;
end $$;

create or replace function public.vendor_delete_item(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare sto uuid := _store_from_token(p_token);
begin
  if sto is null then raise exception 'Session expired'; end if;
  delete from menu_items where id = p_id and store_id = sto;
end $$;

create or replace function public.vendor_update_store(
  p_token text, p_name text, p_tags text, p_description text, p_pure_veg boolean, p_eta int, p_open boolean, p_phone text
) returns void
language plpgsql security definer set search_path = public as $$
declare sto uuid := _store_from_token(p_token);
begin
  if sto is null then raise exception 'Session expired'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Store name is required'; end if;
  update stores set name = trim(p_name), tags = coalesce(nullif(trim(p_tags), ''), tags),
    description = coalesce(nullif(trim(p_description), ''), description), pure_veg = p_pure_veg,
    eta_min = least(greatest(p_eta, 1), 90), open = p_open, phone = nullif(trim(p_phone), '') where id = sto;
end $$;

create or replace function public.save_voice_note(
  p_token text, p_order uuid, p_duration int, p_topics text[], p_path text,
  p_transcript text, p_sentiment text, p_score real, p_aspects jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := _student_from_token(p_token); sto uuid;
begin
  if sid is null then raise exception 'Session expired'; end if;
  if p_sentiment not in ('positive', 'neutral', 'negative') then raise exception 'Bad sentiment'; end if;
  if length(trim(coalesce(p_transcript, ''))) = 0 then raise exception 'Voice note text is empty'; end if;
  select store_id into sto from orders where id = p_order and student_id = sid;
  if sto is null then raise exception 'Order not found'; end if;
  if exists (select 1 from voice_notes where order_id = p_order) then raise exception 'You already sent a note for this order'; end if;
  insert into voice_notes(order_id, student_id, store_id, duration_sec, topics, path, transcript, sentiment, sentiment_score, aspects)
    values (p_order, sid, sto, least(greatest(p_duration, 0), 60), coalesce(p_topics, '{}'), p_path,
            left(trim(p_transcript), 1000), p_sentiment, greatest(least(p_score, 1), -1), coalesce(p_aspects, '{}'::jsonb));
  update students set notes_count = notes_count + 1 where id = sid;
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
    from jsonb_array_elements(p_items) e
    join menu_items m on m.id = (e->>'item_id')::uuid and m.store_id = p_store and m.active
  loop
    if rec.qty < 1 or rec.qty > 20 then raise exception 'Bad quantity'; end if;
    if rec.stock < rec.qty then raise exception '% is out of stock', rec.name; end if;
    subtotal := subtotal + rec.price * rec.qty;
  end loop;
  if subtotal = 0 then raise exception 'Cart is empty'; end if;
  if stu.notes_count >= 5 and subtotal > 150 then disc := round(subtotal * 0.05); end if;
  tot := subtotal - disc;
  if stu.wallet < tot then raise exception 'Not enough wallet balance'; end if;
  update students set wallet = wallet - tot,
    notes_count = case when disc > 0 then notes_count - 5 else notes_count end where id = sid;
  insert into orders(student_id, store_id, total, discount) values (sid, p_store, tot, disc)
    returning id, seq into oid, seqn;
  for rec in
    select m.id, m.name, m.price, (e->>'qty')::int as qty
    from jsonb_array_elements(p_items) e
    join menu_items m on m.id = (e->>'item_id')::uuid and m.store_id = p_store and m.active
  loop
    insert into order_items(order_id, item_id, name, qty, price) values (oid, rec.id, rec.name, rec.qty, rec.price);
    update menu_items set stock = stock - rec.qty where id = rec.id;
  end loop;
  return jsonb_build_object('order_id', oid, 'seq', seqn, 'total', tot, 'discount', disc, 'student', student_json(sid));
end $$;

revoke all on function
  public.student_login(text,text), public.student_signup(text,text,text,text), public.vendor_login(text,text),
  public.vendor_signup(text,text,text,text,text,text,text,boolean,int,text,jsonb),
  public.vendor_dashboard(text), public.vendor_upsert_item(text,uuid,text,text,text,int,boolean,int,boolean),
  public.vendor_delete_item(text,uuid), public.vendor_update_store(text,text,text,text,boolean,int,boolean,text),
  public.save_voice_note(text,uuid,int,text[],text,text,text,real,jsonb), public.place_order(text,uuid,jsonb)
  from public;
grant execute on function
  public.student_login(text,text), public.student_signup(text,text,text,text), public.vendor_login(text,text),
  public.vendor_signup(text,text,text,text,text,text,text,boolean,int,text,jsonb),
  public.vendor_dashboard(text), public.vendor_upsert_item(text,uuid,text,text,text,int,boolean,int,boolean),
  public.vendor_delete_item(text,uuid), public.vendor_update_store(text,text,text,text,boolean,int,boolean,text),
  public.save_voice_note(text,uuid,int,text[],text,text,text,real,jsonb), public.place_order(text,uuid,jsonb)
  to anon, authenticated;
