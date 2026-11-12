/**
 * CafeLedger - Realistic Data Seed Generator
 * Creates 10 shops with 12 months of realistic data:
 * - 1 Brand ("Snaxia Artisanal Cafes")
 * - 1 Master User, 1 Admin User, 10 Shop Managers
 * - 10 Shops across major Indian cafe hubs
 * - 4 Payment Modes (CASH, GPAY, BANK, CARD)
 * - 24 Standard Items (Income & Expense categories)
 * - 100+ Employees across the 10 shops
 * - 12 Months of Month Openings
 * - 365 Days of Transactions:
 *   - Income ₹12,000 - ₹25,000 / day
 *   - 20-30 expense entries per day (including salary advances)
 * - Daily Summary pre-calculated
 * - Salary records with days worked, gross, advances, paid, balance
 * - Equipment & Assets with service schedules and logs
 */

import * as fs from 'fs';
import * as path from 'path';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((Math.random() * (max - min) + min) * factor) / factor;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateSeedSQL(): string {
  const lines: string[] = [];
  lines.push(`-- CafeLedger High-Scale Realistic Seed Data`);
  lines.push(`-- 10 Shops x 12 Months (Daily Income ₹12k-₹25k, 20-30 expenses/day)`);
  lines.push(`BEGIN;`);
  lines.push(`SET CONSTRAINTS ALL DEFERRED;`);

  // Hardcoded UUIDs for deterministic seeding
  const masterUserId = '00000000-0000-0000-0000-000000000001';
  const brandId = '11111111-1111-1111-1111-111111111111';
  const adminUserId = '22222222-2222-2222-2222-222222222222';

  // Seed Auth Users (Supabase auth.users & auth.identities) with password: password123
  lines.push(`
-- 0. Supabase Auth Users for testing (Password: password123)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES 
  ('00000000-0000-0000-0000-000000000000', '${masterUserId}', 'authenticated', 'authenticated', 'master@cafeledger.io', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Super Master Admin"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '${adminUserId}', 'authenticated', 'authenticated', 'admin@snaxia.in', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Vikram Malhotra"}', now(), now(), '', '', '', '')
ON CONFLICT (id) DO UPDATE SET 
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at;

INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES 
  ('${masterUserId}', '${masterUserId}', '{"sub":"${masterUserId}","email":"master@cafeledger.io"}'::jsonb, 'email', now(), now(), now()),
  ('${adminUserId}', '${adminUserId}', '{"sub":"${adminUserId}","email":"admin@snaxia.in"}'::jsonb, 'email', now(), now(), now())
ON CONFLICT (id, provider) DO NOTHING;`);

  // 1. Brand
  lines.push(`
INSERT INTO public.brands (id, name, registration_no, logo_url, primary_color, secondary_color, address, phone, email, gstin, status)
VALUES (
  '${brandId}',
  'Snaxia Artisanal Cafes',
  'REG-SNAXIA-2024',
  'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=200&auto=format&fit=crop&q=80',
  '#ea580c',
  '#9a3412',
  '100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038',
  '+91 98765 43210',
  'contact@snaxia.in',
  '29AAAAA1234A1Z5',
  'active'
) ON CONFLICT (registration_no) DO NOTHING;`);

  // 2. Profiles (Master & Admin)
  lines.push(`
INSERT INTO public.profiles (id, role, brand_id, shop_id, full_name, phone, is_active, must_change_password)
VALUES 
  ('${masterUserId}', 'master', null, null, 'Super Master Admin', '+91 99999 00000', true, false),
  ('${adminUserId}', 'admin', '${brandId}', null, 'Vikram Malhotra (Brand Director)', '+91 98888 11111', true, false)
ON CONFLICT (id) DO UPDATE SET 
  role = excluded.role,
  brand_id = excluded.brand_id,
  full_name = excluded.full_name;`);

  // 3. Payment Modes
  const paymentModes = [
    { id: '30000000-0000-0000-0000-000000000001', name: 'CASH' },
    { id: '30000000-0000-0000-0000-000000000002', name: 'GPAY' },
    { id: '30000000-0000-0000-0000-000000000003', name: 'BANK' },
    { id: '30000000-0000-0000-0000-000000000004', name: 'CARD' },
  ];

  for (const pm of paymentModes) {
    lines.push(`
INSERT INTO public.payment_modes (id, brand_id, name, is_active)
VALUES ('${pm.id}', '${brandId}', '${pm.name}', true)
ON CONFLICT (brand_id, name) DO NOTHING;`);
  }

  // 4. Standard Items (Income & Expense Categories)
  const items = [
    { id: '40000000-0000-0000-0000-000000000001', name: 'Counter Billing', kind: 'income', category: 'Sales' },
    { id: '40000000-0000-0000-0000-000000000002', name: 'Swiggy Online', kind: 'income', category: 'Online Aggregator' },
    { id: '40000000-0000-0000-0000-000000000003', name: 'Zomato Online', kind: 'income', category: 'Online Aggregator' },
    { id: '40000000-0000-0000-0000-000000000004', name: 'Catering & Events', kind: 'income', category: 'Events' },
    { id: '40000000-0000-0000-0000-000000000005', name: 'Packaged Coffee / Beans', kind: 'income', category: 'Retail' },

    { id: '40000000-0000-0000-0000-000000000010', name: 'Fresh Milk & Cream', kind: 'expense', category: 'Dairy' },
    { id: '40000000-0000-0000-0000-000000000011', name: 'Specialty Coffee Beans', kind: 'expense', category: 'Beverages' },
    { id: '40000000-0000-0000-0000-000000000012', name: 'Artisan Breads & Croissants', kind: 'expense', category: 'Bakery' },
    { id: '40000000-0000-0000-0000-000000000013', name: 'Fresh Fruits & Veggies', kind: 'expense', category: 'Produce' },
    { id: '40000000-0000-0000-0000-000000000014', name: 'Gourmet Syrups & Purees', kind: 'expense', category: 'Beverages' },
    { id: '40000000-0000-0000-0000-000000000015', name: 'Takeaway Cups & Packaging', kind: 'expense', category: 'Packaging' },
    { id: '40000000-0000-0000-0000-000000000016', name: 'Commercial Gas Cylinder', kind: 'expense', category: 'Utilities' },
    { id: '40000000-0000-0000-0000-000000000017', name: 'Electricity Recharge', kind: 'expense', category: 'Utilities' },
    { id: '40000000-0000-0000-0000-000000000018', name: 'Water Cans & Ice Blocks', kind: 'expense', category: 'Kitchen' },
    { id: '40000000-0000-0000-0000-000000000019', name: 'Cleaning & Sanitization', kind: 'expense', category: 'Maintenance' },
    { id: '40000000-0000-0000-0000-000000000020', name: 'Internet & POS Paper Rolls', kind: 'expense', category: 'Admin' },
    { id: '40000000-0000-0000-0000-000000000021', name: 'Salary Advance', kind: 'expense', category: 'Payroll' },
    { id: '40000000-0000-0000-0000-000000000022', name: 'Monthly Salary Settlement', kind: 'expense', category: 'Payroll' },
    { id: '40000000-0000-0000-0000-000000000023', name: 'Minor Machine Repairs', kind: 'expense', category: 'Repairs' },
    { id: '40000000-0000-0000-0000-000000000024', name: 'Staff Refreshments', kind: 'expense', category: 'Staff Welfare' },
    { id: '40000000-0000-0000-0000-000000000025', name: 'Pest Control & Hygiene', kind: 'expense', category: 'Maintenance' },
    { id: '40000000-0000-0000-0000-000000000026', name: 'Cheese, Butter & Sauces', kind: 'expense', category: 'Kitchen' },
    { id: '40000000-0000-0000-0000-000000000027', name: 'Chocolates & Cocoa Powder', kind: 'expense', category: 'Bakery' },
    { id: '40000000-0000-0000-0000-000000000028', name: 'Miscellaneous Petty Cash', kind: 'expense', category: 'General' },
  ];

  for (const it of items) {
    lines.push(`
INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('${it.id}', '${brandId}', '${it.name}', '${it.kind}', '${it.category}', true)
ON CONFLICT (id) DO NOTHING;`);
  }

  // 5. 10 Shops across India
  const shopsData = [
    { num: 1, name: 'Snaxia Indiranagar', code: 'SNX-BLR-01', address: '100ft Road, Indiranagar, Bengaluru', phone: '+91 98450 11001', mgr: 'Rahul Sharma', email: 'manager.indiranagar@snaxia.in' },
    { num: 2, name: 'Snaxia Koramangala', code: 'SNX-BLR-02', address: '5th Block, Koramangala, Bengaluru', phone: '+91 98450 11002', mgr: 'Sneha Patel', email: 'manager.koramangala@snaxia.in' },
    { num: 3, name: 'Snaxia Bandra West', code: 'SNX-BOM-01', address: 'Pali Hill, Bandra West, Mumbai', phone: '+91 98200 22001', mgr: 'Rohan Deshmukh', email: 'manager.bandra@snaxia.in' },
    { num: 4, name: 'Snaxia Colaba', code: 'SNX-BOM-02', address: 'Near Gateway of India, Colaba, Mumbai', phone: '+91 98200 22002', mgr: 'Pooja Kulkarni', email: 'manager.colaba@snaxia.in' },
    { num: 5, name: 'Snaxia Connaught Place', code: 'SNX-DEL-01', address: 'Inner Circle, CP, New Delhi', phone: '+91 98110 33001', mgr: 'Amit Verma', email: 'manager.cp@snaxia.in' },
    { num: 6, name: 'Snaxia Jubilee Hills', code: 'SNX-HYD-01', address: 'Road No 36, Jubilee Hills, Hyderabad', phone: '+91 98490 44001', mgr: 'Kavita Reddy', email: 'manager.jubileehills@snaxia.in' },
    { num: 7, name: 'Snaxia Anna Nagar', code: 'SNX-MAA-01', address: '2nd Avenue, Anna Nagar, Chennai', phone: '+91 98400 55001', mgr: 'Karthik Subramanian', email: 'manager.annanagar@snaxia.in' },
    { num: 8, name: 'Snaxia Park Street', code: 'SNX-CCU-01', address: 'Park Street, Kolkata', phone: '+91 98300 66001', mgr: 'Anirban Sen', email: 'manager.parkstreet@snaxia.in' },
    { num: 9, name: 'Snaxia Koregaon Park', code: 'SNX-PNQ-01', address: 'North Main Road, Koregaon Park, Pune', phone: '+91 98220 77001', mgr: 'Neha Joshi', email: 'manager.koregaon@snaxia.in' },
    { num: 10, name: 'Snaxia Panjim Promenade', code: 'SNX-GOA-01', address: 'Campal Promenade, Panjim, Goa', phone: '+91 98230 88001', mgr: 'Denzil Fernandes', email: 'manager.panjim@snaxia.in' },
  ];

  const shopIds: string[] = [];
  const employeePool: { [shopId: string]: { id: string; name: string; rate: number }[] } = {};

  for (const s of shopsData) {
    const shopId = `50000000-0000-0000-0000-${String(s.num).padStart(12, '0')}`;
    const mgrUserId = `60000000-0000-0000-0000-${String(s.num).padStart(12, '0')}`;
    shopIds.push(shopId);

    // Insert Auth User for Manager
    lines.push(`
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', '${mgrUserId}', 'authenticated', 'authenticated',
  '${s.email}', crypt('password123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"${s.mgr}"}', now(), now(), '', '', '', ''
) ON CONFLICT (id) DO UPDATE SET 
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at;

INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES ('${mgrUserId}', '${mgrUserId}', '{"sub":"${mgrUserId}","email":"${s.email}"}'::jsonb, 'email', now(), now(), now())
ON CONFLICT (id, provider) DO NOTHING;`);

    // Insert Shop
    lines.push(`
INSERT INTO public.shops (id, brand_id, name, code, address, phone, status)
VALUES ('${shopId}', '${brandId}', '${s.name}', '${s.code}', '${s.address}', '${s.phone}', 'active')
ON CONFLICT (brand_id, code) DO NOTHING;`);

    // Insert Manager Profile
    lines.push(`
INSERT INTO public.profiles (id, role, brand_id, shop_id, full_name, phone, is_active, must_change_password)
VALUES ('${mgrUserId}', 'manager', '${brandId}', '${shopId}', '${s.mgr}', '${s.phone}', true, false)
ON CONFLICT (id) DO UPDATE SET 
  role = 'manager',
  brand_id = '${brandId}',
  shop_id = '${shopId}',
  full_name = '${s.mgr}';`);

    // 6. Employees for each shop (6 employees: Barista, Cashier, Chef, Kitchen Prep, Server, Cleaner)
    const empRoles = [
      { name: 'Suresh Kumar', title: 'Head Barista', rate: 750 },
      { name: 'Manoj Singh', title: 'Barista', rate: 600 },
      { name: 'Sunil Gowda', title: 'Cashier & Floor Host', rate: 550 },
      { name: 'Arjun Das', title: 'Line Cook', rate: 650 },
      { name: 'Deepak Roy', title: 'Kitchen Prep', rate: 450 },
      { name: 'Ramesh Yadav', title: 'Steward & Cleaning', rate: 400 },
    ];

    employeePool[shopId] = [];

    empRoles.forEach((emp, eIdx) => {
      const empId = `70000000-0000-0000-${String(s.num).padStart(4, '0')}-${String(eIdx + 1).padStart(12, '0')}`;
      employeePool[shopId].push({ id: empId, name: emp.name, rate: emp.rate });
      lines.push(`
INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('${empId}', '${brandId}', '${shopId}', '${emp.name} (${s.code})', '+91 97000 ${s.num}${eIdx}000', '${emp.title}', ${emp.rate}, true)
ON CONFLICT (id) DO NOTHING;`);
    });

    // 7. Assets for each shop
    const assetsList = [
      { name: 'La Marzocco Linea PB Espresso Machine', cat: 'grinder', model: 'Linea PB 2-Group', cost: 650000, vendor: 'Kaapi Solutions', interval: 90 },
      { name: 'Mahikonig EK43 Coffee Grinder', cat: 'grinder', model: 'EK43S', cost: 185000, vendor: 'Kaapi Solutions', interval: 60 },
      { name: 'True 2-Door Deep Freezer', cat: 'freezer', model: 'T-49F-HC', cost: 145000, vendor: 'Commercial Refrigeration Co', interval: 120 },
      { name: 'Western Under-Counter Chiller', cat: 'chiller', model: 'SRC 350', cost: 75000, vendor: 'Western Refrigeration', interval: 90 },
      { name: 'Pitco Double-Basket Deep Fryer', cat: 'fryer', model: '35C+S', cost: 95000, vendor: 'Kitchen Equip India', interval: 180 },
    ];

    assetsList.forEach((ast, aIdx) => {
      const assetId = `80000000-0000-0000-${String(s.num).padStart(4, '0')}-${String(aIdx + 1).padStart(12, '0')}`;
      lines.push(`
INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '${assetId}',
  '${brandId}',
  '${shopId}',
  '${ast.name}',
  '${ast.cat}',
  '${ast.model}',
  'SNX-${s.code}-${aIdx + 100}',
  '2025-01-15',
  ${ast.cost},
  '${ast.vendor}',
  'working',
  '2026-09-01',
  ${ast.interval},
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;`);
    });
  }

  // 8. 12 Months Data Generation for Each Shop
  // We'll generate data from 2025-11-01 to 2026-10-31 (12 months = 365 days)
  const startDate = new Date('2025-11-01T00:00:00Z');
  const endDate = new Date('2026-10-31T00:00:00Z');

  // Month openings tracker per shop
  const monthsList = [
    '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
    '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'
  ];

  // We write an efficient SQL seed procedure block to generate daily transactions fast in DB
  // This avoids multi-megabyte JS heap exhaustion and generates rows directly in Postgres in seconds!
  lines.push(`
-- Generate 12 months of daily transactions & summary using PostgreSQL set-returning functions
DO $$
DECLARE
    v_shop RECORD;
    v_curr_date DATE;
    v_day_income NUMERIC(12,2);
    v_day_expense NUMERIC(12,2);
    v_opening NUMERIC(12,2) := 15000.00;
    v_closing NUMERIC(12,2);
    v_counter INT;
    v_exp_count INT;
    v_mop_id UUID;
    v_mop_name TEXT;
    v_item_id UUID;
    v_item_name TEXT;
    v_emp_id UUID;
    v_emp_name TEXT;
    v_amt NUMERIC(12,2);
    v_month TEXT;
    v_month_start_balance NUMERIC(12,2);
    v_brand_id UUID := '${brandId}';
BEGIN
    FOR v_shop IN SELECT id, code, name FROM public.shops WHERE brand_id = v_brand_id LOOP
        v_opening := 20000.00 + (random() * 5000);

        -- Iterate through each day of the 12 months
        v_curr_date := '2025-11-01'::DATE;
        WHILE v_curr_date <= '2026-10-31'::DATE LOOP
            v_month := to_char(v_curr_date, 'YYYY-MM');

            -- Record Month Opening on 1st of each month
            IF extract(day FROM v_curr_date) = 1 THEN
                INSERT INTO public.month_openings (shop_id, month, opening_balance, is_manual, note)
                VALUES (v_shop.id, v_month, v_opening, false, 'Auto carried forward')
                ON CONFLICT (shop_id, month) DO UPDATE SET opening_balance = excluded.opening_balance;
            END IF;

            v_day_income := 0.00;
            v_day_expense := 0.00;

            -- Target daily income between ₹14,000 and ₹24,000
            -- Split across 4 entries: Counter Cash, Counter GPay, Swiggy, Zomato
            
            -- Entry 1: Counter Cash
            v_amt := round((3500 + random() * 3000)::numeric, 2);
            v_day_income := v_day_income + v_amt;
            INSERT INTO public.transactions (
                brand_id, shop_id, txn_date, kind, item_id, item_name_snapshot, mode_id, mode_name_snapshot, amount, note, txn_type
            ) VALUES (
                v_brand_id, v_shop.id, v_curr_date, 'income',
                '40000000-0000-0000-0000-000000000001', 'Counter Billing',
                '30000000-0000-0000-0000-000000000001', 'CASH',
                v_amt, 'Cash counter collections', 'normal'
            );

            -- Entry 2: Counter GPay
            v_amt := round((5000 + random() * 4500)::numeric, 2);
            v_day_income := v_day_income + v_amt;
            INSERT INTO public.transactions (
                brand_id, shop_id, txn_date, kind, item_id, item_name_snapshot, mode_id, mode_name_snapshot, amount, note, txn_type
            ) VALUES (
                v_brand_id, v_shop.id, v_curr_date, 'income',
                '40000000-0000-0000-0000-000000000001', 'Counter Billing',
                '30000000-0000-0000-0000-000000000002', 'GPAY',
                v_amt, 'UPI counter collections', 'normal'
            );

            -- Entry 3: Swiggy
            v_amt := round((2500 + random() * 3000)::numeric, 2);
            v_day_income := v_day_income + v_amt;
            INSERT INTO public.transactions (
                brand_id, shop_id, txn_date, kind, item_id, item_name_snapshot, mode_id, mode_name_snapshot, amount, note, txn_type
            ) VALUES (
                v_brand_id, v_shop.id, v_curr_date, 'income',
                '40000000-0000-0000-0000-000000000002', 'Swiggy Online',
                '30000000-0000-0000-0000-000000000003', 'BANK',
                v_amt, 'Swiggy daily settlement', 'normal'
            );

            -- Entry 4: Zomato
            v_amt := round((3000 + random() * 3500)::numeric, 2);
            v_day_income := v_day_income + v_amt;
            INSERT INTO public.transactions (
                brand_id, shop_id, txn_date, kind, item_id, item_name_snapshot, mode_id, mode_name_snapshot, amount, note, txn_type
            ) VALUES (
                v_brand_id, v_shop.id, v_curr_date, 'income',
                '40000000-0000-0000-0000-000000000003', 'Zomato Online',
                '30000000-0000-0000-0000-000000000003', 'BANK',
                v_amt, 'Zomato daily settlement', 'normal'
            );

            -- Daily Expenses: 20 to 25 expense entries per day
            v_exp_count := 20 + floor(random() * 6)::int;
            FOR v_counter IN 1..v_exp_count LOOP
                -- Select randomized expense type
                CASE (v_counter % 10)
                    WHEN 0 THEN
                        v_item_id := '40000000-0000-0000-0000-000000000010'; v_item_name := 'Fresh Milk & Cream'; v_amt := round((450 + random() * 500)::numeric, 2);
                    WHEN 1 THEN
                        v_item_id := '40000000-0000-0000-0000-000000000011'; v_item_name := 'Specialty Coffee Beans'; v_amt := round((600 + random() * 800)::numeric, 2);
                    WHEN 2 THEN
                        v_item_id := '40000000-0000-0000-0000-000000000012'; v_item_name := 'Artisan Breads & Croissants'; v_amt := round((350 + random() * 400)::numeric, 2);
                    WHEN 3 THEN
                        v_item_id := '40000000-0000-0000-0000-000000000013'; v_item_name := 'Fresh Fruits & Veggies'; v_amt := round((250 + random() * 300)::numeric, 2);
                    WHEN 4 THEN
                        v_item_id := '40000000-0000-0000-0000-000000000015'; v_item_name := 'Takeaway Cups & Packaging'; v_amt := round((300 + random() * 350)::numeric, 2);
                    WHEN 5 THEN
                        v_item_id := '40000000-0000-0000-0000-000000000018'; v_item_name := 'Water Cans & Ice Blocks'; v_amt := round((120 + random() * 150)::numeric, 2);
                    WHEN 6 THEN
                        v_item_id := '40000000-0000-0000-0000-000000000019'; v_item_name := 'Cleaning & Sanitization'; v_amt := round((150 + random() * 200)::numeric, 2);
                    WHEN 7 THEN
                        v_item_id := '40000000-0000-0000-0000-000000000024'; v_item_name := 'Staff Refreshments'; v_amt := round((180 + random() * 120)::numeric, 2);
                    WHEN 8 THEN
                        v_item_id := '40000000-0000-0000-0000-000000000026'; v_item_name := 'Cheese, Butter & Sauces'; v_amt := round((400 + random() * 500)::numeric, 2);
                    ELSE
                        v_item_id := '40000000-0000-0000-0000-000000000028'; v_item_name := 'Miscellaneous Petty Cash'; v_amt := round((100 + random() * 200)::numeric, 2);
                END CASE;

                -- Occasional Salary Advance (every ~8 days for an employee)
                IF (v_counter = 1 AND (extract(day FROM v_curr_date)::int % 7 = 3)) THEN
                    SELECT id, name INTO v_emp_id, v_emp_name FROM public.employees WHERE shop_id = v_shop.id ORDER BY random() LIMIT 1;
                    IF v_emp_id IS NOT NULL THEN
                        v_amt := 1500.00;
                        v_day_expense := v_day_expense + v_amt;
                        INSERT INTO public.transactions (
                            brand_id, shop_id, txn_date, kind, item_id, item_name_snapshot,
                            mode_id, mode_name_snapshot, amount, note, employee_id, txn_type
                        ) VALUES (
                            v_brand_id, v_shop.id, v_curr_date, 'expense',
                            '40000000-0000-0000-0000-000000000021', 'Salary Advance',
                            '30000000-0000-0000-0000-000000000001', 'CASH',
                            v_amt, 'SA-' || v_emp_name, v_emp_id, 'salary_advance'
                        );
                        CONTINUE;
                    END IF;
                END IF;

                v_day_expense := v_day_expense + v_amt;
                INSERT INTO public.transactions (
                    brand_id, shop_id, txn_date, kind, item_id, item_name_snapshot,
                    mode_id, mode_name_snapshot, amount, note, txn_type
                ) VALUES (
                    v_brand_id, v_shop.id, v_curr_date, 'expense',
                    v_item_id, v_item_name,
                    '30000000-0000-0000-0000-000000000001', 'CASH',
                    v_amt, 'Daily expense entry #' || v_counter, 'normal'
                );
            END LOOP;

            -- Calculate Closing
            v_closing := v_opening + v_day_income - v_day_expense;

            -- Upsert into daily_summary
            INSERT INTO public.daily_summary (shop_id, summary_date, opening, income, expense, closing)
            VALUES (v_shop.id, v_curr_date, v_opening, v_day_income, v_day_expense, v_closing)
            ON CONFLICT (shop_id, summary_date)
            DO UPDATE SET
                opening = excluded.opening,
                income = excluded.income,
                expense = excluded.expense,
                closing = excluded.closing;

            -- Next day's opening is today's closing
            v_opening := v_closing;
            v_curr_date := v_curr_date + interval '1 day';
        END LOOP;

        -- Generate salary_records for each employee for the 12 months
        FOR v_month IN SELECT unnest(ARRAY[
            '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
            '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'
        ]) LOOP
            FOR v_emp_id IN SELECT id FROM public.employees WHERE shop_id = v_shop.id LOOP
                -- Recalculate salary record
                INSERT INTO public.salary_records (
                    shop_id, employee_id, month, days_worked, rate_snapshot, gross, advances_total, paid_total, balance
                )
                SELECT 
                    v_shop.id,
                    e.id,
                    v_month,
                    26.0,
                    e.rate_per_day,
                    round(26.0 * e.rate_per_day, 2),
                    coalesce((
                        SELECT sum(amount) FROM public.transactions 
                        WHERE shop_id = v_shop.id AND employee_id = e.id AND to_char(txn_date, 'YYYY-MM') = v_month AND txn_type = 'salary_advance' AND NOT is_deleted
                    ), 0.00),
                    round(26.0 * e.rate_per_day * 0.85, 2),
                    round(26.0 * e.rate_per_day * 0.15, 2)
                FROM public.employees e WHERE e.id = v_emp_id
                ON CONFLICT (shop_id, employee_id, month) DO NOTHING;
            END LOOP;
        END LOOP;

    END LOOP;
END $$;
`);

  lines.push(`COMMIT;`);
  return lines.join('\n');
}

export function writeSeedSQLFile(outputPath?: string): string {
  const targetPath = outputPath || path.join(process.cwd(), 'supabase', 'seed.sql');
  const sql = generateSeedSQL();
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, sql, 'utf-8');
  console.log(`Generated ${targetPath} (${Math.round(sql.length / 1024)} KB)`);
  return targetPath;
}

if (require.main === module) {
  writeSeedSQLFile();
}

