import { getTodayKolkata, getCurrentMonthKolkata } from './calculations/dates';
import { formatSalaryAdvanceNote } from './calculations/financials';

export const DEMO_ITEMS = [
  { id: '40000000-0000-0000-0000-000000000001', name: 'Counter Billing', kind: 'income', category: 'Sales', unit: 'pcs', default_rate: null, is_active: true },
  { id: '40000000-0000-0000-0000-000000000002', name: 'Swiggy Online', kind: 'income', category: 'Online', unit: 'pcs', default_rate: null, is_active: true },
  { id: '40000000-0000-0000-0000-000000000003', name: 'Zomato Online', kind: 'income', category: 'Online', unit: 'pcs', default_rate: null, is_active: true },
  { id: '40000000-0000-0000-0000-000000000004', name: 'Catering & Events', kind: 'income', category: 'Events', unit: 'pcs', default_rate: null, is_active: true },
  { id: '40000000-0000-0000-0000-000000000005', name: 'Coffee Beans Retail', kind: 'income', category: 'Retail', unit: 'packet', default_rate: 450, is_active: true },

  { id: '40000000-0000-0000-0000-000000000010', name: 'Fresh Milk & Cream', kind: 'expense', category: 'Dairy', unit: 'L', default_rate: 62, is_active: true },
  { id: '40000000-0000-0000-0000-000000000011', name: 'Specialty Coffee Beans', kind: 'expense', category: 'Beverages', unit: 'kg', default_rate: 1260, is_active: true },
  { id: '40000000-0000-0000-0000-000000000012', name: 'Artisan Breads & Croissants', kind: 'expense', category: 'Bakery', unit: 'pcs', default_rate: 45, is_active: true },
  { id: '40000000-0000-0000-0000-000000000013', name: 'Fresh Fruits & Veggies', kind: 'expense', category: 'Produce', unit: 'kg', default_rate: 80, is_active: true },
  { id: '40000000-0000-0000-0000-000000000014', name: 'Gourmet Syrups & Purees', kind: 'expense', category: 'Beverages', unit: 'pcs', default_rate: 520, is_active: true },
  { id: '40000000-0000-0000-0000-000000000015', name: 'Takeaway Cups & Packaging', kind: 'expense', category: 'Packaging', unit: 'box', default_rate: 950, is_active: true },
  { id: '40000000-0000-0000-0000-000000000016', name: 'Commercial Gas Cylinder', kind: 'expense', category: 'Utilities', unit: 'pcs', default_rate: 1950, is_active: true },
  { id: '40000000-0000-0000-0000-000000000017', name: 'Electricity Recharge', kind: 'expense', category: 'Utilities', unit: 'pcs', default_rate: null, is_active: true },
  { id: '40000000-0000-0000-0000-000000000018', name: 'Water Cans & Ice Blocks', kind: 'expense', category: 'Kitchen', unit: 'pcs', default_rate: 60, is_active: true },
  { id: '40000000-0000-0000-0000-000000000019', name: 'Cleaning & Sanitization', kind: 'expense', category: 'Maintenance', unit: 'packet', default_rate: 220, is_active: true },
  { id: '40000000-0000-0000-0000-000000000021', name: 'Salary Advance', kind: 'expense', category: 'Payroll', unit: 'pcs', default_rate: null, is_active: true },
  { id: '40000000-0000-0000-0000-000000000023', name: 'Minor Machine Repairs', kind: 'expense', category: 'Repairs', unit: 'pcs', default_rate: null, is_active: true },
  { id: '40000000-0000-0000-0000-000000000024', name: 'Staff Refreshments', kind: 'expense', category: 'Staff Welfare', unit: 'pcs', default_rate: null, is_active: true },
  { id: '40000000-0000-0000-0000-000000000026', name: 'Cheese, Butter & Sauces', kind: 'expense', category: 'Kitchen', unit: 'kg', default_rate: 480, is_active: true },
  { id: '40000000-0000-0000-0000-000000000028', name: 'Miscellaneous Petty Cash', kind: 'expense', category: 'General', unit: 'pcs', default_rate: null, is_active: true },
];

export const DEMO_PAYMENT_MODES = [
  { id: '30000000-0000-0000-0000-000000000001', name: 'CASH', is_active: true },
  { id: '30000000-0000-0000-0000-000000000002', name: 'GPAY', is_active: true },
  { id: '30000000-0000-0000-0000-000000000003', name: 'BANK', is_active: true },
  { id: '30000000-0000-0000-0000-000000000004', name: 'CARD', is_active: true },
];

