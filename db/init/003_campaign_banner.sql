-- Campaign banner images. Idempotent — safe to run repeatedly.
-- On the live DB run:
--   docker compose exec -T db psql -U vcc -d vcc < db/init/003_campaign_banner.sql

alter table campaigns add column if not exists banner_updated_at timestamptz;

create table if not exists campaign_banners (
  campaign_id uuid primary key references campaigns(id) on delete cascade,
  mime        text not null,
  data        bytea not null
);
