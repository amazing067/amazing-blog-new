// 카드뉴스 5개 디자인(B/C/D/E/F) 시안을 검수 큐에 직접 insert
// 사용법: node scripts/seed-card-styles.mjs
// 전제: .env.local에 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
//       Supabase에 card_style 컬럼이 추가된 상태
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// .env.local 직접 파싱 (dotenv 의존성 회피)
const envText = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('환경변수 누락: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supa = createClient(url, key);

// 5개 디자인 모두 같은 콘텐츠 사용 — 디자인 차이만 비교 가능
const SLIDES = [
  {
    kind: 'cover',
    eyebrow: '암보험_재발',
    title: '암 재발 후 5년 안에 다시 걸릴 확률',
    bigStat: '37%',
    bigStatLabel: '5년 내 재발률',
    iconKey: 'stethoscope',
  },
  {
    kind: 'point',
    number: '01',
    bigStat: '5년',
    bigStatLabel: '주의 관찰 기간',
    title: '재발률은 시간이 지나도 안 떨어진다',
    body: '완치 판정 후에도 5년간 정기 검진이 필수예요. 1~2년 차에 재발이 가장 많아요.',
    iconKey: 'alert',
  },
  {
    kind: 'point',
    number: '02',
    bigStat: '2.4배',
    bigStatLabel: '추가 치료비',
    title: '재발 시 치료비는 첫 진단의 2배',
    body: '표적치료·면역항암 등 고가 치료가 동반되기 쉬워요.',
    iconKey: 'trendingDown',
  },
  {
    kind: 'point',
    number: '03',
    bigStat: '3배',
    bigStatLabel: '부담 차이',
    title: '진단금이 결정적 차이를 만든다',
    body: '비급여 항목이 늘어 본인부담이 폭증해요. 진단금이 있으면 큰 짐이 줄어요.',
    iconKey: 'shield',
  },
  {
    kind: 'closing',
    title: '기억할 3가지',
    items: [
      '완치 후에도 5년 정기 검진',
      '재발 치료비는 첫 진단의 2배',
      '진단금이 결정적 차이',
    ],
    footer: '본 콘텐츠는 정보 제공 목적이며, 보장은 약관에 따릅니다.',
    iconKey: 'clipboard',
  },
];

const STYLES = [
  { key: 'B', label: 'Magazine (화)' },
  { key: 'C', label: 'Pastel (수)' },
  { key: 'D', label: 'Dark Premium (목)' },
  { key: 'E', label: 'Data Report (금)' },
  { key: 'F', label: 'Y2K Retro (토)' },
];

let ok = 0, fail = 0;
for (const s of STYLES) {
  const { error, data } = await supa.from('content_items').insert({
    type: 'card',
    title: `[${s.key} · ${s.label} 시안] 암 재발 후 5년 안에 재발률 — 디자인 검수`,
    card_slides: SLIDES,
    status: 'review',
    enforcement_mode: 'open',
    generated_by: 'seed-script',
    card_style: s.key,
    source_refs: [{ topic_slug: `seed-style-${s.key}`, category: '암·진단', generated_by: 'seed' }],
    fact_check: { passed: true, issues: [] },
    gen_input_tokens: 0, gen_output_tokens: 0, gen_cost_usd: 0,
    fc_input_tokens: 0, fc_output_tokens: 0, fc_cost_usd: 0,
    total_cost_usd: 0,
  }).select('id').single();
  if (error) {
    console.error(`[${s.key}] insert 실패:`, error.message ?? error);
    fail++;
  } else {
    console.log(`[${s.key}] 생성 OK · id=${data?.id}`);
    ok++;
  }
}

console.log(`\n완료: ${ok}건 성공, ${fail}건 실패`);
console.log('어드민 확인: /admin/content/cards');
