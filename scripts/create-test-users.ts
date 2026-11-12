/**
 * CafeLedger - Supabase Auth Test Users Provisioner
 * Creates or updates test user accounts via Supabase Admin API.
 * 
 * Usage:
 *   npx tsx scripts/create-test-users.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Try loading .env.local first, then .env
const envLocal = path.join(process.cwd(), '.env.local');
const envDefault = path.join(process.cwd(), '.env');
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
} else if (fs.existsSync(envDefault)) {
  dotenv.config({ path: envDefault });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes('placeholder')) {
  console.log('Skipping API user creation: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL not configured.');
  console.log('You can still execute supabase/seed.sql directly in Supabase Dashboard SQL Editor!');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEFAULT_PASSWORD = 'password123';

const TEST_USERS = [
  // Master
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'master@cafeledger.io',
    fullName: 'Super Master Admin',
    role: 'master',
  },
  // Brand Admin
  {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'admin@snaxia.in',
    fullName: 'Vikram Malhotra',
    role: 'admin',
    brandId: '11111111-1111-1111-1111-111111111111',
  },
  // Shop Managers
  {
    id: '60000000-0000-0000-0000-000000000001',
    email: 'manager.indiranagar@snaxia.in',
    fullName: 'Rahul Sharma',
    role: 'manager',
    brandId: '11111111-1111-1111-1111-111111111111',
    shopId: '50000000-0000-0000-0000-000000000001',
  },
  {
    id: '60000000-0000-0000-0000-000000000002',
    email: 'manager.koramangala@snaxia.in',
    fullName: 'Sneha Patel',
    role: 'manager',
    brandId: '11111111-1111-1111-1111-111111111111',
    shopId: '50000000-0000-0000-0000-000000000002',
  },
  {
    id: '60000000-0000-0000-0000-000000000003',
    email: 'manager.bandra@snaxia.in',
    fullName: 'Rohan Deshmukh',
    role: 'manager',
    brandId: '11111111-1111-1111-1111-111111111111',
    shopId: '50000000-0000-0000-0000-000000000003',
  },
];

async function run() {
  console.log('Provisioning test users in Supabase Auth...');

  for (const u of TEST_USERS) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.fullName },
      });

      if (error) {
        if (error.message.includes('already exists') || error.message.includes('registered')) {
          console.log(`ℹ User ${u.email} already exists in auth.users.`);
        } else {
          console.warn(`Warning for ${u.email}:`, error.message);
        }
      } else {
        console.log(`✓ Created auth user ${u.email} (${u.role})`);
      }
    } catch (err: any) {
      console.warn(`Error for ${u.email}:`, err?.message);
    }
  }

  console.log('\nAll test users provisioned with password:', DEFAULT_PASSWORD);
}

run();

