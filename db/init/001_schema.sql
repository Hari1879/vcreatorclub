-- =====================================================================
-- VCC Creator Portal — PostgreSQL schema
-- Adapted from handover Part D for self-hosted PostgreSQL (no Supabase).
--   * `users` replaces Supabase `auth.users` (Google OAuth identities)
--   * Row-level access rules (Part I3) are enforced in the NestJS API
--   * Enrollment fields merged from the handover doc + handwritten notes
-- Safe to run on an empty database. Runs automatically on first
-- `docker compose up` (mounted into /docker-entrypoint-initdb.d).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Users (Google OAuth identities)
-- ---------------------------------------------------------------------
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  google_id     text unique,
  email         text not null unique,
  name          text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- ---------------------------------------------------------------------
-- Admin users
-- ---------------------------------------------------------------------
create table if not exists admin_users (
  id         uuid primary key references users(id) on delete cascade,
  name       text not null,
  email      text not null,
  role       text not null default 'admin'
             check (role in ('super_admin', 'admin', 'viewer')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Enrollment tokens (QR codes)
-- ---------------------------------------------------------------------
create table if not exists enrollment_tokens (
  id             uuid primary key default gen_random_uuid(),
  token          text unique not null,
  label          text,
  is_event_token boolean not null default false,
  used_count     integer not null default 0 check (used_count >= 0),
  max_uses       integer not null default 1 check (max_uses >= 1),
  expires_at     timestamptz not null,
  is_active      boolean not null default true,
  created_by     uuid references users(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Pre-login enrollment drafts (auto-save layer 2)
-- The creator has no account until Google sign-in at the final step,
-- so drafts are keyed by a random client-side draft id + token.
-- ---------------------------------------------------------------------
create table if not exists enrollment_drafts (
  draft_id   uuid primary key,
  token      text not null references enrollment_tokens(token) on delete cascade,
  step       smallint not null default 1 check (step between 1 and 3),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists idx_drafts_updated on enrollment_drafts(updated_at);

-- ---------------------------------------------------------------------
-- Creator profiles
-- ---------------------------------------------------------------------
create table if not exists creator_profiles (
  id                       uuid primary key references users(id) on delete cascade,

  -- Step 1 — personal + coordination
  full_name                text not null,
  email                    text not null,
  phone                    text,
  city                     text,
  coordination_mode        text not null default 'direct'
                           check (coordination_mode in ('direct', 'manager')),
  manager_name             text,
  manager_contact          text,

  -- Step 2 — platforms
  core_platform            text check (core_platform in
                           ('instagram', 'youtube', 'facebook', 'linkedin', 'threads')),
  instagram_handle         text,
  instagram_url            text,
  instagram_followers      integer not null default 0,
  youtube_handle           text,
  youtube_url              text,
  youtube_subscribers      integer not null default 0,
  facebook_url             text,
  facebook_followers       integer not null default 0,
  linkedin_url             text,
  linkedin_followers       integer not null default 0,
  threads_handle           text,
  threads_url              text,
  threads_followers        integer not null default 0,
  other_platforms          text,
  content_category         text,
  content_languages        text[] not null default '{}',

  -- Step 3 — content profile, rates, history, consent
  content_types            text[] not null default '{}',
  bio                      text,
  rate_story_inr           numeric(12,2),
  rate_post_inr            numeric(12,2),
  rate_reel_inr            numeric(12,2),
  rate_tvc_inr             numeric(12,2),
  worked_with_vivo         boolean not null default false,
  vivo_work_details        text,
  consent_enroll           boolean not null default false,
  consent_confidentiality  boolean not null default false,
  consent_at               timestamptz,

  profile_photo_url        text,
  enrollment_token         text references enrollment_tokens(token) on delete set null,
  status                   text not null default 'pending'
                           check (status in ('pending', 'approved', 'rejected', 'inactive')),
  tier                     text not null default 'vcc_community'
                           check (tier in ('core_creator', 'campaign_creator', 'vcc_community', 'inactive')),
  enrolled_at              timestamptz not null default now(),
  approved_at              timestamptz,
  approved_by              uuid references users(id) on delete set null,
  admin_notes              text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists idx_profiles_status   on creator_profiles(status);
create index if not exists idx_profiles_tier     on creator_profiles(tier);
create index if not exists idx_profiles_enrolled on creator_profiles(enrolled_at desc);

-- ---------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------
create table if not exists campaigns (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  product        text,
  campaign_type  text check (campaign_type in ('free', 'paid', 'gifted')),
  budget_inr     numeric(12,2),
  deliverables   text[] not null default '{}',
  deadline       timestamptz,
  status         text not null default 'draft'
                 check (status in ('draft', 'open', 'closed', 'completed')),
  eligible_tiers text[] not null default '{vcc_community,campaign_creator,core_creator}',
  max_creators   integer check (max_creators is null or max_creators > 0),
  created_by     uuid references users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_campaigns_status on campaigns(status);

-- ---------------------------------------------------------------------
-- Campaign assignments
-- ---------------------------------------------------------------------
create table if not exists campaign_assignments (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  creator_id   uuid not null references creator_profiles(id) on delete cascade,
  status       text not null default 'invited'
               check (status in ('invited', 'accepted', 'declined', 'submitted', 'completed', 'cancelled')),
  content_url  text,
  accepted_at  timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  admin_notes  text,
  created_at   timestamptz not null default now(),
  unique (campaign_id, creator_id)
);

-- ---------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creator_profiles(id) on delete cascade,
  title      text not null,
  message    text not null,
  type       text not null default 'info'
             check (type in ('info', 'campaign', 'approval', 'alert')),
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_creator on notifications(creator_id, created_at desc);

-- ---------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on creator_profiles;
create trigger set_updated_at
  before update on creator_profiles
  for each row execute procedure handle_updated_at();

drop trigger if exists set_updated_at_campaigns on campaigns;
create trigger set_updated_at_campaigns
  before update on campaigns
  for each row execute procedure handle_updated_at();
