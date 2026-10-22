# Holydeen ERP — Client

Web app for Holydeen ERP: **React 18 + Vite + TypeScript**, Tailwind CSS v4, shadcn/ui (Radix), TanStack Query/Table,
React Hook Form + Zod, Zustand, React Router v6 and react-i18next (English / বাংলা).
The API lives in the separate `holydeen-erp-backend` project. Project rules: see `CLAUDE.md` in this repo.

## Setup

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

Start the backend first (`npm run dev` in `holydeen-erp-backend`). In development Vite proxies `/api` to
`VITE_API_PROXY_TARGET` (default `https://apierp.holydeen.com`), so auth cookies stay same-origin.

## Environment

| Variable                | Default                 | Purpose                              |
| ----------------------- | ----------------------- | ------------------------------------ |
| `VITE_API_URL`          | `/api/v1`               | API base URL used by axios           |
| `VITE_API_PROXY_TARGET` | `https://apierp.holydeen.com` | Dev proxy target                     |
| `VITE_APP_NAME`         | `Holydeen ERP`          | App name                             |
| `VITE_DEFAULT_CURRENCY` | `BDT`                   | Default currency for `lib/format.ts` |
| `VITE_DEFAULT_LOCALE`   | `en`                    | Initial language (`en` or `bn`)      |

## Deploying to Hostinger

1. `.env.production` (git-ignored, read by `npm run build`) must point at the API with absolute URLs:
   `VITE_API_URL=https://apierp.holydeen.com/api/v1` and `VITE_ASSET_URL=https://apierp.holydeen.com`.
   The built site is static — there is no proxy, so a relative `/api/v1` would call the web app's own domain.
2. `npm run build`, then upload the **contents** of `dist/` (including the hidden `.htaccess` files) to the
   site's `public_html`. `public/.htaccess` sends deep links such as `/sales/invoices` to `index.html` (no 404
   on refresh) and keeps `index.html` uncached; `public/assets/.htaccess` caches the hashed bundles for a year.
3. On the API, add the web app's exact origin (e.g. `https://erp.holydeen.com`, with and without `www` if both
   are used) to `CORS_ORIGINS`. While both are subdomains of `holydeen.com` the refresh cookie works with
   `COOKIE_SAMESITE=lax`; on a different domain use `COOKIE_SAMESITE=none`.

## Scripts

| Command                                              | Description                                |
| ---------------------------------------------------- | ------------------------------------------ |
| `npm run dev`                                        | Vite dev server                            |
| `npm run build`                                      | Type-check + production build into `dist/` |
| `npm run preview`                                    | Serve the production build                 |
| `npm run lint` · `lint:fix` · `typecheck` · `format` | ESLint / tsc / Prettier                    |
| `npx shadcn@latest add <component>`                  | Add a shadcn/ui component                  |

## Structure

```
src/
  app/              providers, router (lazy routes), navigation.ts (sidebar + command palette + permissions)
  components/ui     shadcn/ui (generated)
  components/common shared components (PageHeader, EmptyState, PageSkeleton, …)
  features/<module> pages, components, api hooks, schemas
  layouts/          app shell: sidebar, topbar, command palette
  hooks/ lib/       use-permission, api client, query client, i18n, format helpers
  locales/{en,bn}   translations
  stores/           Zustand (settings, auth)
  types/            shared TypeScript types
```

Number, date and currency output goes through `src/lib/format.ts` (default ৳ BDT).

## Authentication

- Pages: `/login` (with 2FA step), `/forgot-password`, `/reset-password/:token`, `/profile`
  (info & photo, password, 2FA, sessions), `/settings/users`, `/settings/roles` and `/settings/roles/:id`
  (permission matrix).
- The access token is kept in memory only; the backend's httpOnly refresh cookie restores the session on
  reload. `src/lib/api.ts` retries a request once after a 401 with a single shared refresh, and sends you to
  `/login` when the session can't be renewed.
- In development the login page lists the seeded demo accounts (password `Password@123`).
- UI permissions: `<Can permission="users.create">…</Can>`, `usePermission().can('…')`, and
  `RequirePermission` for routes.

## Master data

- Inventory: `/inventory/products` (list with filters, bulk "Print labels", Excel import/export),
  `/inventory/products/new` and `/inventory/products/:id` (tabs: General, Pricing + packs, Inventory, Variants,
  Images), `/inventory/categories` (drag & drop tree), `/inventory/brands`, `/inventory/attributes`,
  `/inventory/labels` (barcode labels with jsbarcode — roll sizes or A4 sheets).
- `/sales/customers` and `/purchases/suppliers` (with a Groups tab; the form has General, Credit & balance and
  Addresses tabs).
- `components/common/import-dialog.tsx`: `<ExcelMenu url="/products" …/>` adds import (template → dry-run check
  → import valid rows), template download and server-side Excel export to any page.

