-- 009: vendors can delete their account from Settings (applied as migration vendor_delete_account).
-- The password must be typed again. A store nobody has ordered from is removed completely (menu and login cascade).
-- A store with past orders or reviews is closed, hidden from students, and stripped of login and personal details,
-- so students keep their own order history and reviews. The demo stores (@looply.demo) cannot be deleted.

alter table public.stores add column if not exists deleted_at timestamptz;

-- deleted stores disappear from the student app
drop policy if exists "public read stores" on public.stores;
create policy "public read stores" on public.stores for select to anon, authenticated using (deleted_at is null);

create or replace function public.vendor_delete_account(p_token text, p_password text)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare sto uuid := _store_from_token(p_token); em text;
begin
  if sto is null then raise exception 'Session expired'; end if;
  select email into em from store_auth where store_id = sto and password_hash = crypt(coalesce(p_password, ''), password_hash);
  if em is null then raise exception 'Wrong password'; end if;
  if lower(em) like '%@looply.demo' then raise exception 'Demo stores cannot be deleted'; end if;

  delete from auth_sessions where role = 'vendor' and subject = sto;
  if not exists (select 1 from orders where store_id = sto) and not exists (select 1 from voice_notes where store_id = sto) then
    delete from stores where id = sto;
    return jsonb_build_object('ok', true, 'removed', 'all');
  end if;
  delete from store_auth where store_id = sto;
  update menu_items set active = false where store_id = sto;
  update stores set open = false, deleted_at = now(), owner_name = null, phone = null where id = sto;
  return jsonb_build_object('ok', true, 'removed', 'login_and_details');
end $$;
grant execute on function public.vendor_delete_account(text, text) to anon, authenticated;
