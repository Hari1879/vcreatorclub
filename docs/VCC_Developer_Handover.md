# VCC CREATOR PORTAL — DEVELOPER HANDOVER DOCUMENT
## vcreatorclub.in | Vivo Creator Club | FTPL Tamil Nadu
### Prepared by: SK (Sathish K), Marketing Manager, FTPL
### Handover Date: October 10, 2026
### Event Date: October 13, 2026

---

> **DEVELOPER INSTRUCTION**
> Read this document fully before writing a single line of code.
> Every decision in this document is pre-approved by the project owner (SK).
> Do not deviate from design, language rules, or security specs without SK's explicit approval.
> If something is unclear, ask SK — do not assume or invent.

---

## PART A — PROJECT CONTEXT

### A1. What is VCC?

VCC stands for Vivo Creator Club. It is a creator ecosystem program initiated by FTPL (Fangs Technology Pvt Ltd), the authorised Tamil Nadu Super Stockist for Vivo India.

The program's goal is to build a structured, long-term relationship between FTPL and Tamil Nadu-based content creators — across Instagram, YouTube, and other platforms. Creators enrolled in VCC receive priority consideration for future Vivo campaign collaborations, events, and creator-support opportunities.

VCC is built and operated by FTPL independently. It is not an official Vivo India HQ program. Vivo India head office approval is being sought since the Vivo brand is used in communications.

### A2. Why This Portal Exists

Until now, FTPL had no direct digital channel to enrol, manage, or communicate with creators. This portal serves three purposes:

1. **Enrolment** — Creators scan a QR code at the Oct 13 event and register themselves on the platform
2. **Creator Dashboard** — Each enrolled creator gets a personal space to see their status, tier, notifications, and active campaigns
3. **Admin Panel** — SK and his team can view enrolled creators, approve applications, manage campaigns, and generate QR codes for future enrollments

### A3. The First Event

- **Date:** October 13, 2026
- **Venue:** Sage & Lavender Café, TTK Road, Alwarpet, Chennai
- **Time:** 5:00 PM – 8:20 PM
- **Attendees:** 21 invited creators (paid invites — no free tier)
- **Portal requirement:** Enrollment form must be live and accessible by QR scan by October 12 EOD

### A4. Program Position — What VCC Is and Is NOT

| VCC IS | VCC IS NOT |
|---|---|
| An open creator ecosystem | A legal contract or binding agreement |
| A priority consideration program | A guaranteed benefits program |
| A long-term direct channel | A one-off campaign |
| Run by FTPL | An official Vivo India HQ program |
| Voluntary — creators free to work with competitors | An exclusive lock-in |

This distinction matters because it directly controls every word written on the portal.

---

## PART B — TECH STACK

The developer sets up all infrastructure independently. No credentials from SK are shared.

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | TypeScript, strict mode |
| Styling | Tailwind CSS 3.x | Mobile-first |
| Database | Supabase (PostgreSQL) | Developer creates own project |
| Authentication | Supabase Auth — Google OAuth only | No password login |
| PWA | next-pwa | Service worker, installable on phone |
| QR Generation | react-qr-code | For admin token display |
| Form | react-hook-form + zod | Validation + auto-save |
| Icons | lucide-react | — |
| Hosting | Vercel (free tier) | Connects to vcreatorclub.in |

### Packages to install

```bash
npx create-next-app@latest vcreatorclub --typescript --tailwind --app

npm install @supabase/supabase-js @supabase/auth-helpers-nextjs \
  next-pwa react-hook-form zod @hookform/resolvers \
  lucide-react react-qr-code
```

---

## PART C — INFRASTRUCTURE SETUP

The developer creates all of the following independently.

### C1. Supabase Setup

1. Go to supabase.com → Create new account (use your own email)
2. Create new organisation → name it appropriately
3. Create new project:
   - Name: `vcreatorclub`
   - Region: Asia Pacific (Singapore or Tokyo — closest to Tamil Nadu)
   - **Uncheck** "Automatically expose new tables" — control access manually
   - **Check** "Enable automatic RLS" — Row Level Security on by default
4. After project is ready → Settings → API → copy:
   - Project URL (format: `https://xxxx.supabase.co`)
   - Anon/Publishable Key (starts with `sb_publishable_...`)
