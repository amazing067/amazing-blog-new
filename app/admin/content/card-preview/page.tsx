import { requireAdmin } from '@/lib/admin/guard';
import { HybridStyle, type CardSlide } from './CardStyles';

const SAMPLE: CardSlide[] = [
  {
    kind: 'cover',
    eyebrow: '5세대 실손보험',
    title: '5세대 실손,\n갈아타야 할까요?',
    subtitle: '보험료는 30% 싸지지만, 비급여 보장이 줄어듭니다. 갈아타기 전 꼭 알아야 할 3가지를 정리했어요.',
    stat: { value: '30% ↓', label: '월 평균 보험료 인하 추정' },
    iconKey: 'sparkles',
  },
  {
    kind: 'point',
    number: '01',
    title: '보험료가\n눈에 띄게 줄어요',
    subtitle: '4세대 대비 약 30% 인하 추정',
    body: '4세대 실손보험 대비 5세대의 월 보험료는 평균 30% 정도 낮아질 것으로 알려졌어요. 매달 내는 부담을 줄이고 싶다면 갈아타기를 검토할 만합니다. 다만 이 수치는 평균이고, 실제 인하폭은 가입 조건·연령·병력 이력에 따라 달라져요.',
    highlight: '40대 평균 월 보험료, 약 30% 인하 효과',
    stat: { value: '약 30%', label: '월 보험료 인하 추정' },
    iconKey: 'trendingDown',
  },
  {
    kind: 'point',
    number: '02',
    title: '비급여 보장은\n축소돼요',
    subtitle: '도수치료·영양주사 등 일부 항목 제한',
    body: '도수치료, 영양주사, 비급여 약제 같이 자주 받는 항목은 보장이 줄거나 빠질 수 있어요. 최근 3년 안에 도수치료를 자주 받으셨다면 4세대를 그대로 유지하는 게 더 유리할 수 있습니다. 약관에 비급여 항목이 어떻게 바뀌는지 꼭 확인하세요.',
    highlight: '병원 자주 가는 사람은 4세대 유지가 유리할 수 있음',
    stat: { value: '비급여 ↓', label: '도수·영양·비급여 약제' },
    iconKey: 'alert',
  },
  {
    kind: 'point',
    number: '03',
    title: '임신·출산이\n새로 보장돼요',
    subtitle: '5세대부터 신규 포함된 보장',
    body: '4세대까지는 빠져 있던 임신·출산 관련 보장이 5세대에서 새로 들어왔어요. 결혼·출산을 계획 중인 20·30대라면 5세대로 갈아타는 게 실제로 유리할 가능성이 높습니다. 가족 구성 변화 시점이라면 시뮬레이션을 받아보세요.',
    highlight: '20·30대 가족 계획 중이라면 5세대가 유리',
    stat: { value: 'NEW', label: '임신·출산 신규 보장' },
    iconKey: 'baby',
  },
  {
    kind: 'closing',
    title: '결정 전 체크 3가지',
    subtitle: '약관에서 직접 확인하면 갈아타기 손해 안 봐요.',
    items: [
      { title: '내 실손이 몇 세대인지 확인', desc: '약관 첫 페이지에 표기. 모르면 보험사 콜센터로.' },
      { title: '최근 3년 병원 방문 빈도', desc: '도수·영양·비급여 자주 받았다면 4세대 유지 검토.' },
      { title: '가족 계획 + 갈아타기 시뮬레이션', desc: '결혼·출산 예정이면 5세대 유리. 보험사 시뮬레이션 무료.' },
    ],
    footer: '본 콘텐츠는 정보 제공 목적이며, 실제 보장 내용은 약관에 따릅니다.',
    iconKey: 'clipboard',
  },
];

export default async function CardPreviewPage() {
  await requireAdmin();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">카드뉴스 디자인 시안 — 하이브리드</h1>
        <p className="mt-1 text-sm text-slate-500">
          토스 컬러 임팩트 + 카카오페이 정보 밀도 + 큰 아이콘 + 통계 박스 결합. 1080×1080 정사각, 5장 시리즈.
        </p>
      </div>

      <section className="mb-8">
        <div className="mb-4 flex items-baseline gap-3">
          <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 px-3 py-1 text-xs font-semibold">
            하이브리드 스타일
          </span>
          <span className="text-sm text-slate-500">
            컬러 배경 + 큰 아이콘(lucide) + 메인 헤딩 + 부제 + 본문 + 통계 박스 + 핵심 박스
          </span>
        </div>
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {SAMPLE.map((s, i) => (
            <div key={i} className="aspect-square">
              <HybridStyle slide={s} index={i} total={SAMPLE.length} />
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 leading-7">
        <p className="font-semibold text-slate-800 mb-2">콘텐츠 구성 요소 (각 카드별)</p>
        <ul className="space-y-1 list-disc pl-5">
          <li><strong>컬러 배경 (5종)</strong>: 시리즈 흐름에 따라 블루 → 검정 → 퍼플 → 시안 → 레드</li>
          <li><strong>큰 아이콘 일러스트 (lucide)</strong>: 표지/포인트/마무리마다 주제 맞는 아이콘 96~144px</li>
          <li><strong>메인 헤딩 + 부제</strong>: 헤드라인이 중심, 부제로 한 단계 더 풀어줌</li>
          <li><strong>본문 3~4문장</strong>: 정보 밀도 충분 (이전 시안 대비 글자수 약 2배)</li>
          <li><strong>통계 박스</strong>: 큰 숫자/퍼센트로 시선 끌기</li>
          <li><strong>한 줄 정리 박스</strong>: 노란/그린 배경으로 가장 중요한 결론</li>
          <li><strong>페이지 번호 + 워터마크</strong>: 우상단 작게, 본문 뒤에 큰 숫자 워터마크</li>
        </ul>
        <p className="mt-3">→ html2canvas로 1080×1080 PNG 캡처되어 인스타 업로드용 다운로드 가능. 다음 sprint에서 connector 구현.</p>
      </div>
    </div>
  );
}
