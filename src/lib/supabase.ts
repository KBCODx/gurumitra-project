import { createClient } from '@supabase/supabase-js'

const proc = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined;
const supabaseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || proc?.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || proc?.env?.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables are missing. ' +
    'Copy .env.example to .env and fill in your credentials. ' +
    'The app will run with limited functionality.'
  )
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null