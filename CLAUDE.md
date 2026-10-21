# Holydeen ERP — Web app (project rules)

Production-grade, multi-tenant-ready ERP. This repo is the web app; the API is the sibling repo
`../holydeenerp-backend` (it has its own CLAUDE.md with the backend rules). Follow these rules in every task.

## Stack
React 18 + Vite + TypeScript, Tailwind CSS + shadcn/ui (Radix), lucide-react, Recharts, TanStack Query and Table,
React Hook Form + Zod, Zustand (global UI/auth state only), React Router v6 with lazy routes, react-i18next
(English + Bangla, Hind Siliguri font), sonner toasts.

## Structure
```
src/app/              providers, router.tsx (lazy, permission-guarded routes), navigation.ts (sidebar/command palette)
src/components/ui/    shadcn components
src/components/common DataTable, PageHeader, FormField + fields, CrudPage, ConfirmDialog, StatusBadge, EmptyState, …
src/features/<module>/ pages, components, api (TanStack Query hooks), schemas (Zod)
src/layouts/ src/hooks/ src/lib/ (api, format, form, export) src/locales/{en,bn}/common.json src/stores/ src/types/
```

## Frontend rules
- Modern SaaS look (Linear / Stripe / Odoo 17): collapsible grouped sidebar, top bar with Ctrl+K command palette,
  branch switcher, notifications, language toggle, dark/light mode, user menu. Fully responsive.
- Reuse the common components: DataTable (server pagination, column visibility, sorting, filters, bulk actions,
  CSV/Excel/PDF export), PageHeader with breadcrumbs, FormDrawer/dialogs, ConfirmDialog, StatusBadge, EmptyState,
  skeletons, sonner toasts.
- Forms: React Hook Form + Zod, inline (translated) errors, submit disabled while saving, keyboard friendly; map
  server field errors with `applyServerErrors`.
- Permission-aware UI: hide/disable menu items, buttons and routes (`usePermission`, `<Can>`, `RequirePermission`).
- Format numbers, money (BDT ৳ default), quantities and dates only through `src/lib/format.ts`; do arithmetic on
  the server (amounts arrive as DECIMAL strings).
- Every user-facing string goes in both `locales/en` and `locales/bn`.
- Accessibility: labels, focus states, keyboard navigation, `aria-*` on icon buttons.
- Lint rules to respect: no setState inside effects (sync during render instead), use `useWatch` not
  `form.watch`, files exporting components shouldn't export other values (fast refresh).

## Workflow rules
- One module at a time. Before coding a module, show a short plan (tables, endpoints, pages) and wait for approval.
- After each module, tell the user exactly how to run and test it.
- Never delete or rewrite working code from earlier modules unless asked.
- Keep code DRY — add shared helpers/components instead of duplicating.
- Before finishing: `npx tsc -p tsconfig.app.json --noEmit`, `npx eslint src`, Prettier on changed files.
