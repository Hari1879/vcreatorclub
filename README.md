# VCC Creator Portal — vcreatorclub.in

V Creater Club portal for FTPL Tamil Nadu: QR-gated creator enrollment, creator dashboard, and admin panel.

| Layer | Tech |
|---|---|
| Frontend | Angular 18 (standalone, signals), Tailwind CSS 3, PWA (`@angular/service-worker`), `angularx-qrcode`, `lucide-angular` |
| Backend | NestJS 10, Passport Google OAuth 2.0, signed httpOnly session cookie (JWT), `class-validator`, `@nestjs/throttler` |
| Database | PostgreSQL 16 (`pg`, parameterised queries only) |
| Hosting | Hostinger KVM VPS — Docker Compose (db + api + web) behind host Nginx + Let's Encrypt |

```
vcreatorclub/
├── api/                 NestJS API  (all routes under /api)
│   └── src/
│       ├── auth/        Google OAuth, session cookie, SessionGuard, AdminGuard
│       ├── enrollment/  token validation, drafts, submit
│       ├── creator/     /me — profile, campaigns, notifications (own rows only)
│       ├── admin/       roster, approvals, campaigns, tokens, notifications, seed
│       └── common/      DTOs, option lists, row mappers
├── web/                 Angular app
│   └── src/app/
│       ├── pages/landing      /
│       ├── pages/join         /join?token=…
│       ├── pages/dashboard    /dashboard (home, campaigns, profile, notifications)
│       ├── pages/admin        /admin (dashboard, creators, campaigns, tokens)
│       └── shared/            3-step profile form, logo, badges, icons
├── db/init/001_schema.sql    full schema (idempotent)
├── deploy/nginx-vcreatorclub.conf
└── docker-compose.yml
```

---

## 1. Local development

Requirements: Node 20+, PostgreSQL 16.

```bash
# database
createdb vcc
psql -d vcc -f db/init/001_schema.sql

# api  (http://localhost:3000)
cd api
cp .env.example .env          # edit DATABASE_URL if needed
npm install
npm run start:dev

# web  (http://localhost:4200, proxies /api → :3000)
cd ../web
npm install
npx ng serve
```

**Sign in without Google locally:** with `ENABLE_DEV_LOGIN=true` in `api/.env`, open
`http://localhost:4200/api/auth/dev-login?email=you@example.com&returnTo=/admin`.
This route is disabled whenever `NODE_ENV=production`.

---

## 2. Google OAuth (one time)

console.cloud.google.com → project `vcreatorclub`:

1. **OAuth consent screen** → External → App name "VCC Creator Club", support + developer email → Save. Publish the app (or add creators as test users — in "Testing" mode only test users can sign in).
2. **Credentials → Create OAuth client ID** → Web application. Authorised redirect URIs:
   - `https://vcreatorclub.in/api/auth/google/callback`
   - `http://localhost:4200/api/auth/google/callback`
3. Copy Client ID + Secret into `.env`.

> ⚠️ Publish the consent screen before Oct 13. In "Testing" mode, creators who aren't listed test users get "Access blocked".

---

## 3. Deploy to the Hostinger VPS

```bash
# on the VPS (Docker + Nginx + Certbot installed)
git clone <repo> /opt/vcreatorclub && cd /opt/vcreatorclub
cp .env.example .env && nano .env        # fill every value; secrets: openssl rand -hex 32
docker compose up -d --build
curl -s http://127.0.0.1:8080/api/health  # → {"ok":true}

# host Nginx + HTTPS
sudo cp deploy/nginx-vcreatorclub.conf /etc/nginx/sites-available/vcreatorclub
sudo ln -s /etc/nginx/sites-available/vcreatorclub /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d vcreatorclub.in -d www.vcreatorclub.in --redirect
```

**DNS (Hostinger hPanel → DNS Zone for vcreatorclub.in)** — replaces the Vercel records in the handover:

| Type | Name | Value |
|---|---|---|
| A | @ | *your VPS IP* |
| A | www | *your VPS IP* |

Remove any existing `@`/`www` A, AAAA or CNAME records that point elsewhere. Run Certbot only after DNS resolves (`dig +short vcreatorclub.in`).

The schema in `db/init` runs automatically the first time the `db` volume is created. To use an existing Postgres instead, point `DATABASE_URL` at it, run `psql -f db/init/001_schema.sql` once, and drop the `db` service.

**Backups:** `docker compose exec db pg_dump -U vcc vcc | gzip > vcc-$(date +%F).sql.gz` (add to cron).

---

## 4. First admin (handover Part L)

