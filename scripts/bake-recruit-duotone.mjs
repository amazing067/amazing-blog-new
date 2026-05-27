// 리쿠르팅 카드 듀오톤 사진 pre-bake.
// modern-screenshot가 런타임 CSS blend/filter 캡처를 못 하므로(스펙 §9),
// 큐레이션한 원본 사진을 "이미 듀오톤이 적용된 JPG"로 미리 구워 public/에 둔다.
//
// 사용법:
//   1) 무료 상업이용(Unsplash/Pexels) 국적-중립 장면(노트북·책상·손·카페·도시·뒷모습)을
//      scripts/recruit-photo-src/<slot>/<pillar|all>/ 에 떨군다. (README 참조)
//   2) node scripts/bake-recruit-duotone.mjs
//   → public/recruit-photos/<slot>/*.jpg 로 듀오톤 굽기
//   → lib/content/recruit-image-pool.json (POOL) 재생성
//
// slot = cover | breakthrough | evidence  (스펙 §4의 1·3·5 슬롯)
// pillar = P1-empathy | P2-system | P3-income | P4-lifestyle | P5-story
//          폴더명을 'all' 로 두면 전 기둥 공통(국적-중립 장면 대부분 여기).
import sharp from 'sharp';
import { readdirSync, mkdirSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const SRC_ROOT = 'scripts/recruit-photo-src';
const OUT_ROOT = 'public/recruit-photos';
const POOL_JSON = 'lib/content/recruit-image-pool.json';

const SLOTS = ['cover', 'breakthrough', 'evidence'];
const PILLARS = ['P1-empathy', 'P2-system', 'P3-income', 'P4-lifestyle', 'P5-story'];

// 슬롯별 듀오톤 틴트 — recruit-image.ts의 SLOT_TINT와 일치해야 함(cool-blue 스킴).
const SLOT_TINT = {
  cover: '#1E5BFF',
  breakthrough: '#0E9AA7',
  evidence: '#14307A',
};

const SIZE = 1080; // 1:1 (스펙: 1080×1080)
const SRC_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// 틴트 → (그림자색, 하이라이트색) 듀오톤 양끝 계산.
// 그림자 = 틴트를 어둡게(×0.32), 하이라이트 = 틴트를 흰색쪽으로(82%) — 슬롯마다 일관된 대비.
function duotoneStops(tint) {
  const [r, g, b] = hexToRgb(tint);
  const shadow = [r * 0.32, g * 0.32, b * 0.32];
  const highlight = [r + (255 - r) * 0.82, g + (255 - g) * 0.82, b + (255 - b) * 0.82];
  return { shadow, highlight };
}

const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

// 흑백(luma) → 듀오톤. 각 픽셀 luma(0..1)를 그림자↔하이라이트 사이로 채널별 보간.
// raw 버퍼로 직접 매핑(sharp .grayscale()는 1채널이라 .linear 3채널 확장이 막힘).
async function bakeOne(srcPath, outPath, tint) {
  const { shadow, highlight } = duotoneStops(tint);
  const { data, info } = await sharp(srcPath)
    .rotate() // EXIF 회전 보정
    .resize(SIZE, SIZE, { fit: 'cover', position: 'attention' })
    .grayscale()
    .normalise() // 대비 스트레치 → 또렷한 듀오톤
    .raw()
    .toBuffer({ resolveWithObject: true });

  const n = info.width * info.height;
  const out = Buffer.allocUnsafe(n * 3);
  for (let i = 0; i < n; i++) {
    const l = data[i * info.channels] / 255; // 첫 채널 = luma
    out[i * 3] = clamp8(shadow[0] + (highlight[0] - shadow[0]) * l);
    out[i * 3 + 1] = clamp8(shadow[1] + (highlight[1] - shadow[1]) * l);
    out[i * 3 + 2] = clamp8(shadow[2] + (highlight[2] - shadow[2]) * l);
  }

  await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(outPath);
}

function listImages(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => SRC_EXT.has(extname(f).toLowerCase()) && statSync(join(dir, f)).isFile())
    .sort();
}

async function main() {
  // POOL: { slot: { pillar: [filename, ...] } }
  const pool = Object.fromEntries(SLOTS.map((s) => [s, {}]));
  let baked = 0;

  for (const slot of SLOTS) {
    const outDir = join(OUT_ROOT, slot);
    // 슬롯 출력 폴더를 깨끗이 재생성(POOL과 파일 100% 동기화)
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });

    const slotSrc = join(SRC_ROOT, slot);
    if (!existsSync(slotSrc)) continue;

    // 하위 폴더 = pillar 또는 'all'
    const buckets = readdirSync(slotSrc).filter((d) => statSync(join(slotSrc, d)).isDirectory());
    for (const bucket of buckets) {
      const targetPillars = bucket === 'all' ? PILLARS : [bucket];
      const unknown = targetPillars.filter((p) => !PILLARS.includes(p));
      if (unknown.length) {
        console.warn(`  ⚠️  ${slot}/${bucket}: 알 수 없는 기둥 폴더 — 건너뜀 (허용: all, ${PILLARS.join(', ')})`);
        continue;
      }

      const imgs = listImages(join(slotSrc, bucket));
      for (const img of imgs) {
        const stem = basename(img, extname(img)).replace(/[^a-zA-Z0-9_-]/g, '-');
        const outName = `${bucket}__${stem}.jpg`;
        const outPath = join(outDir, outName);
        await bakeOne(join(slotSrc, bucket, img), outPath, SLOT_TINT[slot]);
        baked++;
        for (const p of targetPillars) {
          (pool[slot][p] ??= []).push(outName);
        }
        console.log(`  ✓ ${slot}/${bucket}/${img} → ${slot}/${outName}`);
      }
    }
  }

  writeFileSync(POOL_JSON, JSON.stringify(pool, null, 2) + '\n', 'utf8');

  const counts = SLOTS.map((s) => {
    const n = new Set(Object.values(pool[s]).flat()).size;
    return `${s}=${n}`;
  }).join(', ');
  console.log(`\n구운 사진 ${baked}장. 슬롯별 고유 파일: ${counts}`);
  console.log(`POOL 갱신: ${POOL_JSON}`);
  if (baked === 0) {
    console.log(`\n(원본 없음) ${SRC_ROOT}/<slot>/<pillar|all>/ 에 사진을 떨군 뒤 다시 실행하세요. README 참조.`);
  }
}

main().catch((e) => {
  console.error('duotone bake 실패:', e);
  process.exit(1);
});
