// Pexels 무료 스톡 이미지 — 리쿠르팅 카드 커버 배경용.
// 무료: 200건/시간, 20,000건/월, 상업적 사용 OK, 출처표기 의무 없음.
// PEXELS_API_KEY 환경변수 필요. 없거나 실패하면 null → 렌더는 사진 없이 비비드 커버로 폴백.

import type { RecruitPillar } from './types';

const ENDPOINT = 'https://api.pexels.com/v1/search';

// 기둥별 영문 검색어 (Pexels는 영문이 결과 품질 좋음). 한국 이미지는 부족해 배경/추상 위주.
const PILLAR_QUERY: Record<RecruitPillar, string> = {
  'P1-empathy': 'tired office worker desk window',
  'P2-system': 'business team meeting mentoring office',
  'P3-income': 'confident business professional success',
  'P4-lifestyle': 'working laptop cafe lifestyle bright',
  'P5-story': 'professional portrait smiling office',
};

export function recruitImageQuery(pillar: RecruitPillar): string {
  return PILLAR_QUERY[pillar] ?? 'business office professional';
}

type PexelsPhoto = { src?: { large?: string; large2x?: string; medium?: string } };

/** 검색어로 Pexels 사진 1장 URL 반환. 키 없거나 결과 없으면 null. */
export async function fetchPexelsImageUrl(query: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  try {
    const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&per_page=15&orientation=square&size=medium`;
    const res = await fetch(url, { headers: { Authorization: key }, cache: 'no-store' });
    if (!res.ok) {
      console.error('[pexels] HTTP', res.status);
      return null;
    }
    const data = (await res.json()) as { photos?: PexelsPhoto[] };
    const photos = data.photos ?? [];
    if (!photos.length) return null;
    const pick = photos[Math.floor(Math.random() * photos.length)];
    return pick?.src?.large ?? pick?.src?.medium ?? pick?.src?.large2x ?? null;
  } catch (e) {
    console.error('[pexels] fetch failed', e);
    return null;
  }
}
