import { getTodayKolkata, getCurrentMonthKolkata } from './calculations/dates';
import { DEMO_BRAND } from './demo-data';
import { DEMO_ITEMS, DEMO_PAYMENT_MODES, DEMO_ASSETS } from './demo-shop-data';

export interface DemoShop {
  id: string;
  brand_id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  status: 'active' | 'inactive';
  created_at: string;
  managers: {
    id: string;
    full_name: string;
    email: string;
    username?: string | null;
    phone: string;
    is_active?: boolean;
    must_change_password?: boolean;
  }[];
  today_summary?: {
    opening: number;
    income: number;
    expense: number;
    closing: number;
    has_entries: boolean;
  };
  month_summary?: {
    opening: number;
    income: number;
    expense: number;
    closing: number;
    profit_loss: number;
  };
}

export const DEMO_ADMIN_SHOPS: DemoShop[] = [
  {
    id: '50000000-0000-0000-0000-000000000001',
    brand_id: DEMO_BRAND.id,
    name: 'Snaxia Indiranagar',
    code: 'SNX-BLR-01',
    address: '100ft Road, Indiranagar, Bengaluru',
    phone: '+91 98450 11001',
    status: 'active',
    created_at: '2025-01-01T00:00:00Z',
    managers: [
      { id: '60000000-0000-0000-0000-000000000001', full_name: 'Rahul Sharma', email: 'manager.indiranagar@snaxia.in', phone: '+91 98450 11001' },
    ],
    today_summary: { opening: 14500, income: 22800, expense: 9400, closing: 27900, has_entries: true },
    month_summary: { opening: 12000, income: 642000, expense: 384000, closing: 270000, profit_loss: 258000 },
  },
  {
    id: '50000000-0000-0000-0000-000000000002',
    brand_id: DEMO_BRAND.id,
    name: 'Snaxia Koramangala',
    code: 'SNX-BLR-02',
    address: '5th Block, Koramangala, Bengaluru',
    phone: '+91 98450 11002',
    status: 'active',
    created_at: '2025-01-10T00:00:00Z',
    managers: [
      { id: '60000000-0000-0000-0000-000000000002', full_name: 'Sneha Patel', email: 'manager.koramangala@snaxia.in', phone: '+91 98450 11002' },
    ],
    today_summary: { opening: 16200, income: 24500, expense: 11200, closing: 29500, has_entries: true },
    month_summary: { opening: 15000, income: 712000, expense: 418000, closing: 309000, profit_loss: 294000 },
  },
  {
    id: '50000000-0000-0000-0000-000000000003',
    brand_id: DEMO_BRAND.id,
    name: 'Snaxia Bandra West',
    code: 'SNX-BOM-01',
    address: 'Pali Hill, Bandra West, Mumbai',
    phone: '+91 98200 22001',
    status: 'active',
    created_at: '2025-02-01T00:00:00Z',
    managers: [
      { id: '60000000-0000-0000-0000-000000000003', full_name: 'Rohan Deshmukh', email: 'manager.bandra@snaxia.in', phone: '+91 98200 22001' },
    ],
    today_summary: { opening: 18000, income: 28400, expense: 13500, closing: 32900, has_entries: true },
    month_summary: { opening: 18000, income: 835000, expense: 462000, closing: 391000, profit_loss: 373000 },
  },
  {
    id: '50000000-0000-0000-0000-000000000004',
    brand_id: DEMO_BRAND.id,
    name: 'Snaxia Colaba',
    code: 'SNX-BOM-02',
    address: 'Near Gateway of India, Colaba, Mumbai',
    phone: '+91 98200 22002',
    status: 'active',
    created_at: '2025-02-15T00:00:00Z',
    managers: [
      { id: '60000000-0000-0000-0000-000000000004', full_name: 'Pooja Kulkarni', email: 'manager.colaba@snaxia.in', phone: '+91 98200 22002' },
    ],
    today_summary: { opening: 12500, income: 19800, expense: 8900, closing: 23400, has_entries: true },
    month_summary: { opening: 11000, income: 580000, expense: 334000, closing: 257000, profit_loss: 246000 },
  },
  {
    id: '50000000-0000-0000-0000-000000000005',
    brand_id: DEMO_BRAND.id,
    name: 'Snaxia Connaught Place',
    code: 'SNX-DEL-01',
    address: 'Inner Circle, CP, New Delhi',
    phone: '+91 98110 33001',
    status: 'active',
    created_at: '2025-03-01T00:00:00Z',
    managers: [
      { id: '60000000-0000-0000-0000-000000000005', full_name: 'Amit Verma', email: 'manager.cp@snaxia.in', phone: '+91 98110 33001' },
    ],
    today_summary: { opening: 21000, income: 31200, expense: 14800, closing: 37400, has_entries: true },
    month_summary: { opening: 19000, income: 890000, expense: 489000, closing: 420000, profit_loss: 401000 },
  },
  {
    id: '50000000-0000-0000-0000-000000000006',
    brand_id: DEMO_BRAND.id,
    name: 'Snaxia Jubilee Hills',
    code: 'SNX-HYD-01',
    address: 'Road No 36, Jubilee Hills, Hyderabad',
    phone: '+91 98490 44001',
    status: 'active',
    created_at: '2025-03-15T00:00:00Z',
    managers: [
      { id: '60000000-0000-0000-0000-000000000006', full_name: 'Kavita Reddy', email: 'manager.jubileehills@snaxia.in', phone: '+91 98490 44001' },
    ],
    today_summary: { opening: 13000, income: 18500, expense: 9200, closing: 22300, has_entries: true },
    month_summary: { opening: 12500, income: 545000, expense: 312000, closing: 245500, profit_loss: 233000 },
  },
  {
    id: '50000000-0000-0000-0000-000000000007',
    brand_id: DEMO_BRAND.id,
    name: 'Snaxia Anna Nagar',
    code: 'SNX-MAA-01',
    address: '2nd Avenue, Anna Nagar, Chennai',
    phone: '+91 98400 55001',
    status: 'active',
    created_at: '2025-04-01T00:00:00Z',
    managers: [
      { id: '60000000-0000-0000-0000-000000000007', full_name: 'Karthik Subramanian', email: 'manager.annanagar@snaxia.in', phone: '+91 98400 55001' },
    ],
    today_summary: { opening: 11500, income: 16800, expense: 7900, closing: 20400, has_entries: true },
    month_summary: { opening: 10500, income: 495000, expense: 288000, closing: 217500, profit_loss: 207000 },
  },
  {
    id: '50000000-0000-0000-0000-000000000008',
    brand_id: DEMO_BRAND.id,
    name: 'Snaxia Park Street',
    code: 'SNX-CCU-01',
    address: 'Park Street, Kolkata',
    phone: '+91 98300 66001',
    status: 'active',
    created_at: '2025-04-15T00:00:00Z',
    managers: [
      { id: '60000000-0000-0000-0000-000000000008', full_name: 'Anirban Sen', email: 'manager.parkstreet@snaxia.in', phone: '+91 98300 66001' },
    ],
    today_summary: { opening: 14000, income: 20400, expense: 9800, closing: 24600, has_entries: true },
    month_summary: { opening: 13000, income: 595000, expense: 341000, closing: 267000, profit_loss: 254000 },
  },
  {
    id: '50000000-0000-0000-0000-000000000009',
    brand_id: DEMO_BRAND.id,
    name: 'Snaxia Koregaon Park',
    code: 'SNX-PNQ-01',
    address: 'North Main Road, Koregaon Park, Pune',
    phone: '+91 98220 77001',
    status: 'active',
    created_at: '2025-05-01T00:00:00Z',
    managers: [
      { id: '60000000-0000-0000-0000-000000000009', full_name: 'Neha Joshi', email: 'manager.koregaon@snaxia.in', phone: '+91 98220 77001' },
    ],
    // NOTICE: Koregaon Park has NO entries recorded today (triggers missing entries alert)
    today_summary: { opening: 15000, income: 0, expense: 0, closing: 15000, has_entries: false },
    month_summary: { opening: 14000, income: 520000, expense: 310000, closing: 224000, profit_loss: 210000 },
  },
  {
    id: '50000000-0000-0000-0000-000000000010',
    brand_id: DEMO_BRAND.id,
    name: 'Snaxia Panjim Promenade',
    code: 'SNX-GOA-01',
    address: 'Campal Promenade, Panjim, Goa',
    phone: '+91 98230 88001',
    status: 'active',
    created_at: '2025-06-01T00:00:00Z',
    managers: [
      { id: '60000000-0000-0000-0000-000000000010', full_name: 'Denzil Fernandes', email: 'manager.panjim@snaxia.in', phone: '+91 98230 88001' },
    ],
    // NOTICE: Panjim Promenade has NO entries recorded today (triggers missing entries alert)
    today_summary: { opening: 13500, income: 0, expense: 0, closing: 13500, has_entries: false },
    month_summary: { opening: 12000, income: 460000, expense: 275000, closing: 197000, profit_loss: 185000 },
  },
];

