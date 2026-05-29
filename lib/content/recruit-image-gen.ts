// 리쿠르팅 카드 이미지 — 토픽 내용에 맞춰 카드 생성 시점에 실시간 생성.
// 흐름: topic.scenes[slot] + STYLE → Imagen 4 → sharp 듀오톤 → Supabase Storage 업로드 → 공개 URL.
// 실패 시 호출부(route)가 기존 정적 풀로 폴백한다.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecruitImage, RecruitTopic } from './types';
import { SLOT_TINT, type RecruitImageSlot } from './recruit-image';
import { applyDuotone } from './duotone';

const BUCKET = 'recruit-photos';

// 공통 스타일 — 얼굴/글자 없는 국적-중립 장면. (generate-recruit-photos.mjs와 일관)
const STYLE =
  'photorealistic, no people faces, no readable text, no watermark, soft natural light, professional stock photo, 1:1';

// Imagen 4 (Google Generative Language API). base64 PNG/JPEG 버퍼 반환.
async function genImagen(prompt: string): Promise<Buffer> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY/GOOGLE_API_KEY 없음');
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict',
    {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '1:1' },
      }),
    },
  );
  if (!res.ok) throw new Error(`Imagen ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const b64 = j.predictions?.[0]?.bytesBase64Encoded || j.predictions?.[0]?.image?.imageBytes;
  if (!b64) throw new Error('Imagen 응답에 이미지 없음');
  return Buffer.from(b64, 'base64');
}

// 버킷이 없으면 만든다(공개). 이미 있으면 무시. 캡처 CORS 위해 공개 버킷 사용.
async function ensureBucket(supa: SupabaseClient): Promise<void> {
  const { error } = await supa.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '5MB',
    allowedMimeTypes: ['image/jpeg'],
  });
  // 이미 존재(409)면 정상.
  if (error && !/exist/i.test(error.message)) throw error;
}

/**
 * 토픽+슬롯에 맞는 듀오톤 사진을 실시간 생성해 Supabase에 올리고 RecruitImage 반환.
 * 실패하면 throw — 호출부에서 잡아 정적 풀로 폴백.
 */
export async function generateRecruitImageForTopic(
  supa: SupabaseClient,
  topic: RecruitTopic,
  slot: RecruitImageSlot,
): Promise<RecruitImage> {
  const tint = SLOT_TINT[slot];
  const prompt = `${topic.scenes[slot]}, ${STYLE}`;

  const raw = await genImagen(prompt);
  const duotone = await applyDuotone(raw, tint);

  await ensureBucket(supa);
  const path = `generated/${topic.slug}/${slot}-${crypto.randomUUID()}.jpg`;
  const { error: upErr } = await supa.storage
    .from(BUCKET)
    .upload(path, duotone, { contentType: 'image/jpeg', upsert: true });
  if (upErr) throw upErr;

  const { data } = supa.storage.from(BUCKET).getPublicUrl(path);
  return { src: data.publicUrl, tint };
}
