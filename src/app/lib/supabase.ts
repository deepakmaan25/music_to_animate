import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

// Singleton Supabase client — import this everywhere, never call createClient twice.
// Config notes:
//   persistSession: true   → stores session in localStorage so refresh keeps user signed in
//   autoRefreshToken: true → silently refreshes the JWT before it expires
//   detectSessionInUrl: true → on /auth/callback, the client reads ?code= or #access_token=
//                              from the URL and exchanges it for a real session automatically
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
);

export const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-5520aacf`;
export const ANON_KEY = publicAnonKey;
