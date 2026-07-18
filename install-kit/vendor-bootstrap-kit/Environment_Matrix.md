# Environment Matrix

Use this matrix to map the shared CRA OPS build to a specific vendor.

| Environment | Purpose | Supabase URL | Anon Key | Notes |
|---|---|---|---|---|
| Local | Developer workstation |  |  |  |
| Preview | Internal validation |  |  |  |
| Staging | Vendor acceptance |  |  |  |
| Production | Live vendor usage |  |  |  |

## Variables

Required variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Recommended operational values:

- vendor brand name
- deployment label
- support contact reference
- release version

## Secret Handling

- keep production values in a secure secret store
- do not reuse one vendor's keys for another vendor
- rotate keys when the vendor project is reissued
