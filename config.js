// config.js
// IMPORTANTE: Reemplaza estos valores con los que obtengas de tu proyecto de Supabase (Project Settings -> API)
const SUPABASE_URL = 'https://sbvcicqpaljcjgbpwghe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qlqLdiHXeaoXjrn_FzAshw_ZZ_jMbDp';

window.supabaseConfig = {
    url: SUPABASE_URL,
    key: SUPABASE_ANON_KEY
};

// Inicializar cliente Supabase inmediatamente
// (El script de supabase-js se carga ANTES que config.js en el HTML)
if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase client initialized');
} else {
    window.supabaseClient = null;
    console.warn('⚠️ Supabase not initialized - running in localStorage mode');
}
