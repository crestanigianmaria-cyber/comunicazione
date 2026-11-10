-- ==============================================================================
-- SCHEMA POSTGRESQL & SUPABASE - DIGITAL WAREHOUSE MANAGEMENT SYSTEM (MAGAZZINO)
-- Azienda Materiali Edili - Gestione e Trasmissione Ordini Magazzino / Ufficio
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. SEQUENZA NUMERAZIONE ORDINI ATOMICA E SICURA CONTRO LE COLLISIONI
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1 INCREMENT BY 1;

-- Funzione per generare identificativo formattato es. 'ORD-000001'
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'ORD-' || LPAD(nextval('order_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. TABELLA PRODUCTS (CATALOGO ARTICOLI DA EXCEL)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE, -- Conserva zeri iniziali (es. '001001')
  description TEXT NOT NULL,
  unit_of_measure TEXT NOT NULL, -- es. 'PZ', 'KG', 'ML', 'MQ', 'MC', 'CF'
  alternative_code TEXT, -- Codice alternativo, fornitore o barcode
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indici per ricerca istantanea su codice, descrizione e codice alternativo
CREATE INDEX IF NOT EXISTS idx_products_code ON products (code);
CREATE INDEX IF NOT EXISTS idx_products_description ON products USING gin(to_tsvector('italian', description));
CREATE INDEX IF NOT EXISTS idx_products_alternative_code ON products (alternative_code);

-- 4. TABELLA ORDERS (TESTATE ORDINI)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL UNIQUE, -- es. ORD-000001
  customer_reference TEXT, -- Campo facoltativo: cliente / cantiere / targa
  status TEXT NOT NULL DEFAULT 'NUOVO' CHECK (status IN ('NUOVO', 'PRESO IN CARICO', 'COMPLETATO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger per auto-generazione atomica del numero d'ordine
DROP TRIGGER IF EXISTS trg_generate_order_number ON orders;
CREATE TRIGGER trg_generate_order_number
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION generate_order_number();

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

-- 5. TABELLA ORDER_ITEMS (RIGHE ORDINE CON SNAPSHOT STORICO DATI)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT,
  product_code_snapshot TEXT NOT NULL, -- Preserva codice originale al momento dell'ordine
  product_description_snapshot TEXT NOT NULL, -- Preserva descrizione
  unit_of_measure_snapshot TEXT NOT NULL, -- Preserva UM
  alternative_code_snapshot TEXT, -- Preserva codice alternativo
  quantity NUMERIC(10, 3) NOT NULL CHECK (quantity > 0), -- Supporta decimali es. 2.500 ML
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);

-- 6. FUNZIONE TRIGGER PER AGGIORNAMENTO AUTOMATICO DI UPDATED_AT
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- 7. ROW LEVEL SECURITY (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Politiche di accesso aperte ad anon/authenticated per applicazione aziendale interna
-- (Personalizzabile con ruoli Supabase Auth JWT)
DROP POLICY IF EXISTS "Lettura prodotti aperta" ON products;
CREATE POLICY "Lettura prodotti aperta" ON products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Scrittura prodotti magazzino e ufficio" ON products;
CREATE POLICY "Scrittura prodotti magazzino e ufficio" ON products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lettura ordini magazzino e ufficio" ON orders;
CREATE POLICY "Lettura ordini magazzino e ufficio" ON orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Inserimento ordini magazzino" ON orders;
CREATE POLICY "Inserimento ordini magazzino" ON orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Aggiornamento ordini ufficio" ON orders;
CREATE POLICY "Aggiornamento ordini ufficio" ON orders FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lettura righe ordine" ON order_items;
CREATE POLICY "Lettura righe ordine" ON order_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Inserimento righe ordine" ON order_items;
CREATE POLICY "Inserimento righe ordine" ON order_items FOR INSERT WITH CHECK (true);

-- 8. PUBBLICAZIONE SUPABASE REALTIME
-- Consente l'aggiornamento automatico istantaneo senza ricaricare la pagina
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE orders, order_items;
COMMIT;

-- ==============================================================================
-- FINE SCRIPT DDL
-- ==============================================================================
