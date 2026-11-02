-- Private key store and rate-limit log for the `transcribe` edge function (service role only).
-- Add the key with: insert into public.app_secrets(name, value) values ('groq_api_key', '<key>') on conflict (name) do update set value = excluded.value;
create table public.app_secrets (name text primary key, value text not null);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

create table public.transcribe_log (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  language text,
  created_at timestamptz not null default now()
);
alter table public.transcribe_log enable row level security;
revoke all on public.transcribe_log from anon, authenticated;
create index on public.transcribe_log(student_id, created_at desc);

alter table public.voice_notes add column language text;
-- save_voice_note gained a trailing p_language text default null parameter (see applied migration).
