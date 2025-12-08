# Sruthi CRA Ops

Field operations app for Sruthi Tech Services.

## Tech stack

- React + TypeScript + Vite
- Tailwind CSS
- Supabase (Auth + DB)
- React Query
- React Router

## Setup

1. Install Node.js LTS (v20 recommended).
2. Run:

   ```bash
   npm install
   ```

3. Create `.env.local` in the project root:

   ```env
   VITE_SUPABASE_URL=YOUR_SUPABASE_URL
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ```

4. In Supabase, create the tables as per the SQL from your design (profiles, assignments, sites, denomination_plans, cash_pickups, atm_replenishments, technical_issues, etc).

5. Run locally:

   ```bash
   npm run dev
   ```

6. Deploy to Vercel and configure the same env vars there.
