-- Email notifications (Resend). Idempotent — safe to run repeatedly.
-- Init scripts only run on a fresh volume; on the live DB run:
--   docker compose exec -T db psql -U vcc -d vcc < db/init/002_email.sql

alter table creator_profiles
  add column if not exists email_opt_in boolean not null default true;

create table if not exists email_log (
  id          uuid primary key default gen_random_uuid(),
  to_email    text not null,
  creator_id  uuid references creator_profiles(id) on delete set null,
  template    text not null,
  subject     text not null,
  status      text not null default 'queued'
              check (status in ('queued','sent','failed','skipped')),
  provider_id text,
  error       text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

create index if not exists idx_email_log_creator
  on email_log (creator_id, created_at desc);