5. Create `.env.local` in project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=https://vcreatorclub.in
ADMIN_SEED_SECRET=choose_a_strong_random_string
TOKEN_SECRET=choose_another_strong_random_string
```

### C2. Google OAuth Setup

**Step 1 — Google Cloud Console**
1. Go to console.cloud.google.com
2. Create new project → name: `vcreatorclub`
3. Left sidebar → APIs & Services → OAuth consent screen
4. Select External → Create
5. Fill in: App name = "VCC Creator Club" | Support email = your email | Developer contact = your email
6. Save and Continue → Skip Scopes → Save → Add test users if needed → Save

**Step 2 — Create OAuth Credentials**
1. APIs & Services → Credentials → + Create Credentials → OAuth 2.0 Client ID
2. Application type: Web application
3. Name: `vcreatorclub`
4. Authorized redirect URIs — add both:
   - `https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/callback`
5. Click Create → Copy Client ID and Client Secret

**Step 3 — Enable in Supabase**
1. Supabase Dashboard → Authentication → Providers → Google → Toggle ON
2. Paste Client ID and Client Secret → Save
3. Authentication → URL Configuration:
   - Site URL: `https://vcreatorclub.in`
   - Redirect URLs: add `https://vcreatorclub.in/auth/callback` and `http://localhost:3000/auth/callback`

### C3. Vercel Setup

1. Go to vercel.com → Create account
2. New Project → Import from GitHub (push code to GitHub first)
3. Framework: Next.js (auto-detected)
4. Add all environment variables from `.env.local`
5. Deploy → after deploy, add domain `vcreatorclub.in` in project Settings → Domains

### C4. Domain DNS (Hostinger → Vercel)

In Hostinger hPanel → DNS Zone for vcreatorclub.in → add:

| Type | Name | Value |
|---|---|---|
| A | @ | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |

SSL is automatic via Vercel — no action needed.

---

## PART D — DATABASE SCHEMA

Run all SQL below in Supabase SQL Editor (Dashboard → SQL Editor → New query) in the exact order shown.

### D1. Extensions

```sql
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
```

### D2. Admin Users Table

```sql
create table admin_users (
  id uuid references auth.users(id) primary key,
  name text not null,
  email text not null,
  role text default 'admin' check (role in ('super_admin', 'admin', 'viewer')),
  created_at timestamptz default now()
);

alter table admin_users enable row level security;

create policy "Admins can view admin list"
  on admin_users for select
  using (exists (select 1 from admin_users where id = auth.uid()));

create policy "Super admins can manage admins"
  on admin_users for all
  using (exists (
    select 1 from admin_users where id = auth.uid() and role = 'super_admin'
  ));
```

### D3. Enrollment Tokens Table

```sql
create table enrollment_tokens (
  id uuid default uuid_generate_v4() primary key,
  token text unique not null,
  label text,
  is_event_token boolean default false,
  used_count integer default 0,
  max_uses integer default 1,
  expires_at timestamptz not null,
  is_active boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table enrollment_tokens enable row level security;

create policy "Public can read active unexpired tokens"
  on enrollment_tokens for select
  using (is_active = true and expires_at > now());

create policy "Admins can manage all tokens"
  on enrollment_tokens for all
  using (exists (select 1 from admin_users where id = auth.uid()));
```

> NOTE: The Oct 13 event uses one shared token with `is_event_token = true` and `max_uses = 50` (covers 21 creators + buffer). Future individual tokens use `max_uses = 1`.

### D4. Creator Profiles Table

```sql
create table creator_profiles (
  id uuid references auth.users(id) primary key,
  full_name text not null,
  email text not null,
  phone text,
  city text,
  instagram_handle text,
  instagram_followers integer default 0,
  instagram_category text,
  youtube_handle text,
  youtube_subscribers integer default 0,
  content_types text[] default '{}',
  bio text,
  profile_photo_url text,
  enrollment_token text references enrollment_tokens(token),
  status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'inactive')),
  tier text default 'vcc_community' check (tier in ('core_creator', 'campaign_creator', 'vcc_community', 'inactive')),
  enrolled_at timestamptz default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  draft_data jsonb,
  draft_updated_at timestamptz,
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table creator_profiles enable row level security;

create policy "Creators can view own profile"
  on creator_profiles for select
  using (auth.uid() = id);

create policy "Creators can update own profile"
  on creator_profiles for update
  using (auth.uid() = id);

create policy "Creators can insert own profile"
  on creator_profiles for insert
  with check (auth.uid() = id);

create policy "Admins can manage all profiles"
  on creator_profiles for all
  using (exists (select 1 from admin_users where id = auth.uid()));
```

### D5. Campaigns Table

