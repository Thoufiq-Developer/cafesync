-- CafeLedger High-Scale Realistic Seed Data
-- 10 Shops x 12 Months (Daily Income ₹12k-₹25k, 20-30 expenses/day)
BEGIN;
SET CONSTRAINTS ALL DEFERRED;

-- 0. Supabase Auth Users for testing (Password: password123)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES 
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'master@cafeledger.io', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Super Master Admin"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'admin@snaxia.in', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Vikram Malhotra"}', now(), now(), '', '', '', '')
ON CONFLICT (id) DO UPDATE SET 
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at;

INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '{"sub":"00000000-0000-0000-0000-000000000001","email":"master@cafeledger.io"}'::jsonb, 'email', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '{"sub":"22222222-2222-2222-2222-222222222222","email":"admin@snaxia.in"}'::jsonb, 'email', now(), now(), now())
ON CONFLICT (id, provider) DO NOTHING;

INSERT INTO public.brands (id, name, registration_no, logo_url, primary_color, secondary_color, address, phone, email, gstin, status)
VALUES (
  '11111111-1111-1111-1111-111111111111',
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
) ON CONFLICT (registration_no) DO NOTHING;

INSERT INTO public.profiles (id, role, brand_id, shop_id, full_name, phone, is_active, must_change_password)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'master', null, null, 'Super Master Admin', '+91 99999 00000', true, false),
  ('22222222-2222-2222-2222-222222222222', 'admin', '11111111-1111-1111-1111-111111111111', null, 'Vikram Malhotra (Brand Director)', '+91 98888 11111', true, false)
ON CONFLICT (id) DO UPDATE SET 
  role = excluded.role,
  brand_id = excluded.brand_id,
  full_name = excluded.full_name;

