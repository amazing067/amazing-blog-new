'use client'

const GATE_LABELS: Record<string, string> = {
  title: '제목',
  questionBody: '질문 본문',
  answer: '답변',
  thread: '댓글 스레드',
  humanLikeness: '인간미',
  evidenceConsistency: '근거 일관성',
  keywordHealth: '키워드 건강',
  operationalRisk: '운영 리스크',
}

const GATE_DESCRIPTIONS: Record<string, string> = {
  title: '모든 글 제목이 카페 질문처럼 자연스럽게 보이는지',
  questionBody: '전체 질문 본문이 설명서 말투가 아닌지',
  answer: '답변들이 광고문이 아니라 판단을 돕는지',
  thread: '대부분의 댓글 대화가 자연스럽게 이어지는지',
  humanLikeness: '전체 톤이 사람 말투에 가깝게 유지되는지',
  evidenceConsistency: '설계서에 없는 내용을 막 지어내지 않는지',
  keywordHealth: '검색 키워드가 실제 검색에 도움이 되는지',
  operationalRisk: '운영 흐름이 끊기지 않고 잘 기록되는지',
}

const GATE_LOW_MEANING: Record<string, string> = {
  title: '낮으면 광고 느낌 나는 제목이 자주 나온다는 뜻이에요.',
  questionBody: '낮으면 설명서 같은 글이나 문단이 없는 글이 많다는 뜻이에요.',
  answer: '낮으면 상담 대본처럼 느껴지는 답변이 많다는 뜻이에요.',
  thread: '낮으면 댓글 대화가 중간에 끊기거나 영업 멘트로 끝나는 경우가 많다는 뜻이에요.',
  humanLikeness: '낮으면 말투가 딱딱하거나, 사람이 아닌 느낌이 난다는 뜻이에요.',
  evidenceConsistency: '낮으면 약관·설계서에 없는 말을 지어냈을 위험이 있다는 뜻이에요.',
  keywordHealth: '낮으면 검색량 0이거나, 쓸모없는 키워드가 많이 쓰인다는 뜻이에요.',
  operationalRisk: '낮으면 댓글·마무리 문장 누락이나 재생성 실패가 자주 생긴다는 뜻이에요.',
}

function statusFromScore(score: number): '정상' | '주의' | '위험' {
  if (score >= 95) return '정상'
  if (score >= 85) return '주의'
  return '위험'
}

function GateCard({
  label,
  score,
  description,
  lowMeaning,
}: {
  label: string
  score: number
  description: string
  lowMeaning: string
}) {
  const status = statusFromScore(score)
  const badgeClass =
    status === '정상'
      ? 'bg-emerald-100 text-emerald-800 border border-emerald-400 dark:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-600'
      : status === '주의'
        ? 'bg-amber-100 text-amber-800 border border-amber-400 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-600'
        : 'bg-red-100 text-red-800 border border-red-400 dark:bg-red-900/60 dark:text-red-200 dark:border-red-600'

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-gray-800 dark:text-slate-100">{label}</span>
        <span className="text-xl font-bold text-gray-900 dark:text-slate-50">{score}점</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}>현재 상태: {status}</span>
      </div>
      <p className="text-sm text-gray-600 dark:text-slate-300 mb-1">{description}</p>
      <p className="text-xs text-gray-500 dark:text-slate-400">{lowMeaning}</p>
    </div>
  )
}

export default function QualityBreakdownPanel({ sectionAverages }: { sectionAverages: Record<string, number> }) {
  const orderedKeys = ['title', 'questionBody', 'answer', 'thread', 'humanLikeness', 'evidenceConsistency', 'keywordHealth', 'operationalRisk']
  const entries = orderedKeys
    .filter((k) => sectionAverages[k] !== undefined)
    .map((k) => ({
      key: k,
      label: GATE_LABELS[k] || k,
      score: Math.round(sectionAverages[k]),
      description: GATE_DESCRIPTIONS[k] || '-',
      lowMeaning: GATE_LOW_MEANING[k] || '낮으면 해당 항목 품질 개선이 필요합니다.',
    }))

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
        <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 mb-4">품질 Breakdown (전체 운영 기준)</h2>
        <p className="text-sm text-gray-500 dark:text-slate-300">아직 품질 게이트 데이터가 없습니다. 새 생성 이후 자동으로 모입니다.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
      <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 mb-2">품질 Breakdown (전체 운영 8개 게이트 평균)</h2>
      <p className="text-sm text-gray-500 dark:text-slate-300 mb-4">
        최근 {entries.length > 0 ? '모든 사용자 생성물' : '전체 생성물'}을 기준으로, 제목·질문·답변·댓글·인간미·근거·키워드·운영 리스크까지 한눈에 봅니다.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {entries.map((e) => (
          <GateCard key={e.key} label={e.label} score={e.score} description={e.description} lowMeaning={e.lowMeaning} />
        ))}
      </div>
    </div>
  )
}
