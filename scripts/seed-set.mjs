// 리쿠르팅 이미지카드 1세트 insert. 실행: node scripts/seed-set.mjs <세트번호 1~6>
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv(){try{const t=readFileSync(join(__dirname,'..','.env.local'),'utf8');for(const l of t.split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(!m)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}catch{}}
loadEnv();
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, (process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim().replace(/[\r\n]/g,'').replace(/\s+/g,''));

const SETS = {
  1: { title: '설계사 모집 — 월요일 번아웃 (신규)',     pillar: 'P1-empathy', target: '2030-newbie' },
  2: { title: '설계사 모집 — 통장은 그대로 (신규)',     pillar: 'P1-empathy', target: '2030-newbie' },
  3: { title: '설계사 모집 — 지인영업 없이도 (신규)',   pillar: 'P2-system',  target: '2030-newbie' },
  4: { title: '설계사 영입 — 1200%룰 평준화 (경력)',    pillar: 'P3-income',  target: 'career-changer' },
  5: { title: '설계사 영입 — 우리가 직접 만들었다 (경력)', pillar: 'P3-income', target: 'career-changer' },
  6: { title: '설계사 영입 — 시스템 없으면 못 버틴다 (경력)', pillar: 'P3-income', target: 'career-changer' },
};

const n = Number(process.argv[2]);
const s = SETS[n];
if (!s) { console.error('세트 번호 1~6 필요'); process.exit(1); }

const { data, error } = await supa.from('content_items').insert({
  type: 'recruit-card',
  title: s.title,
  body_md: s.title,
  card_slides: null,
  image_urls: Array.from({ length: 6 }, (_, i) => `/recruit-cards/set${n}-${i + 1}.png`),
  card_style: 'A',
  status: 'review',
  source_refs: [{ pillar: s.pillar, target: s.target, image_set: n, image_mode: true, generated_by: 'higgsfield-manual' }],
}).select('id, title').single();
if (error) { console.error('❌ insert 실패:', error.message); process.exit(1); }
console.log(`✅ 세트${n} 등록 완료 (status=review): ${data.title} (${data.id})`);
