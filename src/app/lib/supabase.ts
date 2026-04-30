import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  { auth: { persistSession: true, autoRefreshToken: true, storage: typeof window !== 'undefined' ? window.localStorage : undefined } }
);

export const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-5520aacf`;
export const ANON_KEY = publicAnonKey;