export interface DemoAuditLog {
  id: string;
  user_name: string;
  action: string;
  table_name: string;
  record_id: string;
  details: string;
  at: string;
}

export const DEMO_AUDIT_LOGS: DemoAuditLog[] = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    user_name: 'Rahul Sharma (Manager)',
    action: 'CREATE',
    table_name: 'transactions',
    record_id: 't-101',
    details: 'Added Expense ₹1,200 (Fresh Milk & Cream)',
    at: '10 mins ago',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    user_name: 'Sneha Patel (Manager)',
    action: 'CREATE',
    table_name: 'transactions',
    record_id: 't-102',
    details: 'Added Income ₹14,500 (Counter Billing)',
    at: '25 mins ago',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    user_name: 'Rahul Sharma (Manager)',
    action: 'CREATE',
    table_name: 'item_requests',
    record_id: 'ir-103',
    details: 'Requested new item category "Organic Oat Milk (Alpro)"',
    at: '1 hour ago',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000004',
    user_name: 'Vikram Malhotra (Admin)',
    action: 'UPDATE',
    table_name: 'brands',
    record_id: DEMO_BRAND.id,
    details: 'Updated brand primary color to #ea580c',
    at: '3 hours ago',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000005',
    user_name: 'Rohan Deshmukh (Manager)',
    action: 'CREATE',
    table_name: 'transactions',
    record_id: 't-105',
    details: 'Added Salary Advance ₹2,000 for Suresh Kumar (SA-Suresh Kumar)',
    at: '4 hours ago',
  },
];

