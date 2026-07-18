# Branding Migration Report

Repository scan date: 2026-07-18

## Scope

This report lists hardcoded branding references found in runtime files,
deployment metadata, and the most visible brand-bearing assets. The scan
found no exact literal `Sruthi Tech Services` string in the repository.

## Findings

| File path | Line number | Current value | Recommended generic replacement |
|---|---:|---|---|
| `package.json` | 2 | `"name": "sruthi-cra-ops"` | `"name": "cra-ops"` or a vendor-neutral package name |
| `package-lock.json` | 2, 8 | `"name": "sruthi-cra-ops"` | Replace with the vendor-neutral package name used in `package.json` |
| `index.html` | 5 | `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` | Use a tenant-configured favicon path such as `/brand/favicon.svg` |
| `index.html` | 7 | `<title>Sruthi CRA Ops</title>` | `<title>{PRODUCT_NAME}</title>` |
| `vite.config.ts` | 11 | `name: "Sruthi CRA Ops"` | `name: "{PRODUCT_NAME}"` |
| `vite.config.ts` | 14 | `theme_color: "#0f172a"` | Move to a vendor theme token or configurable color value |
| `vite.config.ts` | 15 | `background_color: "#ffffff"` | Move to a vendor theme token or configurable color value |
| `tailwind.config.js` | 10 | `primary: "#1565C0"` | Replace with a vendor theme token, not a fixed brand color |
| `tailwind.config.js` | 11 | `primary-light: "#42A5F5"` | Replace with a vendor theme token, not a fixed brand color |
| `tailwind.config.js` | 12 | `accent: "#FFC107"` | Replace with a vendor theme token, not a fixed brand color |
| `public/favicon.svg` | n/a | Favicon asset file | Replace with a generic or vendor-branded favicon asset |
| `public/bank-logo.png` | n/a | Bank logo asset file | Replace with a vendor-specific logo asset or neutral brand mark |
| `src/assets/india1-logo.png` | n/a | India1 logo asset file | Replace with a vendor-specific logo asset or neutral brand mark |
| `src/assets/india1-logo.txt` | 1 | `Place this file in src/assets/india1-logo.png (or .svg if available)` / `India1 ATM logo` | Replace with a generic asset note and vendor brand placeholder |
| `src/components/Layout.tsx` | 130 | `Sruthi CRA Ops` | `"{PRODUCT_NAME}"` |
| `src/components/Layout.tsx` | 253 | `<meta name="theme-color" content="#0f172a" />` | Use a tenant-configured theme color value |
| `src/pages/Login.tsx` | 65 | `Sruthi CRA Ops` | `"{PRODUCT_NAME}"` |
| `src/pages/Dashboard.tsx` | 520 | `src="/bank-logo.png"` | Use a tenant-configured logo path |
| `src/pages/Dashboard.tsx` | 526 | `Sruthi CRA Ops` | `"{PRODUCT_NAME}"` |
| `src/pages/Dashboard.tsx` | 1149 | `This is a system-generated report from Sruthi CRA Ops.` | `This is a system-generated report from {PRODUCT_NAME}.` |
| `src/pages/StatementOfAccounts.tsx` | 182 | `const bankLogoSrc = \`${import.meta.env.BASE_URL}bank-logo.png\`;` | Read from a brand config value or tenant asset path |
| `src/pages/StatementOfAccounts.tsx` | 1174 | `Sruthi CRA Ops` | `"{PRODUCT_NAME}"` |
| `src/pages/StatementOfAccounts.tsx` | 2248 | `This is a system-generated report from Sruthi CRA Ops.` | `This is a system-generated report from {PRODUCT_NAME}.` |
| `src/pages/AdminDashboard.tsx` | 260 | `This is a system-generated report from Sruthi CRA Ops. Any discrepancy must be reported within RBI-prescribed timelines.` | Replace with a vendor-neutral report footer |
| `src/pages/AdminEODDetail.tsx` | 552 | `<img src="/bank-logo.png" alt="Bank Logo" ... />` | Use a tenant-configured logo asset and generic alt text |
| `src/pages/AdminEODDetail.tsx` | 554 | `Sruthi CRA Ops` | `"{PRODUCT_NAME}"` |
| `src/pages/AdminEODDetail.tsx` | 1095 | `Sruthi CRA Ops` | `"{PRODUCT_NAME}"` |
| `src/pages/AdminEODDetail.tsx` | 1104 | `This is a system-generated report from Sruthi CRA Ops. Any discrepancy must be reported within RBI-prescribed timelines.` | Replace with a vendor-neutral report footer |
| `src/pages/analytics/AdvancedAnalytics.tsx` | 137 | `const DENOM_COLORS = ["#dc2626", "#2563eb", "#7c3aed", "#059669"];` | Move to configurable brand/chart tokens |
| `src/pages/analytics/AdvancedAnalytics.tsx` | 199 | `<img src="/bank-logo.png" alt="" ... />` | Use a tenant-configured logo asset |
| `src/pages/analytics/AdvancedAnalytics.tsx` | 200 | `Sruthi CRA Ops` | `"{PRODUCT_NAME}"` |
| `src/pages/analytics/AdvancedAnalytics.tsx` | 451 | `Sruthi CRA Ops` | `"{PRODUCT_NAME}"` |
| `src/pages/analytics/AdvancedAnalytics.tsx` | 1055 | `#059669`, `#d97706`, `#dc2626` | Move to configurable status colors |
| `src/pages/analytics/AdvancedAnalytics.tsx` | 1161 | `#2563eb` | Move to configurable chart color token |
| `src/pages/analytics/AdvancedAnalytics.tsx` | 1162 | `#059669` | Move to configurable chart color token |
| `src/pages/analytics/AdvancedAnalytics.tsx` | 1232 | `#2563eb` | Move to configurable chart color token |
| `src/pages/analytics/AdvancedAnalytics.tsx` | 1302 | `#059669`, `#d97706`, `#dc2626` | Move to configurable status colors |
| `src/pages/analytics/AdvancedAnalytics.tsx` | 1375 | `#2563eb` | Move to configurable chart color token |
| `src/pages/analytics/AdvancedAnalytics.tsx` | 1411 | `#d97706` | Move to configurable chart color token |
| `src/pages/analytics/AdvancedAnalytics.tsx` | 1417 | `#dc2626` | Move to configurable chart color token |
| `src/pages/analytics/AdvancedAnalytics.tsx` | 1487 | `#3b82f6` | Move to configurable chart color token |
| `src/pages/analytics/AdvancedAnalytics.tsx` | 1578 | `["#ef4444", "#f59e0b", "#3b82f6", "#10b981"]` | Replace with tenant/theme-driven chart palette |
| `src/pages/EODSummary.tsx` | 1036 | `<img src="/bank-logo.png" alt="Bank Logo" ... />` | Use a tenant-configured logo asset and generic alt text |
| `src/pages/EODSummary.tsx` | 1038 | `SRUTHI CRA OPERATIONS` | `"{PRODUCT_NAME_UPPER}"` |
| `src/pages/EODSummary.tsx` | 1905 | `Sruthi CRA Operations` | `"{PRODUCT_NAME}"` |
| `src/pages/CashTransitCertificate.tsx` | 6 | `import india1Logo from "../assets/india1-logo.png";` | Import a vendor-configured logo asset instead |
| `src/pages/CashTransitCertificate.tsx` | 268 | `alt="India1 ATM Logo"` | `alt="{PRODUCT_NAME} Logo"` or generic `alt="Logo"` |
| `src/pages/CashTransitCertificate.tsx` | 419 | `alt="India1 ATM Logo"` | `alt="{PRODUCT_NAME} Logo"` or generic `alt="Logo"` |
| `src/pages/TravelTracking.tsx` | 380 | `pathOptions={{ color: "#2563eb", weight: 5 }}` | Move to configurable route/line color token |

## Notes

- The visible runtime branding is concentrated in the app shell, login page,
  dashboard, SOA/reporting pages, analytics, and the certificate flow.
- Several chart and status colors are hardcoded directly in components rather
  than sourced from a shared theme token.
- Brand assets are currently referenced by fixed file names such as
  `/bank-logo.png`, `/favicon.svg`, and `india1-logo.png`.

## Supabase Layer Review

The following Supabase user-management functions were reviewed as part of the
branding scan:

- `supabase/functions/create-user/index.ts`
- `supabase/functions/delete-user/index.ts`
- `supabase/functions/reset-user-password/index.ts`

No additional hardcoded references to `Sruthi`, `Sruthi Tech Services`, brand
logos, favicon paths, or company color values were found in these files. The
messages and log strings in this layer are operational rather than branded.

## Recommendation

For white-label rollout, move all product identity into a tenant branding layer:

- product name
- logo asset path
- favicon path
- theme colors
- report footers
- printed document headers

Then resolve them from configuration instead of hardcoded strings or paths.
