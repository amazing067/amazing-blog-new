'use client'

import { useEffect, useState } from 'react'
import { FileText, ChevronDown, ChevronUp } from 'lucide-react'

type SessionSummary = {
  id: string; created_at: string; username: string; full_name: string
  questionTitle: string | null; totalScore: number | null; failureTags: string[]
  latencyMs: number | null; isDesignSheetMode: boolean; productName: string | null
}

type SessionDetail = {
  id: string; created_at: string
  user: { id: string; username: string; full_name: string }
  type: string; total_tokens: number; prompt_tokens: number; completion_tokens: number
  meta: Record<string, any>
}

const TAG_SHORT: Record<string, string> = {
  answer_role_leakage: '역할누수', thread_sales_ending: '영업종결', body_no_paragraph: '문단없음',
  answer_no_judgment: '판단없음', human_self_intro: '자기소개', keyword_missing: '키워드없음',
}

export default function SampleReviewPanel({ days }: { days: number }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/quality-sessions?days=${days}&limit=30`)
      .then(r => r.json())
      .then(json => { if (json.success) setSessions(json.sessions ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  const loadDetail = (id: string) => {
    if (selectedId === id) { setSelectedId(null); setDetail(null); return }
    setSelectedId(id)
    setDetailLoading(true)
    fetch(`/api/admin/quality-sessions?id=${id}`)
      .then(r => r.json())
      .then(json => { if (json.success) setDetail(json.session) })
      .catch(() => {})
      .finally(() => setDetailLoading(false))
  }

  if (loading) return <div className="text-center py-8 text-gray-400">세션 목록 로딩...</div>

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-500" />실물 샘플 리뷰</h2>

      {sessions.length === 0 ? (
        <p className="text-sm text-gray-500">기간 내 세션이 없습니다.</p>
      ) : (
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {sessions.map(s => (
            <div key={s.id}>
              <div
                className={`flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer text-sm hover:bg-gray-50 ${selectedId === s.id ? 'bg-blue-50' : ''}`}
                onClick={() => loadDetail(s.id)}
              >
                <span className="text-gray-400 w-24 shrink-0">{new Date(s.created_at).toLocaleDateString('ko-KR')}</span>
                <span className="w-16 shrink-0 font-medium">{s.username}</span>
                <span className="flex-1 truncate">{s.questionTitle || '-'}</span>
                <span className={`w-12 text-right font-bold ${(s.totalScore ?? 0) >= 90 ? 'text-green-600' : (s.totalScore ?? 0) >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                  {s.totalScore ?? '-'}
                </span>
                {s.failureTags.length > 0 && (
                  <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded text-xs">{s.failureTags.length}</span>
                )}
                {selectedId === s.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>

              {selectedId === s.id && (
                <div className="bg-gray-50 rounded-lg p-4 mt-1 mb-2 text-sm">
                  {detailLoading ? (
                    <div className="text-gray-400">상세 로딩 중...</div>
                  ) : detail ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div><span className="text-gray-500">상품명:</span> {detail.meta?.productName || '-'}</div>
                        <div><span className="text-gray-500">모드:</span> {detail.meta?.isDesignSheetMode ? '설계서' : '수동'}</div>
                        <div><span className="text-gray-500">토큰:</span> {detail.total_tokens?.toLocaleString()}</div>
                        <div><span className="text-gray-500">응답시간:</span> {detail.meta?.latencyMs ? `${(detail.meta.latencyMs / 1000).toFixed(1)}s` : '-'}</div>
                        <div><span className="text-gray-500">topicCore:</span> {detail.meta?.topicCore || '-'}</div>
                        <div><span className="text-gray-500">topicConcern:</span> {detail.meta?.topicConcern || '-'}</div>
                      </div>

                      {detail.meta?.qualityGate && (
                        <div>
                          <div className="font-bold text-gray-700 mb-1">품질 게이트 ({detail.meta.qualityGate.totalScore}점)</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(detail.meta.qualityGate.breakdown || {}).map(([k, v]) => (
                              <span key={k} className={`px-2 py-0.5 rounded text-xs ${(v as number) >= 90 ? 'bg-green-100 text-green-700' : (v as number) >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                {k}: {v as number}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {Array.isArray(detail.meta?.failureTags) && detail.meta.failureTags.length > 0 && (
                        <div>
                          <div className="font-bold text-gray-700 mb-1">실패 태그</div>
                          <div className="flex flex-wrap gap-1">
                            {detail.meta.failureTags.map((t: string) => (
                              <span key={t} className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs">{TAG_SHORT[t] || t}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {Array.isArray(detail.meta?.regenHistory) && detail.meta.regenHistory.length > 0 && (
                        <div>
                          <div className="font-bold text-gray-700 mb-1">재생성 이력</div>
                          {detail.meta.regenHistory.map((r: any, i: number) => (
                            <div key={i} className="text-xs text-gray-600">
                              {r.field}: {r.beforeScore}점 → {r.afterScore}점 ({r.improved ? '개선' : '미개선'})
                            </div>
                          ))}
                        </div>
                      )}

                      {detail.meta?.selectedFamilies && (
                        <div>
                          <div className="font-bold text-gray-700 mb-1">Family 선택</div>
                          <div className="text-xs text-gray-600">
                            Opening: {detail.meta.selectedFamilies.openingFamilyId || '-'} |
                            Title: {detail.meta.selectedFamilies.titlePatternId || '-'} |
                            Concern: {detail.meta.selectedFamilies.concernVariant || '-'}
                          </div>
                        </div>
                      )}

                      {detail.meta?.questionTitle && (
                        <div>
                          <div className="font-bold text-gray-700 mb-1">제목</div>
                          <div className="text-xs">{detail.meta.questionTitle}</div>
                        </div>
                      )}
                      {detail.meta?.questionContentSnippet && (
                        <div>
                          <div className="font-bold text-gray-700 mb-1">본문 스니펫</div>
                          <div className="text-xs text-gray-600 line-clamp-3">{detail.meta.questionContentSnippet}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-400">상세 정보를 불러올 수 없습니다.</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
