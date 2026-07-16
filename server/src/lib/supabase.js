const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.warn('[supabase] Missing Supabase config. Storage will fall back to local mode.');
}

module.exports = supabaseUrl && supabaseSecretKey
  ? createClient(supabaseUrl, supabaseSecretKey)
  : null;
