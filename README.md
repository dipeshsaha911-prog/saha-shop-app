# Wine Shop Management System

A secure, real-time partner management system for wine shops built with **Next.js 14 + Supabase**.

---

## Folder Structure

```
wine-shop/
├── .env.local                        ← Supabase credentials (never commit!)
├── next.config.js
├── tailwind.config.js
├── package.json
│
├── supabase-schema.sql               ← ⭐ Run this first in Supabase SQL Editor
│
└── src/
    ├── app/
    │   ├── layout.jsx                ← Root layout, global fonts
    │   ├── page.jsx                  ← Redirects to /dashboard
    │   ├── login/page.jsx            ← Auth page
    │   └── (dashboard)/
    │       ├── layout.jsx            ← Sidebar + auth guard
    │       ├── dashboard/page.jsx
    │       ├── inventory/page.jsx
    │       ├── restock/page.jsx
    │       ├── sales/page.jsx
    │       └── reports/page.jsx
    │
    ├── components/
    │   ├── Inventory.jsx             ← ⭐ Inventory table with inline price edit
    │   ├── Restock.jsx               ← ⭐ New stock arrival form
    │   ├── Sales.jsx                 ← ⭐ POS counter + stock deduction
    │   ├── Reports.jsx               ← ⭐ Daily summary + audit log + CSV export
    │   ├── Dashboard.jsx             ← Overview metrics + low stock alerts
    │   ├── Sidebar.jsx               ← Navigation sidebar
    │   └── AuthGuard.jsx             ← Protects routes from unauthenticated access
    │
    ├── hooks/
    │   ├── useAuth.js                ← Auth state + profile
    │   └── useInventory.js           ← Inventory with real-time subscription
    │
    └── lib/
        └── supabaseClient.js         ← ⭐ All Supabase queries + real-time
```

---

## Setup Guide

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Copy your **Project URL** and **anon key** from Settings → API

### 2. Run Database Schema
1. Go to Supabase Dashboard → SQL Editor
2. Paste the contents of `supabase-schema.sql` and run it
3. This creates all tables, triggers, views, and seed data

### 3. Create Partner Accounts
In Supabase Dashboard → Authentication → Users → Add User:
```
arjun@yourshop.com   password: ••••••
priya@yourshop.com   password: ••••••
rahul@yourshop.com   password: ••••••
admin@yourshop.com   password: ••••••
```
After creating each user, update their profile in the `profiles` table:
```sql
UPDATE profiles SET full_name = 'Arjun Mehta', role = 'partner' WHERE id = '<user-id>';
UPDATE profiles SET full_name = 'Admin', role = 'admin' WHERE id = '<admin-user-id>';
```

### 4. Configure Environment
Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### 5. Install & Run
```bash
npm install
npm run dev
# Open http://localhost:3000
```

---

## Key Packages

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "@supabase/supabase-js": "^2.39.0",
    "@supabase/auth-helpers-nextjs": "^0.8.7"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

---

## Database Architecture

### Core Business Logic in Triggers (PostgreSQL)

| Event | Trigger | Effect |
|---|---|---|
| Sale inserted | `on_sale_insert` | Validates stock ≥ qty, then deducts: `stock -= qty` |
| Restock inserted | `on_restock_insert` | Adds: `stock += qty` |
| Price updated | `on_price_change` | Auto-logs old/new prices to `price_history` table |
| User created | `on_auth_user_created` | Creates a `profiles` row |

**Why triggers?** Stock and price changes are 100% consistent even if a network error occurs mid-request. The database enforces the business rules atomically.

### Real-Time Sync Strategy

```
Partner A records a sale
         ↓
Supabase trigger deducts stock (atomic)
         ↓
Postgres NOTIFY fires (Realtime channel)
         ↓
All connected partners receive the event instantly
         ↓
Their inventory state auto-refreshes
```

---

## Key Feature Logic

### Edit Price (Inventory.jsx)
```
User clicks Edit → inline form opens
User enters new buy/sell price → live margin preview shown
User clicks Save → updateItemPrice() called
         ↓
Supabase updates inventory row
DB trigger auto-logs change to price_history (who, when, old→new)
Real-time channel broadcasts change to all partners
```

### New Stock Arrival (Restock.jsx)
```
User selects item + quantity
Preview shows: Old Stock → Old Stock + Qty (before submitting)
User confirms → recordRestock() inserts into restocks table
         ↓
DB trigger fires: inventory.stock += quantity  (atomic)
Local state updated optimistically
Real-time subscription refreshes all partners
```

### Sale / POS (Sales.jsx)
```
User selects brand + quantity
Preview calculates: total, profit, remaining stock
User submits → recordSale() inserts into sales table
         ↓
DB trigger fires: checks stock ≥ qty (throws error if not)
                  inventory.stock -= quantity  (atomic)
If stock was insufficient: trigger raises exception → surfaces as error message
```

---

## Security Notes

- **Row Level Security (RLS)** is enabled on all tables
- Partners can read all data but cannot access other tenants' data if you ever expand
- Only admin role can add new inventory items (adjust in schema per your needs)
- All price changes are audited automatically in `price_history`
- Session tokens are managed by Supabase Auth (JWT, auto-refresh)
- Never expose your `service_role` key in the frontend

---

## CSV Export (for ITR / Audit)

The Reports module exports two CSV files:
1. **Daily Summary CSV** — one row per day: revenue, profit, margin
2. **Full Audit CSV** — every sale + restock with timestamps and partner names

Both CSVs have a UTF-8 BOM so they open correctly in Microsoft Excel with Indian rupee amounts.
