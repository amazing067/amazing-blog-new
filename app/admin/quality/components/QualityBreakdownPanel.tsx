'use client'

const GATE_LABELS: Record<string, string> = {
  title: '제목',
  questionBody: '질문 본문',
  answer: '답변',
  thread: '댓글 스레드',
  humanLikeness: '인간미',
  evidenceConsistency: 'Evidence 일관성',
  keywordHealth: '키워드 건강',
  operationalRisk: '운영 리스크',
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 90 ? 'bg-green-500' : score >= 75 ? 'bg-amber-400' : score >= 60 ? 'bg-orange-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-sm text-gray-700 text-right">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
        <div className={`${color} h-5 rounded-full transition-all`} style={{ width: `${Math.min(100, score)}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800">{score}점</span>
      </div>
    </div>
  )
}

export default function QualityBreakdownPanel({ sectionAverages }: { sectionAverages: Record<string, number> }) {
  const orderedKeys = ['title', 'questionBody', 'answer', 'thread', 'humanLikeness', 'evidenceConsistency', 'keywordHealth', 'operationalRisk']
  const entries = orderedKeys
    .filter(k => sectionAverages[k] !== undefined)
    .map(k => ({ key: k, label: GATE_LABELS[k] || k, score: Math.round(sectionAverages[k]) }))

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">품질 Breakdown</h2>
        <p className="text-sm text-gray-500">아직 품질 게이트 데이터가 없습니다. 새 생성 이후 집계됩니다.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-800 mb-4">품질 Breakdown (8개 게이트 평균)</h2>
      <div className="space-y-3">
        {entries.map(e => <ScoreBar key={e.key} label={e.label} score={e.score} />)}
      </div>
    </div>
  )
}
