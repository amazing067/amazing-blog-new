// 리쿠르팅 커버용 플랫 일러스트 — public/recruit-illust/ 에 로컬 번들(Popsy, 무료·출처표기 없음).
// 실사 스톡 사진(국적·어색함 문제) 대신 사용. 로컬 SVG라 외부 API·CORS 없이 PNG 캡처 안정.
import type { RecruitPillar } from './types';

const BY_PILLAR: Record<RecruitPillar, string[]> = {
  'P1-empathy': ['taking-notes', 'work-from-home'],   // 현타·일상
  'P2-system': ['presentation', 'video-call'],        // 교육·시스템
  'P3-income': ['man-riding-a-rocket', 'success'],    // 성장·소득
  'P4-lifestyle': ['remote-work', 'work-from-home'],  // 자유·디지털
  'P5-story': ['freelancer', 'designer'],             // 후기·사람
};

/** 기둥에 맞는 커버 일러스트 로컬 경로 반환. */
export function recruitIllustration(pillar: RecruitPillar): string {
  const opts = BY_PILLAR[pillar] ?? ['work-from-home'];
  const name = opts[Math.floor(Math.random() * opts.length)];
  return `/recruit-illust/${name}.svg`;
}
