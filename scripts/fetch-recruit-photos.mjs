// 리쿠르팅 듀오톤용 원본 사진을 Pexels에서 자동 큐레이션.
// 얼굴 안 드러나는 국적-중립 장면(노트북·책상·손·카페·도시·뒷모습)만 검색어로 노린다.
// 받은 원본은 scripts/recruit-photo-src/<slot>/all/ 에 저장 → 이어서 bake-recruit-duotone.mjs로 듀오톤 굽기.
//
// 사용법: node scripts/fetch-recruit-photos.mjs
// 전제: .env.local 에 PEXELS_API_KEY
//
// 어색한 컷이 섞이면 해당 파일만 지우고 `node scripts/bake-recruit-duotone.mjs` 재실행.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const KEY = env.PEXELS_API_KEY;
if (!KEY) {
  console.error('환경변수 누락: PEXELS_API_KEY (.env.local)');
  process.exit(1);
}

const SRC_ROOT = 'scripts/recruit-photo-src';
const PER_SLOT = 4; // 슬롯당 받을 장수

// 슬롯별 검색어 — 얼굴 없는 장면 위주. (커버=후킹/일터, 통념=손·작업, 증거=성장·도시)
const SLOT_QUERIES = {
  cover: ['laptop coffee shop', 'modern workspace desk', 'city skyline window office'],
  breakthrough: ['hands typing laptop keyboard', 'notebook pen coffee desk', 'open laptop plant desk'],
  evidence: ['business documents charts desk', 'city night skyline lights', 'stack of books desk lamp'],
};

const used = new Set(); // 슬롯 간 중복 사진 방지

async function searchPexels(query, perPage = 15) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: KEY } });
  if (!res.ok) throw new Error(`Pexels ${res.status} for "${query}": ${await res.text()}`);
  const json = await res.json();
  return json.photos ?? [];
}

async function download(src, outPath) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`download ${res.status} ${src}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
}

async function main() {
  let total = 0;
  for (const [slot, queries] of Object.entries(SLOT_QUERIES)) {
    const outDir = join(SRC_ROOT, slot, 'all');
    mkdirSync(outDir, { recursive: true });

    // 여러 검색어 결과를 합쳐 후보 풀 구성
    const candidates = [];
    for (const q of queries) {
      try {
        const photos = await searchPexels(q);
        for (const p of photos) candidates.push(p);
      } catch (e) {
        console.warn(`  ⚠️  검색 실패 "${q}": ${e.message}`);
      }
    }

    let got = 0;
    for (const p of candidates) {
      if (got >= PER_SLOT) break;
      if (used.has(p.id)) continue;
      const src = p.src?.large2x || p.src?.original || p.src?.large;
      if (!src) continue;
      const outPath = join(outDir, `pexels-${p.id}.jpg`);
      if (existsSync(outPath)) { used.add(p.id); continue; }
      try {
        await download(src, outPath);
        used.add(p.id);
        got++;
        total++;
        console.log(`  ✓ ${slot}/all/pexels-${p.id}.jpg  (by ${p.photographer})`);
      } catch (e) {
        console.warn(`  ⚠️  다운 실패 ${p.id}: ${e.message}`);
      }
    }
    if (got < PER_SLOT) console.warn(`  ⚠️  ${slot}: ${got}/${PER_SLOT}장만 받음 (검색어 조정 필요할 수 있음)`);
  }

  console.log(`\n받은 원본 ${total}장 → ${SRC_ROOT}/<slot>/all/`);
  console.log(`다음: node scripts/bake-recruit-duotone.mjs  (듀오톤 굽기 + POOL 갱신)`);
}

main().catch((e) => {
  console.error('Pexels fetch 실패:', e);
  process.exit(1);
});
