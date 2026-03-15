'use client'

import { useEffect, useState } from 'react'
import { FileText, ChevronDown, ChevronUp } from 'lucide-react'

type SessionSummary = {
  id: string; created_at: string; username: string; full_name: string
  questionTitle: string | null; totalScore: number | null; failureTags: string[]
  latencyMs: number | null; isDesignSheetMode: boolean; productName: string | null
}

type DisplayKeywordSlot = { keyword: string; volume: number | null; role: string }
type SessionDetail = {
  id: string; created_at: string
  user: { id: string; username: string; full_name: string }
  type: string; total_tokens: number; prompt_tokens: number; completion_tokens: number
  meta: Record<string, any>
  questionTitle?: string | null
  questionContentSnippet?: string | null
  qualityGate?: { totalScore?: number; breakdown?: Record<string, number> } | null
  failureTags?: string[]
  regenHistory?: unknown[]
  promptKeywords?: string[] | null
  displayKeywords?: DisplayKeywordSlot[] | null
  marketHeadKeyword?: { keyword: string; volume: number | null; source?: string } | null
  selectedConcernVariant?: string | null
  openingFamilyId?: string | null
  titlePatternId?: string | null
  questionConceptId?: string | null
  thread?: Array<{ role: string; content: string }> | null
  finalAgentEnding?: string | null
  questionFirstSentence?: string | null
  answerFirstSentence?: string | null
}

function volumeBadge(vol: number | null | undefined, source?: string) {
  if (vol != null && vol > 0) return <span className="text-green-600 dark:text-green-400 text-xs">({(vol / 10000).toFixed(1)}만)</span>
  if (vol === 0) return <span className="text-red-600 dark:text-red-400 text-xs">(검색량 0 경고)</span>
  if (source === 'unavailable') return <span className="text-gray-500 dark:text-slate-400 text-xs">(미확인)</span>
  return <span className="text-gray-500 dark:text-slate-400 text-xs">(미확인)</span>
}