```sql
create table campaigns (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  product text,
  campaign_type text check (campaign_type in ('free', 'paid', 'gifted')),
  budget_inr numeric,
  deliverables text[] default '{}',
  deadline timestamptz,
  status text default 'draft' check (status in ('draft', 'open', 'closed', 'completed')),
  eligible_tiers text[] default '{vcc_community,campaign_creator,core_creator}',
  max_creators integer,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table campaigns enable row level security;

create policy "Creators can view open campaigns for their tier"
  on campaigns for select
  using (
    status = 'open'
    and exists (
      select 1 from creator_profiles
      where id = auth.uid()
      and status = 'approved'
      and tier = any(campaigns.eligible_tiers)
    )
  );

create policy "Admins can manage all campaigns"
  on campaigns for all
  using (exists (select 1 from admin_users where id = auth.uid()));
```

### D6. Campaign Assignments Table

```sql
create table campaign_assignments (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references campaigns(id) on delete cascade,
  creator_id uuid references creator_profiles(id) on delete cascade,
  status text default 'invited' check (status in ('invited', 'accepted', 'declined', 'submitted', 'completed', 'cancelled')),
  content_url text,
  accepted_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  admin_notes text,
  created_at timestamptz default now(),
  unique(campaign_id, creator_id)
);

alter table campaign_assignments enable row level security;

create policy "Creators can view own assignments"
  on campaign_assignments for select
  using (creator_id = auth.uid());

create policy "Creators can update own assignment status"
  on campaign_assignments for update
  using (creator_id = auth.uid());

create policy "Admins can manage all assignments"
  on campaign_assignments for all
  using (exists (select 1 from admin_users where id = auth.uid()));
```

### D7. Notifications Table

```sql
create table notifications (
  id uuid default uuid_generate_v4() primary key,
  creator_id uuid references creator_profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text default 'info' check (type in ('info', 'campaign', 'approval', 'alert')),
  read boolean default false,
  created_at timestamptz default now()
);

alter table notifications enable row level security;

create policy "Creators can view own notifications"
  on notifications for select
  using (creator_id = auth.uid());

create policy "Creators can mark own notifications as read"
  on notifications for update
  using (creator_id = auth.uid());

create policy "Admins can manage all notifications"
  on notifications for all
  using (exists (select 1 from admin_users where id = auth.uid()));
```

### D8. Auto-Update Trigger

```sql
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on creator_profiles
  for each row execute procedure handle_updated_at();

create trigger set_updated_at_campaigns
  before update on campaigns
  for each row execute procedure handle_updated_at();
```

---

## PART E — DESIGN SYSTEM

### E1. Color Tokens

Add to `tailwind.config.js`:

```js
colors: {
  vcc: {
    navy:         '#0D1B3E',
    'navy-light': '#1A2D5A',
    blue:         '#1E88E5',
    'blue-dark':  '#1565C0',
    'blue-light': '#42A5F5',
    gold:         '#F9A825',
    teal:         '#00897B',
    gray:         '#607D8B',
    'gray-light': '#B0BEC5',
    white:        '#FFFFFF',
    danger:       '#E53935',
    success:      '#43A047',
    warning:      '#FB8C00',
  }
}
```

### E2. Typography

Load from Google Fonts (Bahnschrift is Windows-only — Barlow Condensed is the closest available web font):

```css
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&display=swap');

:root {
  --font-heading: 'Bahnschrift SemiBold SemiCondensed', 'Barlow Condensed', 'Gill Sans', Arial, sans-serif;
  --font-body: 'Barlow Condensed', 'Inter', Arial, sans-serif;
}

h1, h2, h3, h4, .label, .nav-item {
  font-family: var(--font-heading);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

body, p, input, button {
  font-family: var(--font-body);
}
```

### E3. Tier Colour System

| Tier Value (DB) | Display Label | Colour |
|---|---|---|
| `core_creator` | CORE CREATOR | Gold — #F9A825 |
| `campaign_creator` | CAMPAIGN CREATOR | Blue — #1E88E5 |
| `vcc_community` | VCC COMMUNITY | Teal — #00897B |
| `inactive` | INACTIVE | Gray — #607D8B |

**Important:** Do NOT use Gold/Silver/Bronze tier labels. The four tiers above are the only valid values.

### E4. Component Rules

- All headings and button labels: ALL CAPS
- All body text, form labels, descriptions: Sentence case
- Primary button: `bg-vcc-blue text-white hover:bg-vcc-blue-dark rounded-lg font-bold`
- Cards on dark background: `bg-vcc-navy-light border border-vcc-blue/20 rounded-xl`
- Cards on white background: `bg-white border border-gray-200 shadow-sm rounded-xl`
- Input fields: `bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-vcc-blue`
- Input fields on dark bg: `bg-vcc-navy-light border border-vcc-blue/30 text-white rounded-lg focus:ring-2 focus:ring-vcc-blue`
- Mobile viewport minimum: 390px
- Admin panel: desktop-first (min 1024px)

---

## PART F — URL STRUCTURE

