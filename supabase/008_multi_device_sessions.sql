-- 008: several devices can stay signed in to one account.
-- Before this, each login overwrote the account's single token, so a second sign-in
-- (another phone, the desktop console, or another tester on a demo login) signed the first one out.
-- Applied through the Supabase migration history as multi_device_sessions and split_password_session_triggers.

create table if not exists public.auth_sessions (
  token_hash text primary key,              -- sha256 of the token; the token itself is never stored
  role text not null check (role in ('student', 'vendor')),
  subject uuid not null,                    -- student_id or store_id
  created_at timestamptz not null default now()
);
create index if not exists auth_sessions_subject on public.auth_sessions(role, subject);
alter table public.auth_sessions enable row level security;
revoke all on public.auth_sessions from anon, authenticated;

create or replace function public._new_session(p_role text, p_subject uuid)
returns text language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare tok text := encode(gen_random_bytes(24), 'hex');
begin
  delete from auth_sessions where created_at < now() - interval '30 days';
  insert into auth_sessions(token_hash, role, subject) values (encode(digest(tok, 'sha256'), 'hex'), p_role, p_subject);
  return tok;
end $$;
revoke all on function public._new_session(text, uuid) from public, anon, authenticated;

-- Token check: per-login sessions (30 days), plus the legacy single token that sign-up and verify still issue.
create or replace function public._store_from_token(p_token text)
returns uuid language sql security definer set search_path to 'public', 'extensions' as $$
  select coalesce(
    (select subject from auth_sessions where p_token is not null and role = 'vendor'
       and token_hash = encode(digest(p_token, 'sha256'), 'hex') and created_at > now() - interval '30 days'),
    (select store_id from store_auth where token = p_token and p_token is not null))
$$;
create or replace function public._student_from_token(p_token text)
returns uuid language sql security definer set search_path to 'public', 'extensions' as $$
  select coalesce(
    (select subject from auth_sessions where p_token is not null and role = 'student'
       and token_hash = encode(digest(p_token, 'sha256'), 'hex') and created_at > now() - interval '30 days'),
    (select student_id from student_auth where token = p_token and p_token is not null))
$$;

create or replace function public.vendor_login(p_email text, p_password text)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare sto uuid; ver boolean;
begin
  select store_id, verified into sto, ver from store_auth
   where lower(email) = lower(trim(p_email)) and password_hash = crypt(p_password, password_hash);
  if sto is null then raise exception 'Invalid email or password'; end if;
  if not ver then raise exception 'EMAIL_NOT_VERIFIED:%', lower(trim(p_email)); end if;
  return jsonb_build_object('token', _new_session('vendor', sto), 'store_id', sto);
end $$;

create or replace function public.student_login(p_id text, p_password text)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare sid uuid; ver boolean; em text;
begin
  select s.id, s.verified, s.email into sid, ver, em from students s join student_auth a on a.student_id = s.id
   where (lower(s.student_code) = lower(trim(p_id)) or lower(s.email) = lower(trim(p_id)))
     and a.password_hash = crypt(p_password, a.password_hash);
  if sid is null then raise exception 'Invalid email / student ID or password'; end if;
  if not ver then raise exception 'EMAIL_NOT_VERIFIED:%', em; end if;
  return student_json(sid) || jsonb_build_object('token', _new_session('student', sid));
end $$;

-- A password change (reset) signs out every device.
create or replace function public._end_vendor_sessions() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.password_hash is distinct from old.password_hash then
    delete from auth_sessions where role = 'vendor' and subject = old.store_id;
  end if;
  return new;
end $$;
create or replace function public._end_student_sessions() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.password_hash is distinct from old.password_hash then
    delete from auth_sessions where role = 'student' and subject = old.student_id;
  end if;
  return new;
end $$;
drop trigger if exists end_sessions_on_password on public.store_auth;
create trigger end_sessions_on_password after update of password_hash on public.store_auth
  for each row execute function public._end_vendor_sessions();
drop trigger if exists end_sessions_on_password on public.student_auth;
create trigger end_sessions_on_password after update of password_hash on public.student_auth
  for each row execute function public._end_student_sessions();
revoke all on function public._end_vendor_sessions() from public, anon, authenticated;
revoke all on function public._end_student_sessions() from public, anon, authenticated;
