# Crownify

Full-stack e-commerce web app. Node.js/Express JSON API + MongoDB on the backend, React 19 SPA (Vite) on the frontend, with server-side rendering for key public pages.

## Features

**Storefront**
- Browse shop, brands, and product detail pages
- Cart, wishlist, checkout with saved addresses
- Coupons, wallet balance, order history, order modification/cancellation
- Email/password signup and Google OAuth login
- Contact form
- PDF invoices

**Admin panel** (`/api/admin/*`)
- Products, categories, brands (image upload via Multer, processing via Sharp, storage on Cloudinary)
- Customers, orders, coupons, contact messages
- Sales reports (Excel export via `xlsx`, PDF via `pdfkit`) and top-selling stats

**Payments:** Razorpay.

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Node.js 22, Express 4, Mongoose 8, MongoDB |
| Auth & session | `express-session` + `connect-mongo`, Passport (Google OAuth 2.0), bcrypt, CSRF middleware |
| Security | Helmet, `express-rate-limit`, `nocache` on API routes |
| Services | Razorpay, Cloudinary, Nodemailer |
| Frontend | React 19, Vite 8, React Router 7, TanStack Query, Radix UI, Recharts, Sonner |
| Rendering | SSR for `/`, `/shop`, `/brand`, `/product/:id`; SPA shell for all other routes |
| Testing | Jest + Supertest + mongodb-memory-server (backend), Vitest + Testing Library (client), Playwright (e2e) |
| Deploy | Render (`render.yaml`), GitHub Actions CI |

## Project Structure

```text
.
├── src/                      # Express backend
│   ├── server.js             # Entry point (listens on PORT, default 3000)
│   ├── app.js                # Middleware, route mounting, SPA/SSR serving
│   ├── modules/              # One folder per domain: routes, controllers, services, schemas
│   │   ├── user, profile, address, wishlist, wallet
│   │   ├── product, category, brand, topselling
│   │   ├── cart, checkout, order, payment, coupon
│   │   └── admin, customer, report, contact
│   ├── shared/               # config (db, passport), middlewares (csrf), utils
│   └── ssr/                  # renderPage: server-side rendering bridge
├── client/                   # React frontend (separate package.json)
│   └── src/
│       ├── features/         # address, admin, auth, brand, cart, checkout, coupon,
│       │                     # order, pages, payment, product, profile, wallet, wishlist
│       ├── components/  lib/  store/  styles/
│       ├── router.jsx        # Client routes
│       ├── main.jsx          # Browser entry
│       └── entry-server.jsx  # SSR entry
├── public/                   # Static assets, uploads, generated invoices
├── scripts/                  # Asset tooling (WebP conversion, unused-asset and CSS ref audits)
├── tests/                    # unit/, integration/, e2e/, setup/
├── playwright.config.js
├── render.yaml               # Render deploy blueprint
└── .github/workflows/test.yml
```

The API is mounted under `/api` (storefront) and `/api/admin` (admin). Unknown `/api/*` routes return `404 { success: false, message: "Not found" }`. Any non-API path falls through to the React app.

## Prerequisites

- Node.js 22+ and npm
- MongoDB (local or Atlas)
- Accounts/keys for Razorpay, Cloudinary, Google OAuth, and an SMTP-capable email account (Nodemailer)

## Setup

```bash
# 1. Install backend deps
npm install

# 2. Install client deps
cd client && npm install && cd ..

# 3. Create .env in the project root (see below)
```

### Environment variables

Create `.env` in the project root. Never commit it (already in `.gitignore`).

| Variable | Purpose |
|---|---|
| `PORT` | Server port (default `3000`) |
| `MONGODB_URI` | MongoDB connection string (also used for session store) |
| `SESSION_SECRET` | Session signing secret |
| `NODEMAILER_EMAIL` / `NODEMAILER_PASSWORD` | Sender account for transactional email |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL (required in production) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay payment keys |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Image hosting |
| `NODE_ENV` | Set `production` to enable secure cookies and `trust proxy` |

## Development

Run backend and client in two terminals:

```bash
npm run dev:server   # nodemon, http://localhost:3000
npm run dev:client   # Vite dev server, http://localhost:5173
```

Vite proxies `/api`, `/uploads`, `/invoices`, `/auth`, `/assets`, and `/js` to `localhost:3000`.

## Production Build & Run

```bash
npm run build   # installs client deps, builds client bundle (client/dist/client) and SSR bundle (client/dist/server)
npm start       # node src/server.js
```

Express serves the built client and falls back to the SPA shell for client-side routes. If SSR fails for an SSR route, it falls back to the static shell.

## Testing

```bash
npm test                    # Backend: Jest (runs in-band, in-memory MongoDB)
cd client && npm test       # Client: Vitest component/unit tests
cd client && npm run lint   # oxlint
npm run test:e2e            # Playwright e2e (needs `npm run build` first)
```

CI (`.github/workflows/test.yml`) runs backend tests, client unit tests, and e2e on push/PR to `master`.

## Deployment (Render)

`render.yaml` defines a free-tier Node web service:

- Build: `npm install && npm run build`
- Start: `npm start`
- Health check: `/`
- Secrets marked `sync: false` (Mongo, mail, Google, Razorpay, Cloudinary) must be set in the Render dashboard. `SESSION_SECRET` is auto-generated.

## Asset Scripts

Run from the project root:

```bash
node scripts/convert-to-webp.js
node scripts/optimize-theme-images.js
node scripts/audit-unused-assets.js
node scripts/check-broken-css-refs.js
```
