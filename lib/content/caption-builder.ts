// 인스타그램 카드뉴스 캡션 빌더 — 광고심의 제출용 메모를 겸함.
// 슬라이드 본문, 출처, 광고심의필 정보, 해시태그를 한 .txt에 합쳐서
// "더보기" 본문에 그대로 붙여넣고 협회 심의 자료로도 사용 가능.

import type { CardSlide, ComplianceInfo, SlideSource } from './types';
import { resolveSourceUrl } from './source-registry';
import { requiredDisclaimers } from './disclaimers';

const HR = '━━━━━━━━━━━━━━━━';

// 캡션도 준법심의 대상 — 부정·공포 금지어("[함정]" 등)를 안전망으로 제거/순화.
function scrubForbidden(text: string): string {
  return text
    // 괄호로 감싼 금지어: "[함정]", "(낚시)" → 제거
    .replace(/[\[\(（［]\s*(함정|낚시|호구|호갱|눈탱이|바가지|사기|폭탄|깡통)\s*[\]\)）］]/g, '')
    // 단독 금지어 순화/제거
    .replace(/함정/g, '유의점')
    .replace(/낚시|호구|호갱|눈탱이|바가지|등쳐먹|뒤통수|독박|삥\s*뜯/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const BASE_TAGS = [
  '#보험', '#보험정보', '#보험상식', '#카드뉴스',
  '#보험설계사', '#재무설계', '#보험상담',
];

const CATEGORY_TAGS: Record<string, string[]> = {
  '실손': ['#실손보험', '#실비보험', '#5세대실손', '#의료비보장'],
  '자동차': ['#자동차보험', '#운전자보험', '#자차보험'],
  '암·진단': ['#암보험', '#진단비보험', '#건강보험', '#암진단'],
  '치매·간병': ['#치매보험', '#간병보험', '#간병인보험', '#실버케어'],
  '연금·노후': ['#연금보험', '#노후준비', '#개인연금'],
  '연금·저축': ['#연금보험', '#노후준비', '#개인연금'], // 구 카테고리 호환(저축·재테크 태그 제거 — 목적 오인)
  '청구·분쟁': ['#보험금청구', '#보험분쟁', '#금감원', '#보험상담'],
  '세제·환급': ['#세액공제', '#연말정산', '#환급', '#비과세'],
  '가입전략': ['#보험가입', '#보험비교', '#보험리모델링', '#보험점검'],
};

const KEYWORD_TAGS: Array<{ pattern: RegExp; tags: string[] }> = [
  { pattern: /실손|실비/, tags: ['#실손보험', '#실비보험'] },
  { pattern: /5세대/, tags: ['#5세대실손'] },
  { pattern: /암\b|암보험|진단비/, tags: ['#암보험', '#진단비'] },
  { pattern: /치매|간병/, tags: ['#치매보험', '#간병보험'] },
  { pattern: /연금|노후/, tags: ['#연금보험', '#노후준비'] },
  { pattern: /자동차/, tags: ['#자동차보험'] },
  { pattern: /운전/, tags: ['#운전자보험'] },
  { pattern: /청구|보상/, tags: ['#보험금청구'] },
  { pattern: /환급|세액|연말정산/, tags: ['#연말정산', '#세액공제'] },
  { pattern: /자녀|출산|어린이|태아/, tags: ['#어린이보험', '#태아보험'] },
  { pattern: /건강검진|검진/, tags: ['#건강검진'] },
  { pattern: /수술/, tags: ['#수술비보장'] },
];

export function buildHashtags({
  title,
  slides,
  category,
}: {
  title: string;
  slides: CardSlide[];
  category?: string | null;
}): string[] {
  const tags = new Set<string>(BASE_TAGS);
  if (category && CATEGORY_TAGS[category]) {
    for (const t of CATEGORY_TAGS[category]) tags.add(t);
  }

  const haystack = [
    title,
    ...slides.flatMap((s) => {
      if (s.kind === 'cover') return [s.eyebrow, s.title, s.bigStatLabel];
      if (s.kind === 'point') return [s.title, s.bigStatLabel, s.body];
      return [s.title, ...s.items];
    }),
  ].join(' ');

  for (const { pattern, tags: kw } of KEYWORD_TAGS) {
    if (pattern.test(haystack)) for (const t of kw) tags.add(t);
  }

  // 인스타 30개 제한
  return Array.from(tags).slice(0, 30);
}

export function buildCaption({
  title,
  slides,
  compliance,
  category,
}: {
  title: string;
  slides: CardSlide[];
  compliance: ComplianceInfo;
  category?: string | null;
}): string {
  const cover = slides[0]?.kind === 'cover' ? slides[0] : null;
  const points = slides.filter((s): s is Extract<CardSlide, { kind: 'point' }> => s.kind === 'point');
  const lastSlide = slides[slides.length - 1];
  const closing = lastSlide?.kind === 'closing' ? lastSlide : null;

  const lines: string[] = [];

  // ── 훅 (인스타 더보기 전 첫 125자에 임팩트) ──
  if (cover) {
    if (cover.eyebrow) lines.push(`[${cover.eyebrow}]`);
    lines.push(cover.title);
    if (cover.bigStat) {
      const label = cover.bigStatLabel ? ` · ${cover.bigStatLabel}` : '';
      lines.push(`${cover.bigStat}${label}`);
    }
  } else {
    lines.push(title);
  }
  lines.push('');

  // ── 본문 포인트 ──
  if (points.length > 0) {
    lines.push(HR);
    lines.push('');
    for (const p of points) {
      const num = p.number ? `${p.number}. ` : '';
      lines.push(`📌 ${num}${p.title}`);
      if (p.body) lines.push(p.body);
      if (p.bigStat) {
        const label = p.bigStatLabel ? ` ${p.bigStatLabel}` : '';
        lines.push(`└ ${p.bigStat}${label}`);
      }
      lines.push('');
    }
  }

  // ── 마무리 체크리스트 ──
  if (closing) {
    lines.push(HR);
    lines.push('');
    lines.push(`✅ ${closing.title}`);
    for (const item of closing.items.filter(Boolean)) {
      lines.push(`• ${item}`);
    }
    lines.push('');
    if (closing.footer) {
      lines.push(closing.footer);
      lines.push('');
    }
  }

  // ── 상품별 필수 유의문구 (협회 심의 — 누락 시 반송) ──
  const haystack = [
    title,
    ...slides.flatMap((s) =>
      s.kind === 'cover' ? [s.eyebrow, s.title, s.bigStatLabel]
      : s.kind === 'point' ? [s.title, s.body, s.bigStatLabel]
      : [s.title, ...s.items, s.footer],
    ),
  ].join(' ');
  const disclaimers = requiredDisclaimers(haystack);
  if (disclaimers.length > 0) {
    lines.push(HR);
    lines.push('');
    lines.push('⚠️ 유의사항');
    for (const d of disclaimers) lines.push(`• ${d}`);
    lines.push('');
  }

  // ── 출처 (검증된 URL만) ──
  const sources: SlideSource[] = [];
  for (const s of slides) {
    if ((s.kind === 'cover' || s.kind === 'point') && s.source) {
      sources.push(s.source);
    }
  }
  if (sources.length > 0) {
    lines.push(HR);
    lines.push('');
    lines.push('🔍 출처');
    const seen = new Set<string>();
    for (const src of sources) {
      const key = `${src.organization}|${src.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const url = resolveSourceUrl(src.organization, src.name);
      const tail = url ? ` (${url})` : '';
      lines.push(`• ${src.organization} — ${src.name}${tail}`);
    }
    lines.push('');
  }

  // ── 광고심의필 정보 (협회 심의 제출용) ──
  const hasComp = !!(
    compliance.number ||
    compliance.start_date ||
    compliance.end_date ||
    compliance.designer ||
    compliance.registration ||
    compliance.branch
  );
  if (hasComp) {
    lines.push(HR);
    lines.push('');
    lines.push('📋 광고심의필 정보');
    if (compliance.company) lines.push(`회사명: ${compliance.company}`);
    if (compliance.branch) lines.push(`지점: ${compliance.branch}`);
    if (compliance.designer) lines.push(`설계사: ${compliance.designer}`);
    if (compliance.registration) lines.push(`협회등록번호: ${compliance.registration}`);
    if (compliance.number) lines.push(`심의번호: ${compliance.number}`);
    if (compliance.start_date && compliance.end_date) {
      lines.push(`유효기간: ${compliance.start_date} ~ ${compliance.end_date}`);
    } else if (compliance.start_date) {
      lines.push(`심의일: ${compliance.start_date}`);
    }
    if (compliance.include_warning ?? true) {
      lines.push('');
      lines.push('※ 본 광고는 광고심의기준을 준수하였으며, 유효기간 내 게시 가능합니다.');
      lines.push('※ 본 콘텐츠는 정보 제공 목적이며, 실제 보장 내용은 약관에 따릅니다.');
    }
    lines.push('');
  }

  // ── 해시태그 (SEO/SNS 최적화) ──
  lines.push(HR);
  lines.push('');
  lines.push(buildHashtags({ title, slides, category }).join(' '));

  return scrubForbidden(lines.join('\n'));
}