export interface DemoItemRequestWithShop {
  id: string;
  shop_id: string;
  shop_name: string;
  shop_code: string;
  requested_by_name: string;
  name: string;
  kind: 'income' | 'expense';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export const DEMO_ADMIN_ITEM_REQUESTS: DemoItemRequestWithShop[] = [
  {
    id: '90000000-0000-0000-0000-000000000001',
    shop_id: '50000000-0000-0000-0000-000000000001',
    shop_name: 'Snaxia Indiranagar',
    shop_code: 'SNX-BLR-01',
    requested_by_name: 'Rahul Sharma',
    name: 'Organic Oat Milk (Alpro)',
    kind: 'expense',
    status: 'pending',
    created_at: '2026-11-09T10:30:00Z',
  },
  {
    id: '90000000-0000-0000-0000-000000000002',
    shop_id: '50000000-0000-0000-0000-000000000002',
    shop_name: 'Snaxia Koramangala',
    shop_code: 'SNX-BLR-02',
    requested_by_name: 'Sneha Patel',
    name: 'Espresso Tonic Summer Special',
    kind: 'income',
    status: 'pending',
    created_at: '2026-11-09T09:15:00Z',
  },
  {
    id: '90000000-0000-0000-0000-000000000003',
    shop_id: '50000000-0000-0000-0000-000000000003',
    shop_name: 'Snaxia Bandra West',
    shop_code: 'SNX-BOM-01',
    requested_by_name: 'Rohan Deshmukh',
    name: 'Gluten-Free Almond Croissants',
    kind: 'expense',
    status: 'approved',
    created_at: '2026-11-08T14:20:00Z',
  },
];