```
vcreatorclub.in/                   → Public landing page (no auth required)
vcreatorclub.in/join?token=xxx     → Enrollment form (token required in URL)
vcreatorclub.in/dashboard          → Creator portal (Google auth required)
vcreatorclub.in/dashboard/profile  → Creator profile view/edit
vcreatorclub.in/dashboard/campaigns → Available campaigns
vcreatorclub.in/admin              → Admin panel (auth + admin role required)
vcreatorclub.in/admin/creators     → Creator roster + approvals
vcreatorclub.in/admin/campaigns    → Campaign management
vcreatorclub.in/admin/tokens       → QR token generator
vcreatorclub.in/auth/callback      → OAuth redirect handler (Supabase)
```

---

## PART G — PAGE SPECIFICATIONS

### G1. LANDING PAGE ( / )

**Reference visual:** Approved mockup Panel 4 — with 3 corrections below.

**Layout:** Single-page scroll. No top navigation bar with multiple links. One sticky "JOIN VCC" button in top-right only.

**Section 1 — Hero (dark navy, full viewport)**
- VCC logo centered (blue V-shape emblem — not Vivo logo)
- Headline: `VIVO CREATOR CLUB` — large, ALL CAPS, electric blue gradient text
- Sub-line: `Tamil Nadu's Creator Ecosystem · By Invitation Only` — white
- CTA button: `JOIN VCC` — solid blue, centered
- Background: dark navy with subtle animated blue gradient or particle effect

**Section 2 — What is VCC (white background)**
- Section title: `WHAT IS VCC`
- 3 cards in a row (stacked on mobile):
  - Card 1: Icon + `A CREATOR COMMUNITY` + "A curated community of passionate content creators across Tamil Nadu."
  - Card 2: Icon + `EXCLUSIVE EXPERIENCES` + "Priority access to Vivo product launches, creator events, and special programs."
  - Card 3: Icon + `GROW TOGETHER` + "Collaborate with Vivo and FTPL on campaigns, products, and content opportunities."

**Section 3 — Creator Benefits (dark navy background)**
- Section title: `CREATOR BENEFITS`
- 2x2 grid of benefit cards (stacked 1-column on mobile):
  - `PRODUCT ACCESS` — Priority consideration for early access to new Vivo devices
  - `BUSINESS OPPORTUNITY` — Priority consideration for Vivo campaign collaborations and creator projects
  - `CREATOR SUPPORT` — Dedicated support from the VCC team for your content journey
  - `BRAND AMPLIFICATION` — Priority consideration for your content to be amplified across Vivo and FTPL channels
- Disclaimer below grid (small text, grey): `Benefits are directional and subject to program terms. No commitments or assurances are made.`

**Section 4 — Who Can Join (white background)**
- Section title: `WHO CAN JOIN`
- Eligibility indicators: Tamil Nadu based · Active content creator · Instagram or YouTube presence · Minimum 5,000 followers
- Note below: `VCC enrollment is by invitation only. You will need a personal QR code to access the enrollment form.`

**Footer (dark navy)**
- VCC logo (small)
- Text: `A Creator Initiative by FTPL · Tamil Nadu`
- Text: `Powered by Fangs Technology Pvt Ltd — Authorised Vivo India Super Stockist, Tamil Nadu`
- No social links. No external URLs. No Vivo corporate logo.

---

**⚠️ LANDING PAGE CORRECTIONS (from visual review — mandatory)**

| Item | Do NOT do | DO this instead |
|---|---|---|
| Logo | Use Vivo "V" logo or "vivo" wordmark | Use VCC logo only |
| URL in browser | Show vcc.vivo.com | Domain is vcreatorclub.in |
| Benefit language | "Get early access to..." / "Enjoy exclusive..." | "Priority consideration for..." / "Potential access to..." |
| Footer logo | Vivo logo in footer | VCC logo + FTPL text only |
| Nav links | About, Events, FAQ, Benefits as nav | Single "JOIN VCC" button only |

---

### G2. ENROLLMENT FORM ( /join?token=xxx )

**Reference visual:** Approved mockup Panel 3 — build as-is.

**Token gate (on page load — before rendering any form):**
1. Read `token` from URL query parameter
2. Call Supabase to validate: token exists + `is_active = true` + `expires_at > now()` + `used_count < max_uses`
3. If invalid → show full-screen error: `"This link is not valid. Please use your personal QR code to access VCC enrollment."`
4. If expired → show: `"This enrollment link has expired. Please contact the VCC team."`
5. If valid → render the form

**Layout:** Dark navy background. Single column. Phone-first. Sticky top bar with auto-save indicator.

