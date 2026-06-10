import { requireContentAccess } from '@/lib/admin/guard';
import { HybridStyle, type CardSlide } from './CardStyles';
import { ComplianceSlide } from './ComplianceSlide';
import type { ComplianceInfo } from '@/lib/content/types';

const SAMPLE_COMPLIANCE: ComplianceInfo = {
  company: '프라임에셋',
  branch: '강남지점',
  designer: '홍길동',
  registration: '12345678901234',
  number: '제2026-1234호',
  start_date: '2026.05.02',
  end_date: '2027.05.01',
  include_warning: true,
};

// 한 카드 = 한 메시지. 거대 통계가 메인 시각 포인트, 본문 1~2문장만.
const SAMPLE: CardSlide[] = [
  {
    kind: 'cover',
    eyebrow: '5세대 실손보험',
    title: '5세대 실손, 갈아타야 할까?',
    bigStat: '30% ↓',
    bigStatLabel: '월 보험료 인하 추정',
    iconKey: 'sparkles',
  },
  {
    kind: 'point',
    number: '01',
    bigStat: '약 30%',
    bigStatLabel: '월 보험료',
    title: '보험료가 약 30% 줄어요',
    body: '4세대 대비 평균 30% 인하. 월 부담 줄이고 싶다면 검토해볼 만해요.',
    iconKey: 'trendingDown',
  },
  {
    kind: 'point',
    number: '02',
    bigStat: '비급여 ↓',
    bigStatLabel: '도수·영양·약제',
    title: '비급여 보장은 줄어요',
    body: '도수치료·영양주사 자주 받으셨다면 4세대 그대로가 유리할 수 있어요.',
    iconKey: 'alert',
  },
  {
    kind: 'point',
    number: '03',
    bigStat: 'NEW',
    bigStatLabel: '임신·출산 신규 보장',
    title: '임신·출산이 새로 보장돼요',
    body: '5세대부터 새로 포함. 결혼·출산 계획 중이라면 5세대가 유리해요.',
    iconKey: 'baby',
  },
  {
    kind: 'closing',
    title: '결정 전 체크 3가지',
    items: [
      '내 실손이 몇 세대인지 확인',
      '최근 3년 병원 방문 빈도',
      '갈아타기 시뮬레이션',
    ],
    footer: '본 콘텐츠는 정보 제공 목적이며, 보장은 약관에 따릅니다.',
    iconKey: 'clipboard',
  },
];

export default async function CardPreviewPage() {
  await requireContentAccess();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">카드뉴스 시안 — 거대 텍스트, 꽉 찬 레이아웃</h1>
        <p className="mt-1 text-sm text-slate-500">
          한 카드 = 한 메시지. 거대 통계 + 짧은 헤딩 + 본문 1~2문장.
        </p>
      </div>

      {/* 0. 6번째 심의필 슬라이드 단독 미리보기 (가장 큼, 가독성 확인) */}
      <section className="mb-10">
        <div className="mb-3 flex items-baseline gap-3">
          <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 text-xs font-semibold">
            6번째 슬라이드 — 광고심의필 (1080×1080)
          </span>
          <span className="text-sm text-slate-500">실제 카드뉴스에 자동 추가되는 마지막 카드</span>
        </div>
        <div className="w-[640px] h-[640px] max-w-full">
          <ComplianceSlide compliance={SAMPLE_COMPLIANCE} index={5} total={6} />
        </div>
      </section>

      {/* 1. 5장 한눈에 — 큰 그리드 (2열) */}
      <section className="mb-10">
        <div className="mb-3 flex items-baseline gap-3">
          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 text-xs font-semibold">
            인스타 실제 크기 (520×520)
          </span>
          <span className="text-sm text-slate-500">핸드폰 인스타 피드와 비슷한 크기로 가독성 확인</span>
        </div>
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          {SAMPLE.map((s, i) => (
            <div key={i} className="aspect-square">
              <HybridStyle slide={s} index={i} total={SAMPLE.length} />
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 leading-7">
        <p className="font-semibold text-slate-800 mb-2">이번 변경</p>
        <ul className="space-y-1 list-disc pl-5">
          <li><strong>여백 축소</strong>: 카드 내부 패딩 7% → 5%, 항목 박스 패딩 5% → 3.5%</li>
          <li><strong>글자 대폭 키움</strong>: 헤딩 ~130px (이전 113), 본문 ~54px (이전 48), closing 항목 ~65px (이전 54)</li>
          <li><strong>한 카드 = 한 메시지</strong>: 통계 박스·한 줄 정리·부제 다 제거 → 거대 통계 + 헤딩 + 본문 1문장</li>
          <li><strong>제목 \n 강제 줄바꿈 제거</strong>: 자동으로 자연스럽게 흐르도록</li>
          <li><strong>박스 안 글자 폭 채움</strong>: 항목 글자 ~65px로 확대 + 박스 padding 줄여 좌우 여백 최소화</li>
        </ul>
      </div>
    </div>
  );
}
