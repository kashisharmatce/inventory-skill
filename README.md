# Inventory Skill Labs

Next.js (App Router, JavaScript) + Supabase rewrite of the original React / Express / MongoDB inventory app.
One admin, one access code. No email accounts, no registration.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ADMIN_PASSCODE` - the access code typed on the login screen (min 6 characters, server-only)
3. Run `supabase/migrations/0001_init.sql` once: Supabase -> SQL Editor -> paste the whole file -> Run.
   Re-running it later keeps your data.
4. `npm run dev` -> http://localhost:3000 and log in with the access code.

No Supabase Auth settings, email provider or service-role key are needed.

## How access control works

- The login screen sends the access code to `/api/admin/login`. The server checks it against `ADMIN_PASSCODE` and sets a
  signed, httpOnly session cookie (7 days). 5 wrong codes per IP lock that IP for 15 minutes.
- Every `/api` route and page checks that cookie.
- The server talks to Supabase with the public anon key plus an `x-admin-key` header carrying the passcode. The row
  level security policies only accept a request whose header hashes to the value stored in `private.inv_config`, so
  the anon key on its own can read and write nothing.

### Change the passcode

1. Set the new `ADMIN_PASSCODE` in `.env.local` and restart the server (this also logs everyone out).
2. In the Supabase SQL Editor run:

```sql
update private.inv_config
   set value = encode(sha256(convert_to('YOUR-NEW-PASSCODE', 'utf8')), 'hex')
 where key = 'admin_passcode_hash';
```

## Structure

```
supabase/migrations/     0001_init.sql: tables, access policies, stock functions
src/middleware.js        page protection (session cookie)
src/app/(auth)/          /login
src/app/(app)/           /dashboard, /inventory, /user-track (shared sidebar layout)
src/app/api/             route handlers: admin (login/logout), storage (products), user
src/services/            server-only business logic (auth / product / user) + dashboard data seam
src/lib/                 session cookie, passcode check, Supabase client, validators, helpers
src/components/          UI, grouped by feature
```

## API (JSON; everything except login/logout needs the session cookie)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/admin/login` `{ passcode }`, `/api/admin/logout` | |
| GET / POST | `/api/storage` | products |
| GET / PUT / DELETE | `/api/storage/:id` | |
| GET / POST | `/api/user` | POST creates the user, components and deducts stock in one transaction |
| GET / PUT / DELETE | `/api/user/:id` | |

## Notes

- Dashboard/summary cards and the chart currently use dummy data (`src/lib/dummyData.js`, served via `src/services/dashboard.js`).