**Auto-save indicator (top of screen, always visible):**
`☁ Draft saved · X mins ago` in small grey text. Updates every time a save occurs.

**Progress indicator:** 3-step dot progress bar. Step 1, 2, 3 labelled. Active step filled blue.

**STEP 1 — PERSONAL DETAILS**

| Field | Type | Validation |
|---|---|---|
| Full Name | Text | Required, 2–100 characters |
| Email | Email | Required, valid email format |
| Phone Number | Tel | Required, Indian 10-digit (+91 prefix shown) |
| City | Text | Required |

Button: `NEXT →` (full width, blue)

**STEP 2 — SOCIAL MEDIA**

| Field | Type | Notes |
|---|---|---|
| Instagram Handle | Text | Required. Auto-prefix @ if not entered |
| Instagram Followers | Number | Required |
| Instagram Content Category | Dropdown | Required — options: Lifestyle / Tech & Gadgets / Travel / Food / Fashion / Comedy / Education / Gaming / Fitness / Other |
| YouTube Handle | Text | Optional |
| YouTube Subscribers | Number | Shows only if YouTube handle is filled |
| Other Platforms | Text | Optional, free text |

Button: `NEXT →` (full width, blue). Back arrow top-left.

**STEP 3 — CONTENT PROFILE**

| Field | Type | Notes |
|---|---|---|
| Content Types | Multi-checkbox | Options: Short Videos / Reels / Long Form Video / Photography / Instagram Stories / Live Streams / Podcast / Blog |
| About You | Textarea | Max 300 characters. Placeholder: "Tell us about your content and why you'd like to join VCC" |

Button: `SUBMIT & SIGN IN WITH GOOGLE` (full width, blue). Back arrow top-left.

**Final step — Google Sign-In:**
After Step 3, if not yet logged in → show Google OAuth button. After successful Google login → form is submitted to Supabase → token `used_count` incremented → success screen shown.

**Success Screen:**
- Large blue checkmark
- `ENROLLMENT SUBMITTED`
- `Welcome to Vivo Creator Club`
- `Your application is under review. Our team will be in touch.`
- No redirect. No countdown. Just this screen.

**Auto-save implementation (3-layer):**

Layer 1 — localStorage (every 2 seconds, debounced):
```
Key: vcc_draft_<token>
Value: { step, formData, savedAt }
```

Layer 2 — Supabase draft (every 30 seconds, if network available):
- POST to `/api/enrollment/draft` → updates `creator_profiles.draft_data` and `draft_updated_at`

Layer 3 — Restore on return:
- On page load, check localStorage first, then Supabase draft
- Restore to the step and field values saved

---

### G3. CREATOR DASHBOARD ( /dashboard )

**Reference visual:** Approved mockup Panel 2 — build as-is. One note below.

**Access control:** Requires Google auth. If user has no `creator_profiles` record → redirect to `/join` error page. If `status = 'pending'` → show pending screen instead of full dashboard.

**Pending Screen (shown if status = pending):**
- `APPLICATION UNDER REVIEW`
- "Thank you for enrolling. Our team is reviewing your application. You will be notified once approved."
- No dashboard content visible.

**Layout (Phone — primary):** Bottom tab navigation + scrollable content
**Layout (Laptop):** Left sidebar navigation + main content

**Bottom nav / Sidebar items:**
- Home (house icon)
- Campaigns (megaphone icon)
- Profile (person icon)
- Notifications (bell icon with unread count badge)

**HOME TAB:**
- Greeting: `HI, [FIRST NAME]` — fetched from creator_profiles.full_name
- Tier badge below name — coloured pill per tier system in Part E3
- Status card: Green dot + `ACTIVE MEMBER · Enrolled [Month Year]`
- Notifications section: Last 3 notifications. "View All" link → Notifications tab
- Campaigns section: Active open campaigns creator is eligible for. "View All" link → Campaigns tab
- If no campaigns: `"No campaigns available right now. Check back soon."`

**CAMPAIGNS TAB:**
- List of open campaigns from Supabase where `status = 'open'` and creator's `tier` is in `eligible_tiers`
- Each campaign card shows: Product name, Type (Paid / Free / Gifted badge), Deadline, Deliverable count
- `VIEW` button → expands card to show full description + deliverables + `I'M INTERESTED` button
- `I'M INTERESTED` → creates row in `campaign_assignments` with status `invited`
- Empty state if none available.

**PROFILE TAB:**
- Display all enrolled data: name, phone, email, city, Instagram, YouTube, tier, enrollment date
- `EDIT` button → opens same Step 1/2/3 form pre-filled (updates creator_profiles on submit)
- Read-only: enrollment date, tier, status, approved date

