// 리쿠르팅 듀오톤용 장면 사진을 이미지 AI로 생성. (Pexels fetch의 AI 버전)
// 기본 Imagen 4(Google). 생성 결과는 scripts/recruit-photo-src/<slot>/all/ 에 들어가고,
// 이어서 `node scripts/bake-recruit-duotone.mjs` 로 듀오톤+POOL 처리(기존 파이프라인 그대로).
//
// 사용법:
//   node scripts/generate-recruit-photos.mjs            # Imagen 4, 슬롯당 4장 추가
//   node scripts/generate-recruit-photos.mjs gpt 3      # gpt-image-1, 슬롯당 3장
//   node scripts/generate-recruit-photos.mjs imagen 4 --replace   # 기존 소스 비우고 AI만
// 전제: .env.local 에 GEMINI_API_KEY(or GOOGLE_API_KEY) / OPENAI_API_KEY
import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const GKEY = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
const OKEY = env.OPENAI_API_KEY;

const MODEL = (process.argv[2] || 'imagen').toLowerCase();        // imagen | gpt
const COUNT = parseInt(process.argv[3] || '4', 10);                // 슬롯당 장수
const REPLACE = process.argv.includes('--replace');               // 기존 소스 비우고 AI만
const SRC_ROOT = 'scripts/recruit-photo-src';

const STYLE = 'photorealistic, no people faces, no readable text, no watermark, soft natural light, professional stock photo, 1:1';

// 슬롯별 프롬프트 변주 — 얼굴 없는 국적-중립 장면.
const PROMPTS = {
  cover: [
    `top-down flat lay of an open laptop, notebook and a cup of coffee on a clean light wooden desk, minimalist, ${STYLE}`,
    `modern bright home-office desk with a laptop and a small plant, window light, aspirational, ${STYLE}`,
    `cozy cafe table with an open laptop and iced coffee, warm tones, ${STYLE}`,
  ],
  breakthrough: [
    `close-up of hands typing on a laptop keyboard seen from above, only hands, ${STYLE}`,
    `a hand holding a smartphone with a blank screen over a desk with a laptop, only hand, ${STYLE}`,
    `hands writing in a notebook next to a laptop, top-down, only hands, ${STYLE}`,
  ],
  evidence: [
    `top-down business charts, bar and line graphs on paper with a pen and a calculator on a desk, clean, ${STYLE}`,
    `a laptop showing a colorful analytics dashboard on a desk with a notebook, ${STYLE}`,
    `a stack of report documents and a tablet showing graphs on an office desk, ${STYLE}`,
  ],
};

async function genImagen(prompt) {
  if (!GKEY) throw new Error('GEMINI_API_KEY 없음');
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict', {
    method: 'POST',
    headers: { 'x-goog-api-key': GKEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: '1:1' } }),
  });
  if (!res.ok) throw new Error(`Imagen ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const b64 = j.predictions?.[0]?.bytesBase64Encoded || j.predictions?.[0]?.image?.imageBytes;
  if (!b64) throw new Error('Imagen 응답에 이미지 없음');
  return Buffer.from(b64, 'base64');
}

async function genOpenAI(prompt) {
  if (!OKEY) throw new Error('OPENAI_API_KEY 없음');
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OKEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024', quality: 'medium', n: 1 }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI 응답에 이미지 없음');
  return Buffer.from(b64, 'base64');
}

const gen = MODEL === 'gpt' ? genOpenAI : genImagen;

async function main() {
  console.log(`모델=${MODEL} · 슬롯당 ${COUNT}장 · ${REPLACE ? '기존 소스 비우고 AI만' : '기존에 추가(혼합)'}`);
  let total = 0;
  for (const [slot, prompts] of Object.entries(PROMPTS)) {
    const dir = join(SRC_ROOT, slot, 'all');
    mkdirSync(dir, { recursive: true });
    if (REPLACE) {
      for (const f of readdirSync(dir)) if (/\.(jpg|jpeg|png|webp)$/i.test(f)) rmSync(join(dir, f));
    }
    for (let i = 0; i < COUNT; i++) {
      const prompt = prompts[i % prompts.length];
      const out = join(dir, `ai-${MODEL}-${slot}-${i + 1}.jpg`);
      if (existsSync(out)) { console.log(`  · 이미 있음 ${out}`); continue; }
      try {
        const buf = await gen(prompt);
        writeFileSync(out, buf);
        total++;
        console.log(`  ✓ ${slot}/all/ai-${MODEL}-${slot}-${i + 1}.jpg`);
      } catch (e) {
        console.warn(`  ✗ ${slot} #${i + 1}: ${e.message}`);
      }
    }
  }
  console.log(`\n생성 ${total}장 → ${SRC_ROOT}/<slot>/all/`);
  console.log(`다음: node scripts/bake-recruit-duotone.mjs  (듀오톤 굽기 + POOL 갱신)`);
}

main().catch((e) => { console.error('생성 실패:', e); process.exit(1); });
