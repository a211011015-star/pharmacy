# Qatfah PRO (قطفة) — Full Stack Starter (Supabase + React/Vite)

## Backend (Supabase)
1. Create a new Supabase project.
2. SQL Editor → run: `supabase/000_init.sql`
3. Create a user from Supabase Auth.
4. Insert membership rows in `user_branches` (and set `is_default=true` for one branch).
   - Owner/Admin permissions are already seeded; assign a role in `user_roles` for your user.

## Frontend (React/Vite)
1. `cd web`
2. Copy `.env.example` → `.env` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. `npm i`
4. `npm run dev`

## Core RPC
- `sell_cart_fifo({branch_id, list_ref, payment_method, discount_value, discount_type, customer_name, items:[{product_id,qty}]})`
- `receive_purchase({branch_id, invoice_no, purchase_date, items:[{product_id,qty,unit_cost,expiry_date}]})`
- `open_cash_drawer({branch_id, opening_cash})`
- `close_cash_drawer({branch_id, session_id, counted_cash})`

## Notes
- UI is RTL by default with AR/EN toggle.
- Toast is dark and centered (top-center) with beep (simple oscillator).
- Print Designer Wizard: working first version (drag/resize + save template JSON to DB).