**NOTIFICATIONS TAB:**
- Full list, newest first
- Unread items bold + dot indicator
- Click any notification → marks as read (updates `read = true` in Supabase)
- Type icons: info (blue circle), campaign (gold megaphone), approval (green check), alert (red warning)
- Empty state: "No notifications yet."

**⚠️ NOTIFICATION NOTE (from visual review — mandatory):**
All notification content must come from the database only. Do not hardcode any sample notification text in the UI. Show empty state when no notifications exist.

---

### G4. ADMIN PANEL ( /admin )

**Reference visual:** Approved mockup Panel 1 — build with 1 correction below.

**Access control:** Requires Google auth AND presence in `admin_users` table. If logged in but not in admin_users → show: `"Access denied. This area is restricted to authorised VCC team members."`

**Layout:** Dark navy left sidebar (fixed, 220px) + white main content. Desktop-first.

**Sidebar:**
- VCC logo at top
- Admin name + "Admin" label (fetched from admin_users)
- Navigation: Dashboard / Creators / Campaigns / QR Tokens / Logout

---

**ADMIN DASHBOARD PAGE:**
- Page title: `DASHBOARD`
- 4 KPI cards: Total Enrolled / Pending Approval / Approved / Active Campaigns
- Recent enrollments table (last 10 by enrolled_at)
- Quick action buttons: Generate QR Token / New Campaign

---

**CREATORS PAGE:**
- Page title: `CREATOR ROSTER`
- `APPROVE SELECTED` button top right (bulk action, only active when rows selected)
- 4 KPI cards: Total Enrolled / Pending / Approved / Active Campaigns
- Search bar: search by name, Instagram handle, city
- Filter dropdowns: All Status / All Tier
- Data table columns: checkbox | Name + category | Instagram | Followers | City | Status | Tier | Action

Status pills:
- Pending: amber background, dark text
- Approved: green background, white text
- Rejected: red background, white text
- Inactive: grey background, white text

**⚠️ TIER CORRECTION (from visual review — mandatory):**
Use the 4 VCC tier names only. Do not use Gold / Silver / Bronze.

| Use This | Not This |
|---|---|
| Core Creator | Gold |
| Campaign Creator | Silver |
| VCC Community | Bronze |
| Inactive | Any other |

Action buttons per row: `Approve` (blue) + `Reject` (red outlined)
- Approve → updates `status = 'approved'`, sets `approved_at = now()`, sets `approved_by = admin_uid`
- Reject → shows optional text field for rejection note → updates `status = 'rejected'`
- Both actions → send a notification to creator automatically

Pagination: 10 rows per page.

---

**CAMPAIGNS PAGE:**
- Page title: `CAMPAIGNS`
- `+ NEW CAMPAIGN` button top right
- Campaign cards/list with status pills (Draft / Open / Closed / Completed)
- `NEW CAMPAIGN` → opens modal form:
  - Title (text, required)
  - Product (text, required)
  - Type: Paid / Free / Gifted (dropdown)
  - Budget in ₹ (number, shows only if Paid)
  - Deliverables (tag input — press Enter to add each item)
  - Deadline (date picker)
  - Eligible Tiers (multi-checkbox — Core Creator / Campaign Creator / VCC Community)
  - Max Creators (number, optional)
  - Save as Draft / Publish buttons
- Campaign actions: Edit / Publish / Close / Delete
- Campaign detail view → list of assigned creators with their status

---

**QR TOKENS PAGE:**
- Page title: `QR TOKENS`
- `+ GENERATE TOKEN` button
- Form to generate:
  - Label (text — describe the token, e.g. "Oct 13 Event QR")
  - Event token toggle: Yes/No (if Yes → max_uses = 50 by default, editable)
  - Max uses (number — 1 for individual, 50 for event)
  - Expiry date (date picker)
  - Generate button
- After generation: card shown with:
  - QR code image (renders the URL: `vcreatorclub.in/join?token=<token>`)
  - Full URL text (copyable)
  - Download QR as PNG button
  - Token label + expiry + used/max count
- Tokens list: all tokens with status — active / expired / exhausted
- For the Oct 13 event: generate 1 token with label "Oct 13 Event — Sage & Lavender", max_uses = 50, expiry = Oct 14 2026 midnight

---

## PART H — ENROLLMENT FLOW (END TO END)

