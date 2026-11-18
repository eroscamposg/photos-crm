# Photographer CRM

A Next.js studio desk for one photographer. Staff sign in with email and password. Clients never need an account: they open a gallery link, optionally enter a password, and download only the tiers that link allows.

The data model is tenant-ready. Every business table has a `studioId`. The running app uses one seeded studio, resolved from the staff session or from a public slug, gallery token, or portfolio slug. It does not trust a studio id sent by the browser.

## What you can do

- Set the studio name, accent, and logo.
- Upload JPEG, WebP, and HEIC. Originals go to R2 with a presigned PUT at `originals/{studioId}/{assetId}`. A separate worker makes a thumbnail, a web JPEG, and a watermarked preview. The Next.js server does not proxy photo bytes.
- Publish portfolio collections, or keep them as drafts. Published collections have basic title and description metadata.
- Set weekly hours, close or specially open a date, and take booking requests only on dates those rules leave open.
- Build a gallery, sort photos, set a download tier per photo, and share `/g/[token]` with an optional password, expiry, and its own display name, logo, and accent.
- Crop, rotate, and adjust exposure, contrast, and color in the browser. Saving stores a JSON recipe. The worker renders a new JPEG and attaches it. The original object is not rewritten.

## Run it locally

Postgres is required. Docker is the default if nothing is already listening on port 5432:

```bash
docker compose up -d
cp .env.example .env
npm install
npm run db:generate   # only when src/db/schema.ts changes
npm run db:migrate
npm run db:seed
npm run dev
```

In another terminal, start the image worker:

```bash
npm run worker
```

The worker waits quietly when R2 is not configured. Uploads also refuse until the R2 variables are set.

Open http://localhost:3000.

### Demo login

Local seed only:

- Email: `owner@atelier.local`
- Password: `AtelierDemo123!`

The seeded studio is Atelier North (`atelier-north`). Weekday hours are Monday–Friday 9:00–17:00 and Saturday 10:00–14:00. Sunday is closed. Portrait (60 min) and Family (90 min) session types are included.

## Environment

Copy `.env.example`. Do not commit `.env`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres. Local docker default is `postgres://photo:photo@localhost:5432/photocrm`. Point this at Neon when you have real credentials. The app does not ship any. |
| `BETTER_AUTH_SECRET` | Session signing secret. |
| `BETTER_AUTH_URL` | Public origin, `http://localhost:3000` in dev. |
| `PUBLIC_STUDIO_SLUG` | Slug used by the portfolio and booking pages. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Cloudflare R2 via the S3 API. Health reports `storage: "not_configured"` when these are empty. |
| `R2_PUBLIC_BASE_URL` | Optional CDN host. Reads are signed either way. |
| `RESEND_API_KEY`, `RESEND_FROM` | Booking email. Without a key, the app logs the message and continues. |

The bucket needs CORS that allows `PUT` and `GET` from the app origin, with `Content-Type` allowed, or browser uploads fail before the file reaches R2.

## Build steps

1. Staff signs in. The session is matched to a membership. That membership's studio is the only studio id used on staff queries.
2. An upload creates an `assets` row, returns a presigned PUT, then enqueues a `derivatives` job after the object exists.
3. `worker/` downloads the original with the S3 API, writes `thumbs/`, `web/`, and `watermarked/` with sharp, and marks the asset ready.
4. Publishing a collection makes it visible at `/portfolio/[slug]`.
5. The public booking page builds slots from weekly rules, date overrides, and existing bookings. It rate-limits requests and sends mail through Resend when configured.
6. A gallery link stores the token, expiry, password hash, and brand. Downloads check the token, password cookie, expiry, and per-photo tier, write a `download_audits` row, and return a 60-second signed URL.
7. The editor saves `edit_recipes`. The worker renders the JPEG onto a new derivative and adds it to the gallery.

## Backups

```bash
npm run backup
```

That runs `pg_dump "$DATABASE_URL" -Fc` into `backups/`. Restore with `pg_restore`. Keep those dumps with the R2 bucket; the database does not contain the photo bytes.

## Checks

```bash
npm run typecheck
npm run build
curl http://localhost:3000/api/health
```

Health returns `app`, `database`, and `storage`. Storage is `not_configured` until R2 env vars are present, then `ok` or `error` after a bucket head request.
