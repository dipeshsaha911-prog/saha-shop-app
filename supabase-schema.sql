-- ============================================================
-- WINE SHOP MANAGEMENT SYSTEM — SUPABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── 1. PROFILES (Partner accounts, extends Supabase Auth) ──
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'partner' CHECK (role IN ('admin', 'partner')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.raw_user_meta_data->>'role', 'partner'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── 2. INVENTORY ──
CREATE TABLE inventory (
  id           BIGSERIAL PRIMARY KEY,
  brand        TEXT NOT NULL,
  category     TEXT NOT NULL,  -- e.g. 'Red Wine', 'Beer', 'Whisky', 'Vodka', 'Rum'
  size         TEXT NOT NULL,  -- e.g. '750ml', '650ml', '180ml'
  buying_price NUMERIC(10,2) NOT NULL CHECK (buying_price > 0),
  selling_price NUMERIC(10,2) NOT NULL CHECK (selling_price > buying_price),
  stock        INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. PRICE HISTORY (Audit log for every price change) ──
CREATE TABLE price_history (
  id              BIGSERIAL PRIMARY KEY,
  inventory_id    BIGINT NOT NULL REFERENCES inventory(id),
  old_buying_price  NUMERIC(10,2),
  new_buying_price  NUMERIC(10,2),
  old_selling_price NUMERIC(10,2),
  new_selling_price NUMERIC(10,2),
  changed_by      UUID NOT NULL REFERENCES profiles(id),
  changed_at      TIMESTAMPTZ DEFAULT now(),
  reason          TEXT
);

-- Auto-record price changes
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.buying_price <> NEW.buying_price OR OLD.selling_price <> NEW.selling_price) THEN
    INSERT INTO price_history (inventory_id, old_buying_price, new_buying_price, old_selling_price, new_selling_price, changed_by)
    VALUES (OLD.id, OLD.buying_price, NEW.buying_price, OLD.selling_price, NEW.selling_price, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_price_change
  AFTER UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION log_price_change();

-- ── 4. SALES ──
CREATE TABLE sales (
  id             BIGSERIAL PRIMARY KEY,
  inventory_id   BIGINT NOT NULL REFERENCES inventory(id),
  brand_snapshot TEXT NOT NULL,   -- denormalized brand name at time of sale
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  unit_price     NUMERIC(10,2) NOT NULL,  -- selling price at time of sale
  unit_cost      NUMERIC(10,2) NOT NULL,  -- buying price at time of sale (for profit calc)
  total_amount   NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  profit         NUMERIC(10,2) GENERATED ALWAYS AS (quantity * (unit_price - unit_cost)) STORED,
  sold_by        UUID NOT NULL REFERENCES profiles(id),
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Automatically deduct stock on sale insert
CREATE OR REPLACE FUNCTION deduct_stock_on_sale()
RETURNS TRIGGER AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  SELECT stock INTO current_stock FROM inventory WHERE id = NEW.inventory_id FOR UPDATE;
  IF current_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock: % units available, % requested', current_stock, NEW.quantity;
  END IF;
  UPDATE inventory SET stock = stock - NEW.quantity WHERE id = NEW.inventory_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_sale_insert
  BEFORE INSERT ON sales
  FOR EACH ROW EXECUTE FUNCTION deduct_stock_on_sale();

-- ── 5. RESTOCK ──
CREATE TABLE restocks (
  id             BIGSERIAL PRIMARY KEY,
  inventory_id   BIGINT NOT NULL REFERENCES inventory(id),
  brand_snapshot TEXT NOT NULL,
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost      NUMERIC(10,2) NOT NULL,   -- buying price at time of restock
  total_cost     NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  invoice_number TEXT,
  supplier       TEXT,
  restocked_by   UUID NOT NULL REFERENCES profiles(id),
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Automatically ADD stock on restock insert
CREATE OR REPLACE FUNCTION add_stock_on_restock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory SET stock = stock + NEW.quantity WHERE id = NEW.inventory_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_restock_insert
  BEFORE INSERT ON restocks
  FOR EACH ROW EXECUTE FUNCTION add_stock_on_restock();

-- ── 6. USEFUL VIEWS ──

-- Dashboard summary view
CREATE VIEW daily_sales_summary AS
SELECT
  DATE(created_at AT TIME ZONE 'Asia/Kolkata') AS sale_date,
  COUNT(*) AS transaction_count,
  SUM(quantity) AS total_units_sold,
  SUM(total_amount) AS total_revenue,
  SUM(profit) AS total_profit,
  ROUND(SUM(profit) / NULLIF(SUM(total_amount), 0) * 100, 2) AS margin_pct
FROM sales
GROUP BY sale_date
ORDER BY sale_date DESC;

-- Low stock alert view
CREATE VIEW low_stock_alerts AS
SELECT id, brand, category, size, stock, low_stock_threshold, selling_price
FROM inventory
WHERE stock < low_stock_threshold AND is_active = true
ORDER BY stock ASC;

-- ── 7. ROW LEVEL SECURITY ──
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales       ENABLE ROW LEVEL SECURITY;
ALTER TABLE restocks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- All authenticated partners can read everything
CREATE POLICY "Partners can read all" ON inventory      FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Partners can read all" ON sales          FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Partners can read all" ON restocks       FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Partners can read all" ON price_history  FOR SELECT USING (auth.role() = 'authenticated');

-- Partners can insert sales and restocks (stock changes handled by triggers)
CREATE POLICY "Partners can record sales"    ON sales    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Partners can record restocks" ON restocks FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Only admin can update inventory prices and add new items
CREATE POLICY "Admin can manage inventory" ON inventory FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Partners can also update prices (adjust based on your business rule)
CREATE POLICY "Partners can update prices" ON inventory FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── 8. SEED DATA ──
INSERT INTO inventory (brand, category, size, buying_price, selling_price, stock) VALUES
  ('Sula Brut',           'Sparkling',  '750ml', 650,  950,  24),
  ('Grover Chardonnay',   'White Wine', '750ml', 800,  1200,  8),
  ('Fratelli Sangiovese', 'Red Wine',   '750ml', 950,  1400,  5),
  ('Jacob Creek Shiraz',  'Red Wine',   '750ml', 1100, 1700, 12),
  ('Sula Riesling',       'White Wine', '750ml', 700,  1050,  3),
  ('Kingfisher Strong',   'Beer',       '650ml', 70,   110,  120),
  ('Budweiser',           'Beer',       '650ml', 85,   130,   7),
  ('Royal Stag',          'Whisky',     '750ml', 520,  750,  30),
  ('McDowell No.1',       'Whisky',     '750ml', 480,  700,  25),
  ('Old Monk Rum',        'Rum',        '750ml', 350,  500,  18),
  ('Bacardi White',       'Rum',        '750ml', 580,  850,   9),
  ('Absolut Vodka',       'Vodka',      '750ml', 1200, 1800,  2);