```
[ADMIN] Admin logs into vcreatorclub.in/admin
        ↓
[ADMIN] Goes to QR Tokens page
        ↓
[ADMIN] Generates 1 event token:
        Label: "Oct 13 Event — Sage & Lavender"
        Max uses: 50
        Expiry: Oct 14, 2026 11:59 PM
        ↓
[ADMIN] Downloads QR code PNG → prints it → places at check-in desk on Oct 13
        ↓
[CREATOR] Arrives at event → scans QR code with phone camera
          ↓
[SYSTEM] Token validated → form unlocks (if invalid/expired → error screen)
          ↓
[CREATOR] Fills Step 1 (Personal) → Step 2 (Social) → Step 3 (Content)
          ↓
[SYSTEM] Auto-saves draft every 30 seconds to localStorage + Supabase
          ↓
[CREATOR] Clicks "Submit & Sign in with Google"
          ↓
[SYSTEM] Google OAuth → Supabase creates auth.users record
          ↓
[SYSTEM] creator_profiles row inserted (status: pending, tier: vcc_community)
          ↓
[SYSTEM] enrollment_tokens.used_count incremented by 1
          ↓
[CREATOR] Sees success screen: "Application under review"
          ↓
[ADMIN] Reviews in Creator Roster table
        ↓
[ADMIN] Clicks Approve → creator_profiles.status = 'approved'
        ↓
[SYSTEM] Notification sent to creator: "Your VCC application has been approved!"
        ↓
[CREATOR] Logs into vcreatorclub.in/dashboard → sees full dashboard
```

---

## PART I — SECURITY RULES

### I1. Route Protection (middleware.ts)

```typescript
// Protect /dashboard → requires Google auth
// Protect /admin → requires Google auth + admin_users record
// /join → public but token-gated via server-side check
// / → fully public
```

### I2. Token Security

- Token format: `vcc-` prefix + 32-character hash
- Generated server-side only (never client-side)
- Stored in Supabase with expiry and max_uses
- Validated server-side on every /join page load
- `used_count` incremented atomically on successful submission
- No token reuse possible — system checks `used_count >= max_uses`

### I3. RLS Summary

| Table | Creator Access | Admin Access |
|---|---|---|
| creator_profiles | Own row only | All rows |
| enrollment_tokens | Read valid tokens | Full CRUD |
| campaigns | Read open campaigns (if approved + correct tier) | Full CRUD |
| campaign_assignments | Own rows only | Full CRUD |
| notifications | Own rows only | Full CRUD |
| admin_users | Read admin list | Super admin manages |

### I4. Input Validation

All form inputs must be validated with Zod schemas on both client (before submit) and server (in API routes). No raw SQL queries — use Supabase client library only. No user input injected into any query string directly.

### I5. Rate Limiting

API routes that accept public POST requests (`/api/enrollment/draft`, `/api/tokens/validate`) must implement basic rate limiting: maximum 20 requests per minute per IP. Use in-memory rate limiter for initial build — can be upgraded to Redis at scale.

---

## PART J — CONTENT AND LANGUAGE RULES

These are non-negotiable. Any UI text that violates these rules must be corrected before the site goes live.

### J1. Banned Words / Phrases (anywhere on the site)

- "guaranteed"
- "assured"
- "committed to"
- "will receive"
- "you will get"
- "exclusive rights"
- "contract"
- Any language implying legal obligation

### J2. Correct Replacement Language

| Instead of | Use |
|---|---|
| "You will receive a free device" | "Priority consideration for Vivo device access" |
| "Guaranteed collaboration" | "Priority consideration for campaign collaborations" |
| "Exclusive access" | "Priority access, subject to program terms" |
| "VCC commits to..." | "VCC aims to offer..." |

### J3. Disclaimer (required on landing page and enrollment form)

`"Benefits are directional and subject to program terms. No commitments or assurances are made by FTPL or Vivo India."`

### J4. Logo Usage

- VCC logo (blue V-emblem): ✅ Use on all pages
- Vivo corporate logo or "vivo" wordmark: ❌ Do not use anywhere
- Vivo India reference in text (e.g. "Vivo India Super Stockist"): ✅ Allowed
- vcreatorclub.in domain: ✅ Only domain used in all links and references
- vcc.vivo.com: ❌ This is not our domain. Never reference it.

### J5. Program Identity

- The program is run by FTPL — not Vivo India directly
- Tagline approved: "A Creator Initiative by FTPL · Tamil Nadu"
- "Powered by Fangs Technology Pvt Ltd — Authorised Vivo India Super Stockist, Tamil Nadu"

---

## PART K — PHASED DELIVERY

### PHASE 1 — Must be live by October 12, 2026 (event is Oct 13)

| Priority | What to build | Why |
|---|---|---|
| 1 | Supabase schema (all SQL from Part D) | Foundation for everything |
| 2 | Google OAuth configuration | Login won't work without this |
| 3 | Next.js project + design system | Scaffold |
| 4 | Landing page ( / ) | Creators need to see something when they visit |
| 5 | Enrollment form ( /join?token=xxx ) | Core function of the event |
| 6 | Admin seed endpoint | SK needs admin access |
| 7 | Admin QR Tokens page only | SK needs to generate event QR on Oct 12 |
| 8 | Vercel deploy + Hostinger DNS | Site must be live |