1. Make sure `.env` has `ENABLE_ADMIN_SEED=true` and an `ADMIN_SEED_SECRET` of 16+ characters.
2. Open `https://vcreatorclub.in/admin` → **Sign in with Google**. You'll see "Access denied" — expected.
3. Visit `https://vcreatorclub.in/api/admin/seed?secret=<ADMIN_SEED_SECRET>&name=SK&role=super_admin`
   → `{"success":true,"message":"Admin SK seeded as super_admin"}`
4. Reload `/admin` — full access.
5. Set `ENABLE_ADMIN_SEED=false` and run `docker compose up -d` (the endpoint then returns 404).

Repeat step 3 (while seeding is on) for each team member after they sign in. Roles: `super_admin`, `admin`, `viewer` (read-only).

---

## 5. Event checklist — Oct 12 / 13

- [ ] `https://vcreatorclub.in` loads over HTTPS on a phone
- [ ] Google consent screen is **published**
- [ ] Admin seeded, then `ENABLE_ADMIN_SEED=false`
- [ ] Admin → QR Tokens → **Use Oct 13 event preset** → Generate (50 uses, expires 14 Oct 11:59 PM IST)
- [ ] **Download QR as PNG** — generate it *from https://vcreatorclub.in* so the QR points at the live site (the page warns otherwise)
- [ ] Scan the printed QR with an Android and an iPhone, complete a test enrollment, approve it, then delete the test row:
      `docker compose exec db psql -U vcc -c "delete from creator_profiles where email='test@…'"`
      (the test also used 1 of the 50 token uses)
- [ ] Venue Wi-Fi is flaky? Drafts save on the phone every 2 s and to the server every 30 s; creators can finish later from the same QR link.

---

## How enrollment works

1. `/join?token=vcc-…` — token checked server-side (exists, active, unexpired, `used_count < max_uses`). Invalid/expired/used-up links show the error screens from G2.
2. Three steps; drafts auto-save (localStorage every 2 s + immediately on step change or when the phone locks; server every 30 s). Reopening the link restores the step and answers.
3. **Submit & sign in with Google** → Google → back to `/join?…&submit=1` → submitted automatically.
4. Server, in one transaction: rejects a second enrollment from the same Google account, increments `used_count` only if the token is still valid, inserts the profile (`pending`, `vcc_community`), deletes the draft.
5. Admin approves → creator gets an "Application approved" notification and full dashboard access.

## API overview

| Route | Access |
|---|---|
| `GET /api/auth/google?returnTo=/path`, `GET /api/auth/me`, `POST /api/auth/logout` | public / session |
| `GET /api/enrollment/tokens/validate`, `POST /api/enrollment/draft`, `GET /api/enrollment/draft/:id` | public, 20 req/min/IP |
| `POST /api/enrollment/submit` | signed in, 20 req/min/IP |
| `/api/me/*` — summary, profile, campaigns, interest, notifications | signed-in creator, own rows only |
| `/api/admin/*` — stats, creators, approve/reject, campaigns, assignments, tokens, notifications | admin (`viewer` = read-only) |
| `GET /api/admin/seed` | signed in + secret + `ENABLE_ADMIN_SEED=true` |

Automatic notifications: approval, rejection (with optional note), tier change, campaign published (to eligible approved creators), assignment accepted/declined/completed/cancelled. Admins can also send custom notifications from a creator's detail panel. No notification text is hardcoded in the creator UI.

---

## Changes from the handover document

Agreed changes, for SK's awareness:

- **Stack:** Angular + NestJS + self-hosted PostgreSQL on the Hostinger VPS instead of Next.js + Supabase + Vercel. Supabase RLS rules (Part I3) are enforced in the API (`SessionGuard`, `AdminGuard`, every creator query scoped to the signed-in user). Zod → `class-validator` on the server, typed validation in the form on the client.
- **Enrollment form:** handover fields merged with the handwritten notes — coordination (directly / through manager + manager name & contact), core platform + Instagram/YouTube/Facebook/LinkedIn/Threads (handle or URL + followers), main content category, content languages, rates per story/post/reel/TVC, "worked with Vivo before", and two consent checkboxes (enrol + confidentiality). Still 3 steps. The handover's "Instagram content category" became one **Main content category**; Instagram is required only when it's the core platform.
- **Drafts before sign-in** live in an `enrollment_drafts` table (the creator has no account yet), not `creator_profiles.draft_data`.
- **Body font** is Inter to match the approved mockups; headings use Barlow Condensed per E2. One-line change in `web/src/styles.css` if SK prefers condensed body text.
- **Disclaimer** uses the full J3 wording (it also covers the shorter G1 line).
- **Seed endpoint** is switched off by an env flag instead of commenting out code.
