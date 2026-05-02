import { requireAdmin } from '@/lib/admin/guard';
import { KakaopayStyle, TossStyle, type CardSlide } from './CardStyles';

const SAMPLE: CardSlide[] = [
  {
    kind: 'cover',
    eyebrow: '5세대 실손보험',
    title: '5세대 실손,\n갈아타야 할까?',
    subtitle: '핵심만 3가지, 결정하기 전에 꼭 확인하세요',
    accent: '꼭 알아야 할 정보',
  },
  {
    kind: 'point',
    number: '01',
    title: '보험료가\n약 30% 낮아져요',
    body: '4세대보다 평균 보험료가 줄어들어요. 매달 내는 부담이 줄어드는 만큼, 장기 유지에 유리할 수 있어요.',
    highlight: '월 보험료 약 30% ↓',
  },
  {
    kind: 'point',
    number: '02',
    title: '비급여 보장은\n달라져요',
    body: '도수치료·영양주사 같은 비급여 항목은 일부 축소돼요. 자주 받으셨다면 4세대 유지가 나을 수 있어요.',
    highlight: '비급여 보장 변화 주의',
  },
  {
    kind: 'point',
    number: '03',
    title: '임신·출산은\n새로 보장돼요',
    body: '5세대부터 임신·출산 관련 보장이 새로 포함돼요. 가족 계획 중이라면 5세대가 유리할 수 있어요.',
    highlight: '신규 임신·출산 보장 ✨',
  },
  {
    kind: 'closing',
    title: '바로 확인할 3가지',
    items: [
      '내 실손이 몇 세대인지 약관에서 확인',
      '최근 3년 병원 방문 빈도 따져보기',
      '갈아타기 전 시뮬레이션 받기',
    ],
    footer: '광고심의필 제2026-XXXX호 (~2027-XX-XX)',
  },
];

export default async function CardPreviewPage() {
  await requireAdmin();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">카드뉴스 디자인 시안 비교</h1>
        <p className="mt-1 text-sm text-slate-500">
          같은 주제(5세대 실손)로 두 가지 톤. 1080×1080 인스타 정사각 비율, 5장 시리즈.
        </p>
      </div>

      {/* (a) 카카오페이 스타일 */}
      <section className="mb-12">
        <div className="mb-4 flex items-baseline gap-3">
          <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 text-xs font-semibold">
            (a) 카카오페이 스타일
          </span>
          <span className="text-sm text-slate-500">미니멀 · 흰 배경 · 컬러 포인트 · 정보 밀도 ↑</span>
        </div>
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {SAMPLE.map((s, i) => (
            <div key={i} className="aspect-square">
              <KakaopayStyle slide={s} index={i} total={SAMPLE.length} />
            </div>
          ))}
        </div>
      </section>

      {/* (b) 토스피드 스타일 */}
      <section className="mb-12">
        <div className="mb-4 flex items-baseline gap-3">
          <span className="inline-flex items-center rounded-full bg-violet-100 text-violet-800 border border-violet-200 px-3 py-1 text-xs font-semibold">
            (b) 토스피드 스타일
          </span>
          <span className="text-sm text-slate-500">대담한 타이포 · 컬러 배경 · 큰 강조 · 임팩트 ↑</span>
        </div>
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {SAMPLE.map((s, i) => (
            <div key={i} className="aspect-square">
              <TossStyle slide={s} index={i} total={SAMPLE.length} />
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 leading-7">
        <p><strong>비교 포인트</strong></p>
        <ul className="mt-2 space-y-1 list-disc pl-5">
          <li><strong>(a) 카카오페이</strong>: 흰 배경 + 컬러 포인트만. 본문 정보를 많이 담을 수 있고 신뢰감 있는 톤.</li>
          <li><strong>(b) 토스피드</strong>: 컬러 배경 + 큰 타이포. 인스타 피드에서 시선이 잘 잡히고 임팩트 있음.</li>
        </ul>
        <p className="mt-3">→ 둘 다 실제 발행 시에는 html2canvas로 1080×1080 PNG로 변환되어 인스타 업로드용으로 다운로드됩니다.</p>
      </div>
    </div>
  );
}
