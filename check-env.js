// Quick diagnostic to check if environment variables are loaded
console.log('\n=== Environment Variables Check ===\n');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL || 'NOT SET');
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ?
  `${process.env.VITE_SUPABASE_ANON_KEY.substring(0, 20)}... (${process.env.VITE_SUPABASE_ANON_KEY.length} chars)` :
  'NOT SET');
console.log('\nNote: In Vite, use import.meta.env.VITE_* in browser code\n');
