-- Co-Create Request feature. Idempotent — safe to run repeatedly.
-- On the live DB run:
--   docker compose exec -T db psql -U vcc -d vcc < db/init/004_co_create.sql
begin;

-- Uploaded documents are private; bytes live in Postgres like campaign banners.
create table if not exists co_create_files (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references creator_profiles(id) on delete cascade,
  request_id    uuid,
  kind          text not null check (kind in ('idea_doc', 'gst_proforma')),
  original_name text not null,
  mime          text not null,
  size_bytes    integer not null check (size_bytes > 0),
  storage_key   text not null unique,
  data          bytea not null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_cc_files_creator on co_create_files(creator_id, created_at desc);

create table if not exists co_create_requests (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references creator_profiles(id) on delete cascade,
  campaign_id     uuid references campaigns(id) on delete set null,
  status          text not null default 'pending_review'
                  check (status in ('pending_review', 'approved', 'modified', 'declined')),
  submitted_at    timestamptz not null default now(),
  idempotency_key text not null,

  terms_version      text not null,
  terms_accepted_at  timestamptz not null,
  terms_clause_ids   text[] not null,
  terms_ip           inet,
  terms_user_agent   text,

  -- Section 1
  title            varchar(100) not null,
  idea_description varchar(500) not null,
  vivo_product     varchar(100) not null,
  idea_doc_file_id uuid references co_create_files(id) on delete set null,
  support_type     text not null check (support_type in ('paid', 'borrow', 'gifted', 'combined')),

  -- Branch A (paid / combined)
  fee_amount_inr    integer check (fee_amount_inr >= 1),
  fee_covers        text[],
  fee_other_items   varchar(200),
  fee_justification varchar(300),
  payment_milestone text check (payment_milestone in ('advance_50_50', 'full_on_approval')),
  gst_registered    boolean,
  gst_number        varchar(15),

  -- Branch B (borrow)
  borrow_product         varchar(100),
  borrow_variant         varchar(150),
  borrow_variant_reason  varchar(200),
  borrow_units           integer check (borrow_units >= 1),
  borrow_duration        text check (borrow_duration in ('d1_3', 'd4_7', 'd8_14', 'd15_plus')),
  borrow_location_type   text check (borrow_location_type in ('own_premises', 'multiple')),
  borrow_locations       varchar(200),
  borrow_return_commitment boolean,

  -- Branch C (gifted / combined)
  gift_product           varchar(100),
  gift_variant           varchar(150),
  gift_variant_reason    varchar(200),
  gift_units             integer check (gift_units >= 1),
  gift_multi_unit_reason varchar(200),

  -- Section 3
  content_types          text[] not null,
  content_type_other     varchar(200),
  deliverables_breakdown jsonb not null,
  total_deliverables     integer not null check (total_deliverables >= 1),
  product_visibility     text not null check (product_visibility in ('prominent', 'partial', 'mention_only')),
  content_concept        varchar(400) not null,
  will_tag               boolean not null,
  no_tag_reason          varchar(200),
  shoot_date             date not null,
  posting_date           date not null,
  submit_for_review      boolean not null,
  review_reconfirmed     boolean,
  review_days_before     text check (review_days_before in ('d1', 'd2', 'd3', 'd5_plus')),

  -- Section 4
  primary_platform        text not null check (primary_platform in ('instagram', 'youtube', 'both')),
  estimated_reach         integer not null check (estimated_reach >= 0),
  competing_brand_active  boolean not null,
  competing_brand_details varchar(300),

  competing_brand_declared boolean not null default false,
  flags                    text[] not null default '{}',

  -- Review
  reviewed_by   uuid references users(id) on delete set null,
  reviewed_at   timestamptz,
  decision_note text
);
create unique index if not exists uq_cc_requests_idem on co_create_requests(creator_id, idempotency_key);
create index if not exists idx_cc_requests_status  on co_create_requests(status, submitted_at desc);
create index if not exists idx_cc_requests_creator on co_create_requests(creator_id, submitted_at desc);
create index if not exists idx_cc_requests_flags   on co_create_requests using gin (flags);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'co_create_files_request_fk') then
    alter table co_create_files
      add constraint co_create_files_request_fk
      foreign key (request_id) references co_create_requests(id) on delete cascade;
  end if;
end $$;

create table if not exists co_create_payment_details (
  request_id          uuid primary key references co_create_requests(id) on delete cascade,
  account_holder_name text not null,
  bank_name           text not null,
  account_number_enc  text not null,   -- AES-256-GCM, never returned in clear except via audited reveal
  account_number_last4 char(4) not null,
  ifsc                char(11) not null,
  account_type        text not null check (account_type in ('savings', 'current')),
  upi_id              text,
  gst_proforma_file_id uuid references co_create_files(id) on delete set null
);

create table if not exists co_create_status_history (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references co_create_requests(id) on delete cascade,
  from_status text,
  to_status   text not null,
  actor_id    uuid,
  note        text,
  at          timestamptz not null default now()
);
create index if not exists idx_cc_history_request on co_create_status_history(request_id, at);

-- The existing notifications table is creator-scoped, so admins get their own.
create table if not exists co_create_admin_notifications (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references co_create_requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at    timestamptz,
  read_by    uuid references users(id) on delete set null
);
create index if not exists idx_cc_notif_unread on co_create_admin_notifications(created_at desc) where read_at is null;

-- No audit log existed; append-only. No FK on request_id so history outlives deletions.
create table if not exists co_create_audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid,
  actor_role text not null,
  action     text not null,
  request_id uuid,
  meta       jsonb not null default '{}'::jsonb,
  ip         inet,
  created_at timestamptz not null default now()
);
create index if not exists idx_cc_audit_request on co_create_audit_log(request_id, created_at desc);

create or replace function co_create_audit_immutable() returns trigger as $$
begin
  raise exception 'co_create_audit_log is append-only';
end;
$$ language plpgsql;

drop trigger if exists co_create_audit_no_update on co_create_audit_log;
create trigger co_create_audit_no_update
  before update or delete on co_create_audit_log
  for each row execute procedure co_create_audit_immutable();

commit;
