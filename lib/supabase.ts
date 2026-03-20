import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create a single supabase client for interacting with your database
const isNexOps = window.location.hostname.endsWith('.nexops.cash');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'supabase.auth.token',
        ...(isNexOps ? {
            cookieOptions: {
                domain: '.nexops.cash',
                path: '/',
                sameSite: 'lax',
                secure: true
            }
        } : {})
    }
});
