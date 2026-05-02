import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = raw?.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '');
  let role: string | null = null;
  if (key && key.length >= 50 && key.startsWith('eyJ')) {
    const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
    const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
    role = (data?.role as string) ?? null;
  } else {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    role = (data?.role as string) ?? null;
  }
  if (role !== 'admin') redirect('/dashboard');
  return { user, supabase };
}

export function adminClient() {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = raw?.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}
