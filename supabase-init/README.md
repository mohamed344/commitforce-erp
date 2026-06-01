# supabase-init

Foundational database schema for the CommitForce / IMAB ERP. These files are the
**source of truth** for the initial DB and are meant to be applied to the Supabase
project behind `NEXT_PUBLIC_SUPABASE_URL` (currently `xrjkckpchaanapyhyrbt`).

> **Status:** all files below have been **applied to `xrjkckpchaanapyhyrbt`** via the
> Supabase Management API (the connected MCP is on a different account and can't reach
> this project). They remain the source of truth — re-running them is safe (idempotent),
> and you can apply them to a fresh project with either option below.

## Apply order

Run the files in numeric order:

| File | Contents |
|------|----------|
| `01_organizations.sql` | `organizations` (tenants) + `pgcrypto` |
| `02_profiles.sql`      | `profiles` (1:1 with `auth.users`) + auto-provision trigger |
| `03_roles.sql`         | `roles`, `user_roles` (basic RBAC) + role seed |
| `04_modules.sql`       | `modules` catalog + `org_modules` (per-org toggles) |
| `05_rls.sql`           | RLS helpers (`current_org_id`, `is_org_admin`) + policies |
| `06_multitenant.sql`   | Multi-enterprise: membership-based org access, `create_organization` / `set_active_organization` RPCs, creator trigger, `set_updated_at` |
| `07_projects.sql`      | `projects` (enterprise-scoped) |
| `08_categories.sql`    | `categories` (Item Groups; optional parent tree) |
| `09_item_attributes.sql` | `item_attributes` + `item_attribute_values` (the "caractéristiques") |
| `10_items.sql`         | `items` (Template/Variant) + `template_attributes` + `item_variant_attributes` |
| `11_domain_rls.sql`    | Per-enterprise RLS for all domain tables |
| `12_rename_to_companies.sql` | Finalizes naming: `organizations`→`companies`, `org_id`→`company_id`, `org_modules`→`company_modules`, helper fns→`current_company_id`/`is_company_member`/`is_company_admin`, RPCs→`create_company`/`set_active_company` |
| `13_profile_phone.sql` | Adds `profiles.phone`; signup trigger captures full_name + phone |
| `14_storage_company_logos.sql` | Public `company-logos` storage bucket + policies |
| `15_leads.sql`         | CRM `leads` pipeline (stage New→Lost) + RLS |
| `16_company_defaults.sql` | Defaults `company_id` to `current_company_id()` on domain tables |
| `17_demo_seed.sql`     | Demo Projects / Stock / CRM data (per active company) |
| `18_stock_master.sql`  | `brands`, `uoms`, `warehouses` + `items` enrichment + `item_specs` |
| `19_stock_movements.sql` | `stock_entries` + `stock_entry_lines` + signed `stock_ledger_entries` (trigger) + `stock_balances` view |
| `20_batches_serial_prices.sql` | `batches`, `serial_nos`, `price_lists`, `item_prices` |
| `21_stock_seed.sql`    | Realistic IMAB electrical inventory (brands/units/warehouses/items/specs/entries/prices) |
| `22_project_items.sql` | `project_items` (products + quantities per project) + RLS + demo link |
| `99_seed.sql`          | Default company + the 8-module catalog |

> Files 01–11 create the entity as `organizations`/`org_id`; **12 renames it to `companies`/`company_id`**. Run 01→12 in order on a fresh DB. The entity is ERPNext's "Company".

### Option A — Supabase SQL editor (quickest)
Open the project → **SQL Editor** → paste each file's contents in order → **Run**.

### Option B — Supabase CLI
```bash
supabase link --project-ref xrjkckpchaanapyhyrbt
# then run each file, e.g.:
psql "$DATABASE_URL" -f supabase-init/01_organizations.sql
# ... 02, 03, 04, 05, 99
```

All scripts are idempotent (`if not exists` / `on conflict do nothing` /
`drop policy if exists`), so re-running them is safe.

## Relationship to the app

Module enable/disable is currently driven by **env vars** (`NEXT_PUBLIC_MODULE_*`,
see `config/modules.ts`). The `modules` / `org_modules` tables are the canonical
catalog and the future home for runtime, per-organization toggles.

## ERPNext inspiration (future work)

The launcher dashboard is the green-branded equivalent of **ERPNext's workspace home**.
The mapping we'll follow as modules graduate from "in development":

- ERPNext **workspaces** → our module launcher (`config/modules.ts` + `public.modules`).
- ERPNext **doctypes** → future per-module tables, e.g.
  - Stock → `items`, `warehouses`, `stock_entries`
  - Selling → `customers`, `sales_orders`, `sales_invoices`
  - Buying → `suppliers`, `purchase_orders`
  - HR → `employees`, `leave_requests`
  - Projects → `projects`, `tasks`, `timesheets`
- ERPNext **roles & permissions** → `roles` / `user_roles` + RLS.

Only the foundational tables above exist today; the per-module schemas are added
module-by-module later.
