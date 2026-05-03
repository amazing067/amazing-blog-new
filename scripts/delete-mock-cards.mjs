// 디자인 검수용으로 만든 5건 mock 카드뉴스 삭제
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = {};
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// generated_by='seed-script' 인 5건 삭제
const { data, error } = await supa.from('content_items')
  .delete()
  .eq('generated_by', 'seed-script')
  .eq('type', 'card')
  .select('id, card_style');

if (error) {
  console.error('삭제 실패:', error.message);
  process.exit(1);
}
console.log(`삭제 완료: ${data?.length ?? 0}건`);
data?.forEach(d => console.log(`  · ${d.card_style} · ${d.id}`));