INSERT INTO public.payment_modes (id, brand_id, name, is_active)
VALUES ('30000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'CASH', true)
ON CONFLICT (brand_id, name) DO NOTHING;

INSERT INTO public.payment_modes (id, brand_id, name, is_active)
VALUES ('30000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'GPAY', true)
ON CONFLICT (brand_id, name) DO NOTHING;

INSERT INTO public.payment_modes (id, brand_id, name, is_active)
VALUES ('30000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'BANK', true)
ON CONFLICT (brand_id, name) DO NOTHING;

INSERT INTO public.payment_modes (id, brand_id, name, is_active)
VALUES ('30000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'CARD', true)
ON CONFLICT (brand_id, name) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Counter Billing', 'income', 'Sales', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Swiggy Online', 'income', 'Online Aggregator', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Zomato Online', 'income', 'Online Aggregator', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Catering & Events', 'income', 'Events', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Packaged Coffee / Beans', 'income', 'Retail', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'Fresh Milk & Cream', 'expense', 'Dairy', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'Specialty Coffee Beans', 'expense', 'Beverages', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'Artisan Breads & Croissants', 'expense', 'Bakery', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'Fresh Fruits & Veggies', 'expense', 'Produce', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', 'Gourmet Syrups & Purees', 'expense', 'Beverages', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000015', '11111111-1111-1111-1111-111111111111', 'Takeaway Cups & Packaging', 'expense', 'Packaging', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000016', '11111111-1111-1111-1111-111111111111', 'Commercial Gas Cylinder', 'expense', 'Utilities', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000017', '11111111-1111-1111-1111-111111111111', 'Electricity Recharge', 'expense', 'Utilities', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000018', '11111111-1111-1111-1111-111111111111', 'Water Cans & Ice Blocks', 'expense', 'Kitchen', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000019', '11111111-1111-1111-1111-111111111111', 'Cleaning & Sanitization', 'expense', 'Maintenance', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000020', '11111111-1111-1111-1111-111111111111', 'Internet & POS Paper Rolls', 'expense', 'Admin', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000021', '11111111-1111-1111-1111-111111111111', 'Salary Advance', 'expense', 'Payroll', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000022', '11111111-1111-1111-1111-111111111111', 'Monthly Salary Settlement', 'expense', 'Payroll', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000023', '11111111-1111-1111-1111-111111111111', 'Minor Machine Repairs', 'expense', 'Repairs', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000024', '11111111-1111-1111-1111-111111111111', 'Staff Refreshments', 'expense', 'Staff Welfare', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000025', '11111111-1111-1111-1111-111111111111', 'Pest Control & Hygiene', 'expense', 'Maintenance', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000026', '11111111-1111-1111-1111-111111111111', 'Cheese, Butter & Sauces', 'expense', 'Kitchen', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000027', '11111111-1111-1111-1111-111111111111', 'Chocolates & Cocoa Powder', 'expense', 'Bakery', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, brand_id, name, kind, category, is_active)
VALUES ('40000000-0000-0000-0000-000000000028', '11111111-1111-1111-1111-111111111111', 'Miscellaneous Petty Cash', 'expense', 'General', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
  'manager.indiranagar@snaxia.in', crypt('password123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Rahul Sharma"}', now(), now(), '', '', '', ''
) ON CONFLICT (id) DO UPDATE SET 
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at;

INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES ('60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '{"sub":"60000000-0000-0000-0000-000000000001","email":"manager.indiranagar@snaxia.in"}'::jsonb, 'email', now(), now(), now())
ON CONFLICT (id, provider) DO NOTHING;

INSERT INTO public.shops (id, brand_id, name, code, address, phone, status)
VALUES ('50000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Snaxia Indiranagar', 'SNX-BLR-01', '100ft Road, Indiranagar, Bengaluru', '+91 98450 11001', 'active')
ON CONFLICT (brand_id, code) DO NOTHING;

INSERT INTO public.profiles (id, role, brand_id, shop_id, full_name, phone, is_active, must_change_password)
VALUES ('60000000-0000-0000-0000-000000000001', 'manager', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000001', 'Rahul Sharma', '+91 98450 11001', true, false)
ON CONFLICT (id) DO UPDATE SET 
  role = 'manager',
  brand_id = '11111111-1111-1111-1111-111111111111',
  shop_id = '50000000-0000-0000-0000-000000000001',
  full_name = 'Rahul Sharma';

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0001-000000000001', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000001', 'Suresh Kumar (SNX-BLR-01)', '+91 97000 10000', 'Head Barista', 750, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0001-000000000002', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000001', 'Manoj Singh (SNX-BLR-01)', '+91 97000 11000', 'Barista', 600, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0001-000000000003', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000001', 'Sunil Gowda (SNX-BLR-01)', '+91 97000 12000', 'Cashier & Floor Host', 550, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0001-000000000004', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000001', 'Arjun Das (SNX-BLR-01)', '+91 97000 13000', 'Line Cook', 650, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0001-000000000005', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000001', 'Deepak Roy (SNX-BLR-01)', '+91 97000 14000', 'Kitchen Prep', 450, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0001-000000000006', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000001', 'Ramesh Yadav (SNX-BLR-01)', '+91 97000 15000', 'Steward & Cleaning', 400, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0001-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000001',
  'La Marzocco Linea PB Espresso Machine',
  'grinder',
  'Linea PB 2-Group',
  'SNX-SNX-BLR-01-100',
  '2025-01-15',
  650000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0001-000000000002',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000001',
  'Mahikonig EK43 Coffee Grinder',
  'grinder',
  'EK43S',
  'SNX-SNX-BLR-01-101',
  '2025-01-15',
  185000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  60,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0001-000000000003',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000001',
  'True 2-Door Deep Freezer',
  'freezer',
  'T-49F-HC',
  'SNX-SNX-BLR-01-102',
  '2025-01-15',
  145000,
  'Commercial Refrigeration Co',
  'working',
  '2026-09-01',
  120,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0001-000000000004',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000001',
  'Western Under-Counter Chiller',
  'chiller',
  'SRC 350',
  'SNX-SNX-BLR-01-103',
  '2025-01-15',
  75000,
  'Western Refrigeration',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0001-000000000005',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000001',
  'Pitco Double-Basket Deep Fryer',
  'fryer',
  '35C+S',
  'SNX-SNX-BLR-01-104',
  '2025-01-15',
  95000,
  'Kitchen Equip India',
  'working',
  '2026-09-01',
  180,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
  'manager.koramangala@snaxia.in', crypt('password123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Sneha Patel"}', now(), now(), '', '', '', ''
) ON CONFLICT (id) DO UPDATE SET 
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at;

INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES ('60000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', '{"sub":"60000000-0000-0000-0000-000000000002","email":"manager.koramangala@snaxia.in"}'::jsonb, 'email', now(), now(), now())
ON CONFLICT (id, provider) DO NOTHING;

INSERT INTO public.shops (id, brand_id, name, code, address, phone, status)
VALUES ('50000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Snaxia Koramangala', 'SNX-BLR-02', '5th Block, Koramangala, Bengaluru', '+91 98450 11002', 'active')
ON CONFLICT (brand_id, code) DO NOTHING;

INSERT INTO public.profiles (id, role, brand_id, shop_id, full_name, phone, is_active, must_change_password)
VALUES ('60000000-0000-0000-0000-000000000002', 'manager', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000002', 'Sneha Patel', '+91 98450 11002', true, false)
ON CONFLICT (id) DO UPDATE SET 
  role = 'manager',
  brand_id = '11111111-1111-1111-1111-111111111111',
  shop_id = '50000000-0000-0000-0000-000000000002',
  full_name = 'Sneha Patel';

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0002-000000000001', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000002', 'Suresh Kumar (SNX-BLR-02)', '+91 97000 20000', 'Head Barista', 750, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0002-000000000002', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000002', 'Manoj Singh (SNX-BLR-02)', '+91 97000 21000', 'Barista', 600, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0002-000000000003', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000002', 'Sunil Gowda (SNX-BLR-02)', '+91 97000 22000', 'Cashier & Floor Host', 550, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0002-000000000004', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000002', 'Arjun Das (SNX-BLR-02)', '+91 97000 23000', 'Line Cook', 650, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0002-000000000005', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000002', 'Deepak Roy (SNX-BLR-02)', '+91 97000 24000', 'Kitchen Prep', 450, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0002-000000000006', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000002', 'Ramesh Yadav (SNX-BLR-02)', '+91 97000 25000', 'Steward & Cleaning', 400, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0002-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000002',
  'La Marzocco Linea PB Espresso Machine',
  'grinder',
  'Linea PB 2-Group',
  'SNX-SNX-BLR-02-100',
  '2025-01-15',
  650000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0002-000000000002',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000002',
  'Mahikonig EK43 Coffee Grinder',
  'grinder',
  'EK43S',
  'SNX-SNX-BLR-02-101',
  '2025-01-15',
  185000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  60,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0002-000000000003',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000002',
  'True 2-Door Deep Freezer',
  'freezer',
  'T-49F-HC',
  'SNX-SNX-BLR-02-102',
  '2025-01-15',
  145000,
  'Commercial Refrigeration Co',
  'working',
  '2026-09-01',
  120,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0002-000000000004',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000002',
  'Western Under-Counter Chiller',
  'chiller',
  'SRC 350',
  'SNX-SNX-BLR-02-103',
  '2025-01-15',
  75000,
  'Western Refrigeration',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0002-000000000005',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000002',
  'Pitco Double-Basket Deep Fryer',
  'fryer',
  '35C+S',
  'SNX-SNX-BLR-02-104',
  '2025-01-15',
  95000,
  'Kitchen Equip India',
  'working',
  '2026-09-01',
  180,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
  'manager.bandra@snaxia.in', crypt('password123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Rohan Deshmukh"}', now(), now(), '', '', '', ''
) ON CONFLICT (id) DO UPDATE SET 
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at;

INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES ('60000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003', '{"sub":"60000000-0000-0000-0000-000000000003","email":"manager.bandra@snaxia.in"}'::jsonb, 'email', now(), now(), now())
ON CONFLICT (id, provider) DO NOTHING;

INSERT INTO public.shops (id, brand_id, name, code, address, phone, status)
VALUES ('50000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Snaxia Bandra West', 'SNX-BOM-01', 'Pali Hill, Bandra West, Mumbai', '+91 98200 22001', 'active')
ON CONFLICT (brand_id, code) DO NOTHING;

INSERT INTO public.profiles (id, role, brand_id, shop_id, full_name, phone, is_active, must_change_password)
VALUES ('60000000-0000-0000-0000-000000000003', 'manager', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000003', 'Rohan Deshmukh', '+91 98200 22001', true, false)
ON CONFLICT (id) DO UPDATE SET 
  role = 'manager',
  brand_id = '11111111-1111-1111-1111-111111111111',
  shop_id = '50000000-0000-0000-0000-000000000003',
  full_name = 'Rohan Deshmukh';

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0003-000000000001', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000003', 'Suresh Kumar (SNX-BOM-01)', '+91 97000 30000', 'Head Barista', 750, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0003-000000000002', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000003', 'Manoj Singh (SNX-BOM-01)', '+91 97000 31000', 'Barista', 600, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0003-000000000003', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000003', 'Sunil Gowda (SNX-BOM-01)', '+91 97000 32000', 'Cashier & Floor Host', 550, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0003-000000000004', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000003', 'Arjun Das (SNX-BOM-01)', '+91 97000 33000', 'Line Cook', 650, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0003-000000000005', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000003', 'Deepak Roy (SNX-BOM-01)', '+91 97000 34000', 'Kitchen Prep', 450, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0003-000000000006', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000003', 'Ramesh Yadav (SNX-BOM-01)', '+91 97000 35000', 'Steward & Cleaning', 400, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0003-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000003',
  'La Marzocco Linea PB Espresso Machine',
  'grinder',
  'Linea PB 2-Group',
  'SNX-SNX-BOM-01-100',
  '2025-01-15',
  650000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0003-000000000002',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000003',
  'Mahikonig EK43 Coffee Grinder',
  'grinder',
  'EK43S',
  'SNX-SNX-BOM-01-101',
  '2025-01-15',
  185000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  60,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0003-000000000003',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000003',
  'True 2-Door Deep Freezer',
  'freezer',
  'T-49F-HC',
  'SNX-SNX-BOM-01-102',
  '2025-01-15',
  145000,
  'Commercial Refrigeration Co',
  'working',
  '2026-09-01',
  120,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0003-000000000004',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000003',
  'Western Under-Counter Chiller',
  'chiller',
  'SRC 350',
  'SNX-SNX-BOM-01-103',
  '2025-01-15',
  75000,
  'Western Refrigeration',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0003-000000000005',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000003',
  'Pitco Double-Basket Deep Fryer',
  'fryer',
  '35C+S',
  'SNX-SNX-BOM-01-104',
  '2025-01-15',
  95000,
  'Kitchen Equip India',
  'working',
  '2026-09-01',
  180,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
  'manager.colaba@snaxia.in', crypt('password123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Pooja Kulkarni"}', now(), now(), '', '', '', ''
) ON CONFLICT (id) DO UPDATE SET 
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at;

INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES ('60000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000004', '{"sub":"60000000-0000-0000-0000-000000000004","email":"manager.colaba@snaxia.in"}'::jsonb, 'email', now(), now(), now())
ON CONFLICT (id, provider) DO NOTHING;

INSERT INTO public.shops (id, brand_id, name, code, address, phone, status)
VALUES ('50000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Snaxia Colaba', 'SNX-BOM-02', 'Near Gateway of India, Colaba, Mumbai', '+91 98200 22002', 'active')
ON CONFLICT (brand_id, code) DO NOTHING;

INSERT INTO public.profiles (id, role, brand_id, shop_id, full_name, phone, is_active, must_change_password)
VALUES ('60000000-0000-0000-0000-000000000004', 'manager', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000004', 'Pooja Kulkarni', '+91 98200 22002', true, false)
ON CONFLICT (id) DO UPDATE SET 
  role = 'manager',
  brand_id = '11111111-1111-1111-1111-111111111111',
  shop_id = '50000000-0000-0000-0000-000000000004',
  full_name = 'Pooja Kulkarni';

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0004-000000000001', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000004', 'Suresh Kumar (SNX-BOM-02)', '+91 97000 40000', 'Head Barista', 750, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0004-000000000002', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000004', 'Manoj Singh (SNX-BOM-02)', '+91 97000 41000', 'Barista', 600, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0004-000000000003', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000004', 'Sunil Gowda (SNX-BOM-02)', '+91 97000 42000', 'Cashier & Floor Host', 550, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0004-000000000004', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000004', 'Arjun Das (SNX-BOM-02)', '+91 97000 43000', 'Line Cook', 650, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0004-000000000005', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000004', 'Deepak Roy (SNX-BOM-02)', '+91 97000 44000', 'Kitchen Prep', 450, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0004-000000000006', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000004', 'Ramesh Yadav (SNX-BOM-02)', '+91 97000 45000', 'Steward & Cleaning', 400, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0004-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000004',
  'La Marzocco Linea PB Espresso Machine',
  'grinder',
  'Linea PB 2-Group',
  'SNX-SNX-BOM-02-100',
  '2025-01-15',
  650000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0004-000000000002',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000004',
  'Mahikonig EK43 Coffee Grinder',
  'grinder',
  'EK43S',
  'SNX-SNX-BOM-02-101',
  '2025-01-15',
  185000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  60,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0004-000000000003',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000004',
  'True 2-Door Deep Freezer',
  'freezer',
  'T-49F-HC',
  'SNX-SNX-BOM-02-102',
  '2025-01-15',
  145000,
  'Commercial Refrigeration Co',
  'working',
  '2026-09-01',
  120,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0004-000000000004',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000004',
  'Western Under-Counter Chiller',
  'chiller',
  'SRC 350',
  'SNX-SNX-BOM-02-103',
  '2025-01-15',
  75000,
  'Western Refrigeration',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0004-000000000005',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000004',
  'Pitco Double-Basket Deep Fryer',
  'fryer',
  '35C+S',
  'SNX-SNX-BOM-02-104',
  '2025-01-15',
  95000,
  'Kitchen Equip India',
  'working',
  '2026-09-01',
  180,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
  'manager.cp@snaxia.in', crypt('password123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Amit Verma"}', now(), now(), '', '', '', ''
) ON CONFLICT (id) DO UPDATE SET 
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at;

INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES ('60000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000005', '{"sub":"60000000-0000-0000-0000-000000000005","email":"manager.cp@snaxia.in"}'::jsonb, 'email', now(), now(), now())
ON CONFLICT (id, provider) DO NOTHING;

INSERT INTO public.shops (id, brand_id, name, code, address, phone, status)
VALUES ('50000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Snaxia Connaught Place', 'SNX-DEL-01', 'Inner Circle, CP, New Delhi', '+91 98110 33001', 'active')
ON CONFLICT (brand_id, code) DO NOTHING;

INSERT INTO public.profiles (id, role, brand_id, shop_id, full_name, phone, is_active, must_change_password)
VALUES ('60000000-0000-0000-0000-000000000005', 'manager', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000005', 'Amit Verma', '+91 98110 33001', true, false)
ON CONFLICT (id) DO UPDATE SET 
  role = 'manager',
  brand_id = '11111111-1111-1111-1111-111111111111',
  shop_id = '50000000-0000-0000-0000-000000000005',
  full_name = 'Amit Verma';

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0005-000000000001', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000005', 'Suresh Kumar (SNX-DEL-01)', '+91 97000 50000', 'Head Barista', 750, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0005-000000000002', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000005', 'Manoj Singh (SNX-DEL-01)', '+91 97000 51000', 'Barista', 600, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0005-000000000003', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000005', 'Sunil Gowda (SNX-DEL-01)', '+91 97000 52000', 'Cashier & Floor Host', 550, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0005-000000000004', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000005', 'Arjun Das (SNX-DEL-01)', '+91 97000 53000', 'Line Cook', 650, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0005-000000000005', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000005', 'Deepak Roy (SNX-DEL-01)', '+91 97000 54000', 'Kitchen Prep', 450, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0005-000000000006', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000005', 'Ramesh Yadav (SNX-DEL-01)', '+91 97000 55000', 'Steward & Cleaning', 400, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0005-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000005',
  'La Marzocco Linea PB Espresso Machine',
  'grinder',
  'Linea PB 2-Group',
  'SNX-SNX-DEL-01-100',
  '2025-01-15',
  650000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0005-000000000002',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000005',
  'Mahikonig EK43 Coffee Grinder',
  'grinder',
  'EK43S',
  'SNX-SNX-DEL-01-101',
  '2025-01-15',
  185000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  60,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0005-000000000003',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000005',
  'True 2-Door Deep Freezer',
  'freezer',
  'T-49F-HC',
  'SNX-SNX-DEL-01-102',
  '2025-01-15',
  145000,
  'Commercial Refrigeration Co',
  'working',
  '2026-09-01',
  120,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0005-000000000004',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000005',
  'Western Under-Counter Chiller',
  'chiller',
  'SRC 350',
  'SNX-SNX-DEL-01-103',
  '2025-01-15',
  75000,
  'Western Refrigeration',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0005-000000000005',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000005',
  'Pitco Double-Basket Deep Fryer',
  'fryer',
  '35C+S',
  'SNX-SNX-DEL-01-104',
  '2025-01-15',
  95000,
  'Kitchen Equip India',
  'working',
  '2026-09-01',
  180,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated',
  'manager.jubileehills@snaxia.in', crypt('password123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Kavita Reddy"}', now(), now(), '', '', '', ''
) ON CONFLICT (id) DO UPDATE SET 
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at;

INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES ('60000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000006', '{"sub":"60000000-0000-0000-0000-000000000006","email":"manager.jubileehills@snaxia.in"}'::jsonb, 'email', now(), now(), now())
ON CONFLICT (id, provider) DO NOTHING;

INSERT INTO public.shops (id, brand_id, name, code, address, phone, status)
VALUES ('50000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Snaxia Jubilee Hills', 'SNX-HYD-01', 'Road No 36, Jubilee Hills, Hyderabad', '+91 98490 44001', 'active')
ON CONFLICT (brand_id, code) DO NOTHING;

INSERT INTO public.profiles (id, role, brand_id, shop_id, full_name, phone, is_active, must_change_password)
VALUES ('60000000-0000-0000-0000-000000000006', 'manager', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000006', 'Kavita Reddy', '+91 98490 44001', true, false)
ON CONFLICT (id) DO UPDATE SET 
  role = 'manager',
  brand_id = '11111111-1111-1111-1111-111111111111',
  shop_id = '50000000-0000-0000-0000-000000000006',
  full_name = 'Kavita Reddy';

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0006-000000000001', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000006', 'Suresh Kumar (SNX-HYD-01)', '+91 97000 60000', 'Head Barista', 750, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0006-000000000002', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000006', 'Manoj Singh (SNX-HYD-01)', '+91 97000 61000', 'Barista', 600, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0006-000000000003', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000006', 'Sunil Gowda (SNX-HYD-01)', '+91 97000 62000', 'Cashier & Floor Host', 550, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0006-000000000004', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000006', 'Arjun Das (SNX-HYD-01)', '+91 97000 63000', 'Line Cook', 650, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0006-000000000005', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000006', 'Deepak Roy (SNX-HYD-01)', '+91 97000 64000', 'Kitchen Prep', 450, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0006-000000000006', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000006', 'Ramesh Yadav (SNX-HYD-01)', '+91 97000 65000', 'Steward & Cleaning', 400, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0006-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000006',
  'La Marzocco Linea PB Espresso Machine',
  'grinder',
  'Linea PB 2-Group',
  'SNX-SNX-HYD-01-100',
  '2025-01-15',
  650000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0006-000000000002',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000006',
  'Mahikonig EK43 Coffee Grinder',
  'grinder',
  'EK43S',
  'SNX-SNX-HYD-01-101',
  '2025-01-15',
  185000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  60,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0006-000000000003',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000006',
  'True 2-Door Deep Freezer',
  'freezer',
  'T-49F-HC',
  'SNX-SNX-HYD-01-102',
  '2025-01-15',
  145000,
  'Commercial Refrigeration Co',
  'working',
  '2026-09-01',
  120,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0006-000000000004',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000006',
  'Western Under-Counter Chiller',
  'chiller',
  'SRC 350',
  'SNX-SNX-HYD-01-103',
  '2025-01-15',
  75000,
  'Western Refrigeration',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0006-000000000005',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000006',
  'Pitco Double-Basket Deep Fryer',
  'fryer',
  '35C+S',
  'SNX-SNX-HYD-01-104',
  '2025-01-15',
  95000,
  'Kitchen Equip India',
  'working',
  '2026-09-01',
  180,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated',
  'manager.annanagar@snaxia.in', crypt('password123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Karthik Subramanian"}', now(), now(), '', '', '', ''
) ON CONFLICT (id) DO UPDATE SET 
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at;

INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES ('60000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000007', '{"sub":"60000000-0000-0000-0000-000000000007","email":"manager.annanagar@snaxia.in"}'::jsonb, 'email', now(), now(), now())
ON CONFLICT (id, provider) DO NOTHING;

INSERT INTO public.shops (id, brand_id, name, code, address, phone, status)
VALUES ('50000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'Snaxia Anna Nagar', 'SNX-MAA-01', '2nd Avenue, Anna Nagar, Chennai', '+91 98400 55001', 'active')
ON CONFLICT (brand_id, code) DO NOTHING;

INSERT INTO public.profiles (id, role, brand_id, shop_id, full_name, phone, is_active, must_change_password)
VALUES ('60000000-0000-0000-0000-000000000007', 'manager', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000007', 'Karthik Subramanian', '+91 98400 55001', true, false)
ON CONFLICT (id) DO UPDATE SET 
  role = 'manager',
  brand_id = '11111111-1111-1111-1111-111111111111',
  shop_id = '50000000-0000-0000-0000-000000000007',
  full_name = 'Karthik Subramanian';

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0007-000000000001', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000007', 'Suresh Kumar (SNX-MAA-01)', '+91 97000 70000', 'Head Barista', 750, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0007-000000000002', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000007', 'Manoj Singh (SNX-MAA-01)', '+91 97000 71000', 'Barista', 600, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0007-000000000003', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000007', 'Sunil Gowda (SNX-MAA-01)', '+91 97000 72000', 'Cashier & Floor Host', 550, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0007-000000000004', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000007', 'Arjun Das (SNX-MAA-01)', '+91 97000 73000', 'Line Cook', 650, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0007-000000000005', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000007', 'Deepak Roy (SNX-MAA-01)', '+91 97000 74000', 'Kitchen Prep', 450, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0007-000000000006', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000007', 'Ramesh Yadav (SNX-MAA-01)', '+91 97000 75000', 'Steward & Cleaning', 400, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0007-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000007',
  'La Marzocco Linea PB Espresso Machine',
  'grinder',
  'Linea PB 2-Group',
  'SNX-SNX-MAA-01-100',
  '2025-01-15',
  650000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0007-000000000002',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000007',
  'Mahikonig EK43 Coffee Grinder',
  'grinder',
  'EK43S',
  'SNX-SNX-MAA-01-101',
  '2025-01-15',
  185000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  60,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0007-000000000003',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000007',
  'True 2-Door Deep Freezer',
  'freezer',
  'T-49F-HC',
  'SNX-SNX-MAA-01-102',
  '2025-01-15',
  145000,
  'Commercial Refrigeration Co',
  'working',
  '2026-09-01',
  120,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0007-000000000004',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000007',
  'Western Under-Counter Chiller',
  'chiller',
  'SRC 350',
  'SNX-SNX-MAA-01-103',
  '2025-01-15',
  75000,
  'Western Refrigeration',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0007-000000000005',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000007',
  'Pitco Double-Basket Deep Fryer',
  'fryer',
  '35C+S',
  'SNX-SNX-MAA-01-104',
  '2025-01-15',
  95000,
  'Kitchen Equip India',
  'working',
  '2026-09-01',
  180,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated',
  'manager.parkstreet@snaxia.in', crypt('password123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Anirban Sen"}', now(), now(), '', '', '', ''
) ON CONFLICT (id) DO UPDATE SET 
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at;

INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES ('60000000-0000-0000-0000-000000000008', '60000000-0000-0000-0000-000000000008', '{"sub":"60000000-0000-0000-0000-000000000008","email":"manager.parkstreet@snaxia.in"}'::jsonb, 'email', now(), now(), now())
ON CONFLICT (id, provider) DO NOTHING;

INSERT INTO public.shops (id, brand_id, name, code, address, phone, status)
VALUES ('50000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'Snaxia Park Street', 'SNX-CCU-01', 'Park Street, Kolkata', '+91 98300 66001', 'active')
ON CONFLICT (brand_id, code) DO NOTHING;

INSERT INTO public.profiles (id, role, brand_id, shop_id, full_name, phone, is_active, must_change_password)
VALUES ('60000000-0000-0000-0000-000000000008', 'manager', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000008', 'Anirban Sen', '+91 98300 66001', true, false)
ON CONFLICT (id) DO UPDATE SET 
  role = 'manager',
  brand_id = '11111111-1111-1111-1111-111111111111',
  shop_id = '50000000-0000-0000-0000-000000000008',
  full_name = 'Anirban Sen';

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0008-000000000001', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000008', 'Suresh Kumar (SNX-CCU-01)', '+91 97000 80000', 'Head Barista', 750, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0008-000000000002', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000008', 'Manoj Singh (SNX-CCU-01)', '+91 97000 81000', 'Barista', 600, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0008-000000000003', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000008', 'Sunil Gowda (SNX-CCU-01)', '+91 97000 82000', 'Cashier & Floor Host', 550, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0008-000000000004', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000008', 'Arjun Das (SNX-CCU-01)', '+91 97000 83000', 'Line Cook', 650, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0008-000000000005', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000008', 'Deepak Roy (SNX-CCU-01)', '+91 97000 84000', 'Kitchen Prep', 450, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0008-000000000006', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000008', 'Ramesh Yadav (SNX-CCU-01)', '+91 97000 85000', 'Steward & Cleaning', 400, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0008-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000008',
  'La Marzocco Linea PB Espresso Machine',
  'grinder',
  'Linea PB 2-Group',
  'SNX-SNX-CCU-01-100',
  '2025-01-15',
  650000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0008-000000000002',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000008',
  'Mahikonig EK43 Coffee Grinder',
  'grinder',
  'EK43S',
  'SNX-SNX-CCU-01-101',
  '2025-01-15',
  185000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  60,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0008-000000000003',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000008',
  'True 2-Door Deep Freezer',
  'freezer',
  'T-49F-HC',
  'SNX-SNX-CCU-01-102',
  '2025-01-15',
  145000,
  'Commercial Refrigeration Co',
  'working',
  '2026-09-01',
  120,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0008-000000000004',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000008',
  'Western Under-Counter Chiller',
  'chiller',
  'SRC 350',
  'SNX-SNX-CCU-01-103',
  '2025-01-15',
  75000,
  'Western Refrigeration',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0008-000000000005',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000008',
  'Pitco Double-Basket Deep Fryer',
  'fryer',
  '35C+S',
  'SNX-SNX-CCU-01-104',
  '2025-01-15',
  95000,
  'Kitchen Equip India',
  'working',
  '2026-09-01',
  180,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated',
  'manager.koregaon@snaxia.in', crypt('password123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Neha Joshi"}', now(), now(), '', '', '', ''
) ON CONFLICT (id) DO UPDATE SET 
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at;

INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES ('60000000-0000-0000-0000-000000000009', '60000000-0000-0000-0000-000000000009', '{"sub":"60000000-0000-0000-0000-000000000009","email":"manager.koregaon@snaxia.in"}'::jsonb, 'email', now(), now(), now())
ON CONFLICT (id, provider) DO NOTHING;

INSERT INTO public.shops (id, brand_id, name, code, address, phone, status)
VALUES ('50000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'Snaxia Koregaon Park', 'SNX-PNQ-01', 'North Main Road, Koregaon Park, Pune', '+91 98220 77001', 'active')
ON CONFLICT (brand_id, code) DO NOTHING;

INSERT INTO public.profiles (id, role, brand_id, shop_id, full_name, phone, is_active, must_change_password)
VALUES ('60000000-0000-0000-0000-000000000009', 'manager', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000009', 'Neha Joshi', '+91 98220 77001', true, false)
ON CONFLICT (id) DO UPDATE SET 
  role = 'manager',
  brand_id = '11111111-1111-1111-1111-111111111111',
  shop_id = '50000000-0000-0000-0000-000000000009',
  full_name = 'Neha Joshi';

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0009-000000000001', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000009', 'Suresh Kumar (SNX-PNQ-01)', '+91 97000 90000', 'Head Barista', 750, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0009-000000000002', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000009', 'Manoj Singh (SNX-PNQ-01)', '+91 97000 91000', 'Barista', 600, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0009-000000000003', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000009', 'Sunil Gowda (SNX-PNQ-01)', '+91 97000 92000', 'Cashier & Floor Host', 550, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0009-000000000004', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000009', 'Arjun Das (SNX-PNQ-01)', '+91 97000 93000', 'Line Cook', 650, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0009-000000000005', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000009', 'Deepak Roy (SNX-PNQ-01)', '+91 97000 94000', 'Kitchen Prep', 450, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0009-000000000006', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000009', 'Ramesh Yadav (SNX-PNQ-01)', '+91 97000 95000', 'Steward & Cleaning', 400, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0009-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000009',
  'La Marzocco Linea PB Espresso Machine',
  'grinder',
  'Linea PB 2-Group',
  'SNX-SNX-PNQ-01-100',
  '2025-01-15',
  650000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0009-000000000002',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000009',
  'Mahikonig EK43 Coffee Grinder',
  'grinder',
  'EK43S',
  'SNX-SNX-PNQ-01-101',
  '2025-01-15',
  185000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  60,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0009-000000000003',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000009',
  'True 2-Door Deep Freezer',
  'freezer',
  'T-49F-HC',
  'SNX-SNX-PNQ-01-102',
  '2025-01-15',
  145000,
  'Commercial Refrigeration Co',
  'working',
  '2026-09-01',
  120,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0009-000000000004',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000009',
  'Western Under-Counter Chiller',
  'chiller',
  'SRC 350',
  'SNX-SNX-PNQ-01-103',
  '2025-01-15',
  75000,
  'Western Refrigeration',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0009-000000000005',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000009',
  'Pitco Double-Basket Deep Fryer',
  'fryer',
  '35C+S',
  'SNX-SNX-PNQ-01-104',
  '2025-01-15',
  95000,
  'Kitchen Equip India',
  'working',
  '2026-09-01',
  180,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated',
  'manager.panjim@snaxia.in', crypt('password123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Denzil Fernandes"}', now(), now(), '', '', '', ''
) ON CONFLICT (id) DO UPDATE SET 
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at;

INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES ('60000000-0000-0000-0000-000000000010', '60000000-0000-0000-0000-000000000010', '{"sub":"60000000-0000-0000-0000-000000000010","email":"manager.panjim@snaxia.in"}'::jsonb, 'email', now(), now(), now())
ON CONFLICT (id, provider) DO NOTHING;

INSERT INTO public.shops (id, brand_id, name, code, address, phone, status)
VALUES ('50000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'Snaxia Panjim Promenade', 'SNX-GOA-01', 'Campal Promenade, Panjim, Goa', '+91 98230 88001', 'active')
ON CONFLICT (brand_id, code) DO NOTHING;

INSERT INTO public.profiles (id, role, brand_id, shop_id, full_name, phone, is_active, must_change_password)
VALUES ('60000000-0000-0000-0000-000000000010', 'manager', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000010', 'Denzil Fernandes', '+91 98230 88001', true, false)
ON CONFLICT (id) DO UPDATE SET 
  role = 'manager',
  brand_id = '11111111-1111-1111-1111-111111111111',
  shop_id = '50000000-0000-0000-0000-000000000010',
  full_name = 'Denzil Fernandes';

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0010-000000000001', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000010', 'Suresh Kumar (SNX-GOA-01)', '+91 97000 100000', 'Head Barista', 750, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0010-000000000002', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000010', 'Manoj Singh (SNX-GOA-01)', '+91 97000 101000', 'Barista', 600, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0010-000000000003', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000010', 'Sunil Gowda (SNX-GOA-01)', '+91 97000 102000', 'Cashier & Floor Host', 550, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0010-000000000004', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000010', 'Arjun Das (SNX-GOA-01)', '+91 97000 103000', 'Line Cook', 650, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0010-000000000005', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000010', 'Deepak Roy (SNX-GOA-01)', '+91 97000 104000', 'Kitchen Prep', 450, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employees (id, brand_id, shop_id, name, phone, role_title, rate_per_day, is_active)
VALUES ('70000000-0000-0000-0010-000000000006', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000010', 'Ramesh Yadav (SNX-GOA-01)', '+91 97000 105000', 'Steward & Cleaning', 400, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0010-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000010',
  'La Marzocco Linea PB Espresso Machine',
  'grinder',
  'Linea PB 2-Group',
  'SNX-SNX-GOA-01-100',
  '2025-01-15',
  650000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0010-000000000002',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000010',
  'Mahikonig EK43 Coffee Grinder',
  'grinder',
  'EK43S',
  'SNX-SNX-GOA-01-101',
  '2025-01-15',
  185000,
  'Kaapi Solutions',
  'working',
  '2026-09-01',
  60,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0010-000000000003',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000010',
  'True 2-Door Deep Freezer',
  'freezer',
  'T-49F-HC',
  'SNX-SNX-GOA-01-102',
  '2025-01-15',
  145000,
  'Commercial Refrigeration Co',
  'working',
  '2026-09-01',
  120,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0010-000000000004',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000010',
  'Western Under-Counter Chiller',
  'chiller',
  'SRC 350',
  'SNX-SNX-GOA-01-103',
  '2025-01-15',
  75000,
  'Western Refrigeration',
  'working',
  '2026-09-01',
  90,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, brand_id, shop_id, name, category, model, serial_no, purchase_date, cost, vendor, status, last_service_date, service_interval_days, next_service_due)
VALUES (
  '80000000-0000-0000-0010-000000000005',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000010',
  'Pitco Double-Basket Deep Fryer',
  'fryer',
  '35C+S',
  'SNX-SNX-GOA-01-104',
  '2025-01-15',
  95000,
  'Kitchen Equip India',
  'working',
  '2026-09-01',
  180,
  '2026-12-01'
) ON CONFLICT (id) DO NOTHING;

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
    v_brand_id UUID := '11111111-1111-1111-1111-111111111111';
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

COMMIT;