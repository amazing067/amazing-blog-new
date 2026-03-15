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
  title: '제목이 질문처럼 자연스럽고 클릭할 만한지',
  questionBody: '사람이 쓴 카페 글처럼 자연스럽고 문단이 나뉘는지',
  answer: '광고 냄새 없이 판단을 도와주는 답글인지',
  thread: '대화가 이어지는 느낌이 있는지',
  humanLikeness: '기계적이지 않고 사람처럼 말하는지',
  evidenceConsistency: '설계서 밖 사실을 함부로 단정하지 않았는지',
  keywordHealth: '검색 키워드가 실제로 살아 있는지',
  operationalRisk: '누락, 반복, 재생성 실패 같은 운영 문제가 없는지',
}

const GATE_LOW_MEANING: Record<string, string> = {
  title: '낮으면 광고형/블로그형 제목이 많다는 뜻',
  questionBody: '낮으면 문단 없음, 설명서 말투, 느낌표 남발 가능성',
  answer: '낮으면 상담 스크립트·광고체 답변이 많다는 뜻',
  thread: '낮으면 댓글 흐름이 끊기거나 영업성 마무리 가능성',
  humanLikeness: '낮으면 기계적이거나 역할 누수 가능성',
  evidenceConsistency: '낮으면 설계서 밖 사실을 만들어냈을 가능성',
  keywordHealth: '낮으면 검색량 0·미반영 키워드가 많다는 뜻',
  operationalRisk: '낮으면 댓글 대화/마무리 문장 누락, 재생성 실패 등',
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
      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
      : status === '주의'
        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
        : 'bg-red-500/20 text-red-400 border border-red-500/40'

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
        <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 mb-4">품질 Breakdown (전체 사용자 기준)</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">아직 품질 게이트 데이터가 없습니다. 새 생성 이후 집계됩니다.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
      <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 mb-2">품질 Breakdown (전체 사용자 8개 게이트 평균)</h2>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
        클릭을 부르는 자연스러운 질문 제목 · 실제 사람이 쓴 글처럼 문단 · 판단을 도와주는 답변 · 이어지는 댓글 대화 · 인간미 · 근거 일관성 · 키워드 건강 · 운영 리스크를 봅니다.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {entries.map((e) => (
          <GateCard key={e.key} label={e.label} score={e.score} description={e.description} lowMeaning={e.lowMeaning} />
        ))}
      </div>
    </div>
  )
}
