#!/usr/bin/env node

/**
 * Update user plan to 'trade' for unlimited access
 * Usage: node scripts/update-user-plan.js <email>
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateUserPlan(email, plan = 'trade') {
  console.log(`🔍 Looking for user: ${email}`);

  // Find user by email
  const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();

  if (userError) {
    console.error('❌ Error fetching users:', userError);
    process.exit(1);
  }

  const user = users.find(u => u.email === email);

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.id} (${user.email})`);

  // Update user_preferences.plan
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: user.id,
      plan: plan,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })
    .select();

  if (error) {
    console.error('❌ Error updating plan:', error);
    process.exit(1);
  }

  console.log(`✅ Updated plan to '${plan}' for ${email}`);
  console.log('✅ User now has unlimited access to all features');

  // Verify the change
  const { data: prefs, error: verifyError } = await supabase
    .from('user_preferences')
    .select('plan')
    .eq('user_id', user.id)
    .single();

  if (!verifyError && prefs) {
    console.log(`✅ Verified: Current plan is '${prefs.plan}'`);
  }
}

const email = process.argv[2] || 'connordahl@hotmail.com';
updateUserPlan(email).catch(console.error);
