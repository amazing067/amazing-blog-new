import { requireAdmin } from '@/lib/admin/guard';
import { HybridStyle, type CardSlide } from './CardStyles';

// 텍스트 분량 — 인스타에서 핸드폰으로 보일 때 글자가 충분히 크게 보이도록 핵심 포인트만.
const SAMPLE: CardSlide[] = [
  {
    kind: 'cover',
    eyebrow: '5세대 실손보험',
    title: '5세대 실손,\n갈아타야 할까?',
    subtitle: '결정 전 꼭 봐야 할 3가지',
    stat: { value: '30% ↓', label: '월 보험료 인하 추정' },
    iconKey: 'sparkles',
  },
  {
    kind: 'point',
    number: '01',
    title: '보험료가\n약 30% ↓',
    subtitle: '4세대 대비 월 부담 감소',
    body: '5세대는 4세대보다 월 보험료가 평균 약 30% 낮아져요. 매달 부담을 줄이고 싶으면 검토해볼 만해요.',
    highlight: '월 부담 줄이고 싶으면 검토',
    stat: { value: '약 30%', label: '월 보험료' },
    iconKey: 'trendingDown',
  },
  {
    kind: 'point',
    number: '02',
    title: '비급여 보장은\n축소돼요',
    subtitle: '도수치료·영양주사 제한',
    body: '도수치료, 영양주사, 비급여 약제 보장이 줄어요. 자주 받으셨다면 4세대 유지가 유리해요.',
    highlight: '병원 자주 가면 4세대 유지',
    stat: { value: '비급여 ↓', label: '도수·영양·약제' },
    iconKey: 'alert',
  },
  {
    kind: 'point',
    number: '03',
    title: '임신·출산이\n새로 보장',
    subtitle: '5세대부터 신규 포함',
    body: '4세대까지 빠져있던 임신·출산 관련 보장이 들어왔어요. 가족 계획 중인 20·30대에 유리해요.',
    highlight: '결혼·출산 예정이면 5세대',
    stat: { value: 'NEW', label: '임신·출산 보장' },
    iconKey: 'baby',
  },
  {
    kind: 'closing',
    title: '결정 전 체크 3가지',
    subtitle: '약관에서 직접 확인하세요',
    items: [
      '내 실손이 몇 세대인지 확인',
      '최근 3년 병원 방문 빈도',
      '갈아타기 시뮬레이션 받기',
    ],
    footer: '본 콘텐츠는 정보 제공 목적이며, 보장 내용은 약관에 따릅니다.',
    iconKey: 'clipboard',
  },
];

export default async function CardPreviewPage() {
  await requireAdmin();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">카드뉴스 시안 — 하이브리드 (글자 크기 강화)</h1>
        <p className="mt-1 text-sm text-slate-500">
          1080×1080 인스타 정사각. 폰트는 카드 폭 비례(cqw)로 설정 — 핸드폰 인스타에서도 글자가 충분히 큼.
        </p>
      </div>

      {/* 1. 실제 1080×1080 — 인스타에 올라가는 그대로 */}
      <section className="mb-10">
        <div className="mb-3 flex items-baseline gap-3">
          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 text-xs font-semibold">
            실제 1080×1080 (1번 슬라이드)
          </span>
          <span className="text-sm text-slate-500">인스타에 업로드되는 실제 크기 — 폰트 가독성 확인용</span>
        </div>
        <div className="w-[540px] h-[540px] max-w-full">
          <HybridStyle slide={SAMPLE[0]} index={0} total={SAMPLE.length} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          ↑ 위 카드는 540×540으로 축소된 1080 시안. 핸드폰 인스타 피드(약 400~430px)와 비슷한 크기로 글자가 잘 보이는지 확인하세요.
        </p>
      </section>

      {/* 2. 5장 시리즈 한눈에 */}
      <section className="mb-10">
        <div className="mb-3 flex items-baseline gap-3">
          <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 px-3 py-1 text-xs font-semibold">
            5장 시리즈 (한눈에)
          </span>
          <span className="text-sm text-slate-500">시리즈 흐름·컬러 변화 확인용</span>
        </div>
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE.map((s, i) => (
            <div key={i} className="aspect-square">
              <HybridStyle slide={s} index={i} total={SAMPLE.length} />
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 leading-7">
        <p className="font-semibold text-slate-800 mb-2">변경된 점</p>
        <ul className="space-y-1 list-disc pl-5">
          <li>폰트 크기를 <strong>container query units(cqw)</strong>로 — 1080px 카드에서 본문 약 31px, 헤딩 60px, 통계 92px로 충분히 큼</li>
          <li>본문 분량을 50% 줄여 핵심만 — 4문장 → 2문장 구조</li>
          <li>1080×1080 단독 미리보기 추가 (위쪽) — 인스타 실제 크기 가독성 확인</li>
          <li>그리드 5열 → 3열로 — 미리보기에서도 카드 크기 충분히 큼</li>
        </ul>
      </div>
    </div>
  );
}
