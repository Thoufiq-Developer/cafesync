/**
 * CafeLedger Seed Script Runner
 * Generates SQL seed file and optionally executes it against Supabase instance
 * if environment credentials are provided.
 */

import { writeSeedSQLFile } from './generate-seed-sql';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('--- CafeLedger Seed Script ---');
  console.log('Generating realistic dataset: 10 shops, 12 months, ₹12k-₹25k daily income, 20-30 expenses/day...');

  const seedFile = writeSeedSQLFile();
  console.log(`✓ Seed SQL generated at: ${seedFile}`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey && !supabaseUrl.includes('placeholder')) {
    console.log(`Connecting to Supabase instance at ${supabaseUrl}...`);
    try {
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      console.log('Executing seed SQL...');
      // Execute SQL content
      const sql = fs.readFileSync(seedFile, 'utf-8');
      const { error } = await supabase.rpc('exec_sql', { query: sql });
      if (error) {
        console.warn('Direct RPC execution not configured (exec_sql function not enabled).');
        console.log('Please apply seed.sql via Supabase Studio SQL Editor or Supabase CLI:');
        console.log('  supabase db reset');
        console.log('  OR copy contents of supabase/seed.sql into the Supabase Dashboard SQL Editor.');
      } else {
        console.log('✓ Successfully seeded database directly via service role key!');
      }
    } catch (err) {
      console.error('Error applying seed directly:', err);
    }
  } else {
    console.log('\nNOTE: To load into Supabase:');
    console.log('1. Copy supabase/seed.sql into Supabase Dashboard -> SQL Editor and hit RUN, OR');
    console.log('2. Run `npx supabase db reset` if using local Supabase CLI.\n');
  }
}

main().catch(console.error);