**Minimum viable for Oct 13:** Items 1–8 above. Creator dashboard and full admin panel are not required for the event to run.

### PHASE 2 — After October 15, 2026

| What to build |
|---|
| Creator dashboard (home, campaigns, profile, notifications tabs) |
| Full admin panel (creator roster, approvals, campaign management) |
| Individual QR token generation (for future remote enrollments) |
| Campaign assignment workflow |

---

## PART L — FIRST ADMIN SETUP

After deployment, SK does this once:

1. Add to Vercel environment variables: `ADMIN_SEED_SECRET=<chosen_string>`
2. Open vcreatorclub.in → Click "JOIN VCC" → sign in with Google (this creates your auth record)
3. In browser, visit: `https://vcreatorclub.in/api/admin/seed?secret=<chosen_string>&name=SK&role=super_admin`
4. If successful, you see: `{ "success": true, "message": "Admin SK seeded as super_admin" }`
5. Go to vcreatorclub.in/admin — you now have full admin access
6. Disable or delete the seed endpoint after use (comment it out and redeploy)

Build the seed endpoint at `app/api/admin/seed/route.ts`. It must:
- Check the `secret` query param against `ADMIN_SEED_SECRET` env variable
- Require the user to be logged in (session must exist)
- Insert into `admin_users` with the provided name and role
- Return success or descriptive error
- Never expose the secret in any response

---

## PART M — WHAT SK DOES HIMSELF (NON-DELEGATABLE)

| Task | When |
|---|---|
| Complete Google OAuth on console.cloud.google.com | Before handing over to developer |
| Share Google Client ID and Client Secret with developer | Before handing over |
| Run admin seed URL after deploy to get /admin access | Oct 12 |
| Test enrollment form on own phone before event | Oct 12 |
| Generate event QR in admin → download → print | Oct 12 evening |
| Place printed QR at check-in desk on Oct 13 | Oct 13 |

---

## PART N — WHAT NOT TO BUILD / WHAT TO AVOID

| Do NOT include | Reason |
|---|---|
| Password-based login | Google OAuth only — simpler and more secure |
| Social links in footer | Not needed at this stage |
| Public creator listings or profiles | Private program — creators do not see each other |
| Any reference to vcc.vivo.com | Not our domain |
| Vivo logo or wordmark | No authorization obtained |
| Hardcoded notification content | All notifications come from admin only |
| Any "Coming Soon" placeholder pages in nav | Hide features not yet built — do not show empty pages |
| Payment processing | No payments in this version |
| Creator-to-creator chat or social features | Not in scope |
| Any analytics or tracking scripts | Not in Phase 1 or 2 scope |

---

## PART O — HANDOVER CHECKLIST FOR DEVELOPER

Before calling Phase 1 complete, verify every item below:

- [ ] Supabase project created, all SQL from Part D executed successfully
- [ ] Google OAuth configured in Supabase with correct redirect URLs
- [ ] `.env.local` populated with all 5 variables
- [ ] Next.js project builds without TypeScript errors
- [ ] Tailwind VCC color tokens applied
- [ ] Landing page renders correctly on mobile (390px) and desktop
- [ ] Enrollment form opens only when valid token is in URL
- [ ] Invalid/expired token shows correct error screen
- [ ] All 3 form steps navigate forward and back correctly
- [ ] Auto-save indicator updates when save occurs
- [ ] Google sign-in works and creates user in Supabase auth
- [ ] Form submission creates row in creator_profiles (status: pending)
- [ ] Success screen appears after submission
- [ ] Admin seed endpoint works — SK can access /admin
- [ ] QR token generation works — token stored in Supabase
- [ ] QR code displays correctly and downloads as PNG
- [ ] QR URL resolves to `vcreatorclub.in/join?token=<token>`
- [ ] Vercel deployment live on vcreatorclub.in
- [ ] vcreatorclub.in loads over HTTPS (no certificate warning)
- [ ] No Vivo logo anywhere on the site
- [ ] No assurance language anywhere on the site
- [ ] No hardcoded notification content

---

*END OF DEVELOPER HANDOVER DOCUMENT*
*Project: VCC Creator Portal | vcreatorclub.in*
*Owner: SK (Sathish K), Marketing Manager, FTPL Tamil Nadu*
*Prepared: October 10, 2026 | Event: October 13, 2026*
*Zero hallucination policy — all information in this document is confirmed and approved by SK.*