const TAG_SHORT: Record<string, string> = {
  title_too_short: '제목 짧음', title_too_long: '제목 김', title_blog_style: '블로그형 제목', title_internal_code: '내부 코드 노출',
  body_no_paragraph: '문단 없음', body_formal_tone: '격식체 본문', body_too_short: '본문 짧음', body_too_long: '본문 김', body_exclamation: '느낌표 남발',
  answer_role_leakage: '역할 누수', answer_no_judgment: '판단 없음', answer_doc_style: '설명체 답변', answer_too_short: '답변 짧음', answer_too_long: '답변 김',
  thread_sales_ending: '영업 종결', thread_role_break: '역할 흐름 깨짐', thread_too_short: '댓글 짧음', thread_too_long: '댓글 김', thread_empty: '댓글 대화 없음',
  human_self_intro: '자기소개', human_excessive_cta: '행동 유도 과다', human_first_sentence_repeat: '첫 문장 반복', human_formal_tone: '격식체', human_role_leakage: '역할 누수',
  evidence_outside_facts: '근거 이탈', evidence_forbidden_pattern: '금지 패턴',
  keyword_missing: '키워드 없음', keyword_overweight: '키워드 과밀', keyword_zero_volume: '검색량 0', keyword_no_title: '제목 키워드 없음',
  operational_regen_no_improvement: '재생성 미개선', operational_family_repeat: '패밀리 반복', operational_first_sentence_repeat: '첫 문장 유사', operational_no_analysis: '분석 없이 덮어쓰기',
  operational_final_agent_ending_missing: '최종 마무리 문장 미저장',
  uncategorized_warning: '미분류 경고',
}
const ROLE_LABELS: Record<string, string> = {
  market_head: '시장 대표', product_core: '상품 핵심', concern_search: '고민 검색', persona_longtail: '페르소나', intent_head: '의도',
}
const BREAKDOWN_LABELS: Record<string, string> = {
  title: '제목', questionBody: '질문 본문', answer: '답변', thread: '댓글 스레드',
  humanLikeness: '인간미', evidenceConsistency: '근거 일관성', keywordHealth: '키워드 건강', operationalRisk: '운영 리스크',
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

  if (loading) return <div className="text-center py-8 text-gray-500 dark:text-slate-400">세션 목록 로딩...</div>

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-500" />실물 샘플 리뷰</h2>
      <p className="text-sm text-gray-500 dark:text-slate-400 -mt-2">최근 생성된 Q&A 세션 목록입니다. 행을 클릭하면 해당 건의 품질 점수, 키워드, 실패 태그 등 상세 메타를 확인할 수 있습니다.</p>

      {sessions.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">기간 내 세션이 없습니다.</p>
      ) : (
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {sessions.map(s => (
            <div key={s.id}>
              <div
                className={`flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer text-sm hover:bg-gray-50 dark:hover:bg-slate-800 ${selectedId === s.id ? 'bg-blue-50 dark:bg-blue-500/20' : ''}`}
                onClick={() => loadDetail(s.id)}
              >
                <span className="text-gray-500 dark:text-slate-400 w-24 shrink-0">{new Date(s.created_at).toLocaleDateString('ko-KR')}</span>
                <span className="w-16 shrink-0 font-medium text-gray-900 dark:text-slate-100">{s.username}</span>
                <span className="flex-1 truncate text-gray-800 dark:text-slate-100">{s.questionTitle || '-'}</span>
                <span className={`w-12 text-right font-bold ${(s.totalScore ?? 0) >= 90 ? 'text-green-600 dark:text-green-400' : (s.totalScore ?? 0) >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                  {s.totalScore ?? '-'}
                </span>
                {s.failureTags.length > 0 && (
                  <span className="bg-red-500/20 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded text-xs font-medium">{s.failureTags.length}</span>
                )}
                {selectedId === s.id ? <ChevronUp className="w-4 h-4 text-gray-500 dark:text-slate-400" /> : <ChevronDown className="w-4 h-4 text-gray-500 dark:text-slate-400" />}
              </div>

              {selectedId === s.id && (
                <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 mt-1 mb-2 text-sm border border-gray-200 dark:border-slate-600">
                  {detailLoading ? (
                    <div className="text-gray-500 dark:text-slate-400">상세 로딩 중...</div>
                  ) : detail ? (
                    <div className="space-y-3 text-gray-800 dark:text-slate-200">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div><span className="text-gray-500 dark:text-slate-400">상품명:</span> <span className="text-gray-900 dark:text-slate-100">{detail.meta?.productName || '-'}</span></div>
                        <div><span className="text-gray-500 dark:text-slate-400">모드:</span> <span className="text-gray-900 dark:text-slate-100">{detail.meta?.isDesignSheetMode ? '설계서' : '수동'}</span></div>
                        <div><span className="text-gray-500 dark:text-slate-400">토큰:</span> <span className="text-gray-900 dark:text-slate-100">{detail.total_tokens?.toLocaleString()}</span></div>
                        <div><span className="text-gray-500 dark:text-slate-400">응답시간:</span> <span className="text-gray-900 dark:text-slate-100">{detail.meta?.latencyMs ? `${(detail.meta.latencyMs / 1000).toFixed(1)}s` : '-'}</span></div>
                        <div><span className="text-gray-500 dark:text-slate-400">주제 핵심:</span> <span className="text-gray-900 dark:text-slate-100">{detail.meta?.topicCore || '-'}</span></div>
                        <div><span className="text-gray-500 dark:text-slate-400">고민 키워드:</span> <span className="text-gray-900 dark:text-slate-100">{detail.meta?.topicConcern || '-'}</span></div>
                      </div>

                      {(detail.thread?.length === 0 || detail.finalAgentEnding == null) && (
                        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-800 text-xs">
                          운영 경고: {!detail.thread?.length && '댓글 대화 미저장. '}{detail.finalAgentEnding == null && '최종 마무리 문장 미저장.'}
                        </div>
                      )}

                      {(detail.questionTitle || detail.questionContentSnippet || detail.questionFirstSentence) && (
                        <div>
                          <div className="font-bold text-gray-700 mb-1">질문</div>
                          <div className="text-gray-600">{detail.questionTitle || '-'}</div>
                          {detail.questionFirstSentence != null && <div className="text-gray-600 text-xs mt-1">첫 문장: {detail.questionFirstSentence || '(없음)'}</div>}
                          {detail.questionContentSnippet && <div className="text-gray-500 text-xs mt-1 truncate max-w-full">{detail.questionContentSnippet}</div>}
                        </div>
                      )}

                      {(detail.answerFirstSentence != null || detail.finalAgentEnding != null) && (
                        <div>
                          <div className="font-bold text-gray-700 dark:text-slate-200 mb-1">답변/댓글 문장</div>
                          {detail.answerFirstSentence != null && <div className="text-xs text-gray-600 dark:text-slate-300">답변 첫 문장: {detail.answerFirstSentence || '(없음)'}</div>}
                          {detail.finalAgentEnding != null && <div className="text-xs text-gray-600 dark:text-slate-300 mt-1">마지막 설계사 마무리 문장: {detail.finalAgentEnding || '(없음)'}</div>}
                        </div>
                      )}

                      {detail.thread != null && (
                        <div>
                          <div className="font-bold text-gray-700 dark:text-slate-200 mb-1">댓글 대화</div>
                          <div className="text-xs text-gray-500 dark:text-slate-400">{Array.isArray(detail.thread) ? `${detail.thread.length}개 메시지` : '없음'}</div>
                        </div>
                      )}

                      {(detail.qualityGate || detail.meta?.qualityGate) && (
                        <div>
                          <div className="font-bold text-gray-700 dark:text-slate-200 mb-1">품질 게이트 ({(detail.qualityGate || detail.meta?.qualityGate)?.totalScore ?? '-'}점)</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries((detail.qualityGate || detail.meta?.qualityGate)?.breakdown || {}).map(([k, v]) => (
                              <span key={k} className={`px-2 py-0.5 rounded text-xs font-medium ${(v as number) >= 90 ? 'bg-green-500/20 text-green-700 dark:text-green-300' : (v as number) >= 75 ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-red-500/20 text-red-700 dark:text-red-300'}`}>
                                {BREAKDOWN_LABELS[k] ?? k}: {v as number}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {Array.isArray(detail.failureTags ?? detail.meta?.failureTags) && (detail.failureTags ?? detail.meta?.failureTags).length > 0 && (
                        <div>
                          <div className="font-bold text-gray-700 dark:text-slate-200 mb-1">실패 태그</div>
                          <div className="flex flex-wrap gap-1">
                            {(detail.failureTags ?? detail.meta?.failureTags).map((t: string) => (
                              <span key={t} className="bg-red-500/20 text-red-700 dark:text-red-300 px-2 py-0.5 rounded text-xs font-medium">{TAG_SHORT[t] || t}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {(detail.marketHeadKeyword != null || detail.displayKeywords?.length) ? (
                        <div>
                          <div className="font-bold text-gray-700 dark:text-slate-200 mb-1">대표 키워드 (시장 대표)</div>
                          <div className="mb-2 text-gray-900 dark:text-slate-100">
                            {detail.marketHeadKeyword?.keyword
                              ? <><span>{detail.marketHeadKeyword.keyword}</span> {volumeBadge(detail.marketHeadKeyword.volume, detail.marketHeadKeyword.source)}</>
                              : <span className="text-gray-500 dark:text-slate-400">없음</span>}
                          </div>
                          {Array.isArray(detail.displayKeywords) && detail.displayKeywords.length >= 5 && (
                            <>
                              <div className="font-bold text-gray-700 dark:text-slate-200 mb-1">표시용 키워드 5칸 (역할별)</div>
                              <div className="flex flex-wrap gap-2">
                                {detail.displayKeywords.map((d, i) => (
                                  <span key={i} className={`px-2 py-0.5 rounded text-xs font-medium ${d.volume != null && d.volume > 0 ? 'bg-green-500/20 text-green-800 dark:text-green-300' : d.volume === 0 ? 'bg-red-500/20 text-red-800 dark:text-red-300' : 'bg-slate-600 text-slate-200'}`}>
                                    {ROLE_LABELS[d.role] || d.role}: {d.keyword} {d.volume != null && d.volume > 0 ? `(${(d.volume / 10000).toFixed(1)}만)` : d.volume === 0 ? '(검색량 0)' : '(미확인)'}
                                  </span>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="font-bold text-gray-700 dark:text-slate-200 mb-1">대표 키워드 / 5칸</div>
                          <div className="text-gray-500 dark:text-slate-400 text-xs">시장 대표 키워드: {detail.marketHeadKeyword == null ? '없음' : '(없음)'} / 표시 키워드: {detail.displayKeywords == null ? '없음' : detail.displayKeywords?.length ?? 0}칸</div>
                        </div>
                      )}

                      {(detail.selectedConcernVariant || detail.openingFamilyId || detail.titlePatternId || detail.questionConceptId) && (
                        <div>
                          <div className="font-bold text-gray-700 dark:text-slate-200 mb-1">선택 패밀리·변형</div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {detail.selectedConcernVariant && <span className="bg-blue-500/20 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded">고민: {detail.selectedConcernVariant}</span>}
                            {detail.openingFamilyId && <span className="bg-purple-500/20 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded">오프닝: {detail.openingFamilyId}</span>}
                            {detail.titlePatternId && <span className="bg-green-500/20 text-green-800 dark:text-green-300 px-2 py-0.5 rounded">제목: {detail.titlePatternId}</span>}
                            {detail.questionConceptId && <span className="bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded">콘셉트: {detail.questionConceptId}</span>}
                          </div>
                        </div>
                      )}

                      {Array.isArray(detail.promptKeywords) && detail.promptKeywords.length > 0 && (
                        <div>
                          <div className="font-bold text-gray-700 dark:text-slate-200 mb-1">프롬프트 키워드 (내부)</div>
                          <div className="flex flex-wrap gap-1">
                            {detail.promptKeywords.map((k, i) => (
                              <span key={i} className="bg-slate-600 dark:bg-slate-600 text-slate-200 px-2 py-0.5 rounded text-xs">{k}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {Array.isArray(detail.meta?.regenHistory) && detail.meta.regenHistory.length > 0 && (
                        <div>
                          <div className="font-bold text-gray-700 dark:text-slate-200 mb-1">재생성 이력</div>
                          {detail.meta.regenHistory.map((r: any, i: number) => (
                            <div key={i} className="text-xs text-gray-600 dark:text-slate-300">
                              {BREAKDOWN_LABELS[r.field] ?? r.field}: {r.beforeScore}점 → {r.afterScore}점 ({r.improved ? '개선' : '미개선'})
                            </div>
                          ))}
                        </div>
                      )}

                      {detail.meta?.selectedFamilies && (
                        <div>
                          <div className="font-bold text-gray-700 dark:text-slate-200 mb-1">패밀리 선택</div>
                          <div className="text-xs text-gray-600 dark:text-slate-300">
                            오프닝: {detail.meta.selectedFamilies.openingFamilyId || '-'} |
                            제목: {detail.meta.selectedFamilies.titlePatternId || '-'} |
                            고민: {detail.meta.selectedFamilies.concernVariant || '-'}
                          </div>
                        </div>
                      )}

                      {detail.meta?.questionTitle && (
                        <div>
                          <div className="font-bold text-gray-700 dark:text-slate-200 mb-1">제목</div>
                          <div className="text-xs text-gray-800 dark:text-slate-200">{detail.meta.questionTitle}</div>
                        </div>
                      )}
                      {detail.meta?.questionContentSnippet && (
                        <div>
                          <div className="font-bold text-gray-700 dark:text-slate-200 mb-1">본문 스니펫</div>
                          <div className="text-xs text-gray-600 dark:text-slate-300 line-clamp-3">{detail.meta.questionContentSnippet}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-500 dark:text-slate-400">상세 정보를 불러올 수 없습니다.</div>
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