export const DEMO_EMPLOYEES = [
  { id: '70000000-0000-0000-0001-000000000001', name: 'Suresh Kumar', phone: '+91 97000 10001', role_title: 'Head Barista', rate_per_day: 750, is_active: true },
  { id: '70000000-0000-0000-0001-000000000002', name: 'Manoj Singh', phone: '+91 97000 10002', role_title: 'Barista', rate_per_day: 600, is_active: true },
  { id: '70000000-0000-0000-0001-000000000003', name: 'Sunil Gowda', phone: '+91 97000 10003', role_title: 'Cashier & Floor Host', rate_per_day: 550, is_active: true },
  { id: '70000000-0000-0000-0001-000000000004', name: 'Arjun Das', phone: '+91 97000 10004', role_title: 'Line Cook', rate_per_day: 650, is_active: true },
  { id: '70000000-0000-0000-0001-000000000005', name: 'Deepak Roy', phone: '+91 97000 10005', role_title: 'Kitchen Prep', rate_per_day: 450, is_active: true },
  { id: '70000000-0000-0000-0001-000000000006', name: 'Ramesh Yadav', phone: '+91 97000 10006', role_title: 'Steward & Cleaning', rate_per_day: 400, is_active: true },
];

export const DEMO_ASSETS = [
  {
    id: '80000000-0000-0000-0001-000000000001',
    name: 'La Marzocco Linea PB Espresso Machine',
    category: 'grinder',
    model: 'Linea PB 2-Group',
    serial_no: 'SNX-BLR-01-100',
    purchase_date: '2025-01-15',
    cost: 650000,
    vendor: 'Kaapi Solutions',
    status: 'working',
    last_service_date: '2026-09-01',
    service_interval_days: 90,
    next_service_due: '2026-12-01',
    notes: 'Descaled group heads. Steam wand pressure calibrated.',
  },
  {
    id: '80000000-0000-0000-0001-000000000002',
    name: 'Mahlkonig EK43 Coffee Grinder',
    category: 'grinder',
    model: 'EK43S Commercial',
    serial_no: 'SNX-BLR-01-101',
    purchase_date: '2025-01-20',
    cost: 185000,
    vendor: 'Kaapi Solutions',
    status: 'working',
    last_service_date: '2026-10-15',
    service_interval_days: 60,
    next_service_due: '2026-11-12', // Due within 3 days -> AMBER!
    notes: 'Burrs checked, vacuum cleaned.',
  },
  {
    id: '80000000-0000-0000-0001-000000000003',
    name: 'True 2-Door Deep Freezer',
    category: 'freezer',
    model: 'T-49F-HC',
    serial_no: 'SNX-BLR-01-102',
    purchase_date: '2025-02-10',
    cost: 145000,
    vendor: 'Commercial Refrigeration Co',
    status: 'needs_repair',
    last_service_date: '2026-06-15',
    service_interval_days: 120,
    next_service_due: '2026-10-15', // Passed -> OVERDUE / RED!
    notes: 'Coils iced up, thermostat cycling frequently.',
  },
  {
    id: '80000000-0000-0000-0001-000000000004',
    name: 'Western Under-Counter Chiller',
    category: 'chiller',
    model: 'SRC 350',
    serial_no: 'SNX-BLR-01-103',
    purchase_date: '2025-02-15',
    cost: 75000,
    vendor: 'Western Refrigeration',
    status: 'working',
    last_service_date: '2026-08-25',
    service_interval_days: 90,
    next_service_due: '2026-11-25',
    notes: 'Door gaskets checked and lubricated.',
  },
  {
    id: '80000000-0000-0000-0001-000000000005',
    name: 'Pitco Double-Basket Deep Fryer',
    category: 'fryer',
    model: '35C+S Gas Fryer',
    serial_no: 'SNX-BLR-01-104',
    purchase_date: '2025-02-28',
    cost: 95000,
    vendor: 'Kitchen Equip India',
    status: 'working',
    last_service_date: '2026-05-15',
    service_interval_days: 180,
    next_service_due: '2026-11-15', // Due in 6 days -> AMBER!
    notes: 'Gas valve nozzles cleared.',
  },
];

export {};

