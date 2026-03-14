'use client'

import { useEffect, useState } from 'react'
import {
  BarChart3,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Shield,
  Target,
  ListChecks,
} from 'lucide-react'
import OperatingStatusBanner from './components/OperatingStatusBanner'
import KpiCards from './components/KpiCards'
import QualityBreakdownPanel from './components/QualityBreakdownPanel'
import FailureResponseCenter from './components/FailureResponseCenter'
import KeywordHealthControl from './components/KeywordHealthControl'
import UserRiskBoard from './components/UserRiskBoard'
import SampleReviewPanel from './components/SampleReviewPanel'
import WeeklyReportSummary from './components/WeeklyReportSummary'

type QualityLog = {
  id: string
  user_id: string
  username: string
  full_name: string
  created_at: string
  type: string
  total_tokens: number
  questionTitle?: string | null
  questionContentSnippet?: string | null
  promptVersion: string
  qualityWarnings: string[]
  costEstimate: number | null
}

type KpiSummary = {
  days: number
  since: string
  totalQa: number
  totalBlog: number
  totalTokens: number
  totalCostUsd: number
  totalCostKrw: number
  qualityWarningCount: number
  qualityWarningRate?: number
  avgCostPerQa?: number
  avgCostPerBlog?: number
  warningTypeCounts?: Record<string, number>
  sectionAverages?: Record<string, number>
  failureTopList?: Array<{ tag: string; count: number; pct: number }>
  regenRate?: number
  avgLatencyMs?: number
  designSheetModeRate?: number
}

type KeywordLog = {
  id: string
  user_id: string
  username: string
  full_name: string
  created_at: string
  productName: string
  searchKeywords: string[]
  searchKeywordsWithVolume?: Array<{ keyword: string; volume: number | null }>
}

const FAILURE_CASES = [
  { type: '질문이 광고 카피처럼 생성됨', desc: '판매 포인트가 과하게 들어가 일반인 질문처럼 안 보임', action: '질문 프롬프트에서 "일반인 고민" 비중 강화, sellingPoint 노출 최소화' },
  { type: '답변이 지나치게 공격적으로 판매함', desc: 'CTA·가입 유도가 과하여 카페 독자·운영 정책에 거부감 유발', action: '답변 톤·구조 선택지 조정, "넌지시 유도" 비중 확대' },
  { type: '댓글이 앞 대화와 연결되지 않음', desc: '고객/설계사 댓글이 이전 맥락을 무시하고 새 주제만 던짐', action: 'conversationHistory 활용 강화' },
  { type: '키워드 삽입 때문에 문맥이 깨짐', desc: '연관 키워드를 무리하게 넣어 문장이 어색해짐', action: '키워드 밀도·위치 제어 규칙 적용' },
  { type: '질문자와 댓글 페르소나 말투가 너무 비슷함', desc: '원글 작성자와 제3자 댓글이 말투·수준이 구분되지 않음', action: 'COMMENTER_PERSONAS별 말투·길이 가이드 차별화' },
  { type: '검색/키워드 실패 시 품질 저하', desc: 'Naver SearchAd 실패 후 Google 후보만 쓰이거나 검색 결과가 빈약함', action: '폴백 시 키워드 수 줄이기 또는 키워드 없이 생성 옵션 검토' },
  { type: 'persona 추출 실패', desc: 'targetPersona에서 나이/성별 파싱 실패 시 기본값만 사용', action: '로그로 추출 결과 확인, 특수 페르소나 케이스 문서화' },
]

export default function QualityKpiPanel() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<{
    qualityLogs: QualityLog[]
    kpiSummary: KpiSummary
    keywordLogs?: KeywordLog[]
    recentWarnings?: Array<{ id: string; created_at: string; username: string; full_name: string; failureTags: string[]; totalScore: number | null; questionTitle: string | null }>
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFailureCases, setShowFailureCases] = useState(false)
  const [showQualityGateCriteria, setShowQualityGateCriteria] = useState(false)
  const [showActionGoals, setShowActionGoals] = useState(false)
  const [showTargetKpi, setShowTargetKpi] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/admin/quality-kpi?days=${days}`)
      .then((res) => res.json().then((json) => ({ res, json })))
      .then(({ res, json }) => {
        if (cancelled) return
        if (!res.ok) throw new Error(json?.error || res.statusText)
        setData(json)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || '데이터를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [days])

  const formatDate = (s: string) => (s ? new Date(s).toLocaleString('ko-KR') : '-')

  return (
    <div className="space-y-8">
      {/* 기간 선택 */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-gray-600">기간:</span>
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDays(d)} className={`px-4 py-2 rounded-lg font-medium transition-colors ${days === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            최근 {d}일
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800">{error}</div>}
      {loading && <div className="text-center py-12 text-gray-500">불러오는 중...</div>}

      {!loading && data && (
        <>
          {/* 섹션 1: 운영 상태 배너 */}
          <OperatingStatusBanner kpiSummary={data.kpiSummary} />

          {/* 섹션 2: KPI 카드 */}
          <KpiCards kpiSummary={data.kpiSummary} />

          {/* 섹션 3: 품질 Breakdown */}
          <QualityBreakdownPanel sectionAverages={data.kpiSummary.sectionAverages || {}} />

          {/* 섹션 4: 실패 대응 센터 */}
          <FailureResponseCenter days={days} />

          {/* 섹션 5: 키워드 건강 관리 */}
          <KeywordHealthControl days={days} />

          {/* 섹션 6: 사용자 리스크 보드 */}
          <UserRiskBoard days={days} />

          {/* 섹션 7: 실물 샘플 리뷰 */}
          <SampleReviewPanel days={days} />

          {/* 섹션 8: 주간 리포트 */}
          <WeeklyReportSummary />

          {/* ── 경고 유형별 건수 ── */}
          {data.kpiSummary.warningTypeCounts && Object.keys(data.kpiSummary.warningTypeCounts).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                경고 유형별 건수
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-gray-500"><th className="py-2">경고 유형</th><th className="py-2 text-right">건수</th></tr></thead>
                  <tbody>
                    {Object.entries(data.kpiSummary.warningTypeCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => (
                        <tr key={type} className="border-b last:border-0">
                          <td className="py-1.5 text-gray-700">{type}</td>
                          <td className="py-1.5 text-right font-medium text-amber-700">{count}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 최근 품질 경고 테이블 ── */}
          {data.qualityLogs.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                최근 품질 경고 ({data.qualityLogs.length}건)
              </h2>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white"><tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-4">일시</th><th className="py-2 pr-4">사용자</th><th className="py-2 pr-4">질문 제목</th><th className="py-2 pr-4">경고</th><th className="py-2">토큰</th>
                  </tr></thead>
                  <tbody>
                    {data.qualityLogs.slice(0, 50).map((log) => (
                      <tr key={log.id} className="border-b last:border-0">
                        <td className="py-1.5 pr-4 text-gray-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
                        <td className="py-1.5 pr-4">{log.full_name} <span className="text-gray-400">@{log.username}</span></td>
                        <td className="py-1.5 pr-4 max-w-[200px] truncate">{log.questionTitle || '-'}</td>
                        <td className="py-1.5 pr-4">
                          <ul className="space-y-0.5">
                            {log.qualityWarnings.map((w, i) => <li key={i} className="text-amber-700 text-xs">{w}</li>)}
                          </ul>
                        </td>
                        <td className="py-1.5 text-gray-500">{log.total_tokens.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 접이식 참고 섹션 ── */}
          <div className="space-y-3">
            <button onClick={() => setShowQualityGateCriteria(!showQualityGateCriteria)} className="w-full flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4 hover:bg-gray-50">
              <span className="flex items-center gap-2 font-bold text-gray-700"><Shield className="w-5 h-5" />품질 게이트 검수 기준</span>
              {showQualityGateCriteria ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            {showQualityGateCriteria && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 overflow-x-auto">
                <table className="w-full text-sm"><thead><tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">항목</th><th className="py-2 pr-4">질문(Step1)</th><th className="py-2 pr-4">답변(Step2)</th><th className="py-2 pr-4">대화 댓글(Step3)</th>
                </tr></thead><tbody>
                  {[
                    ['자연스러움', '카페 질문처럼 자연스러운가', '판단 기준 제시 + 공감', '대화 흐름이 이어지는가'],
                    ['광고성', '판매 포인트 과다 여부', 'CTA/가입 유도 정도', '마지막 agent 영업성'],
                    ['정합성', '설계서 사실 일치', 'evidenceMap 일관성', 'concern 반영 여부'],
                    ['반복성', '제목/첫 문장 반복', '답변 구조 반복', '댓글 패턴 반복'],
                    ['키워드', '제목 키워드 포함', '답변 내 키워드 자연삽입', '-'],
                    ['인간미', '첫 문장 생활형 여부', '역할 누수 없음', '설계사 말투 자연스러움'],
                  ].map(([item, q, a, c]) => (
                    <tr key={item} className="border-b last:border-0">
                      <td className="py-1.5 pr-4 font-medium">{item}</td><td className="py-1.5 pr-4">{q}</td><td className="py-1.5 pr-4">{a}</td><td className="py-1.5">{c}</td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            )}

            <button onClick={() => setShowFailureCases(!showFailureCases)} className="w-full flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4 hover:bg-gray-50">
              <span className="flex items-center gap-2 font-bold text-gray-700"><BookOpen className="w-5 h-5" />실패 케이스 사전</span>
              {showFailureCases ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            {showFailureCases && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 overflow-x-auto">
                <table className="w-full text-sm"><thead><tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">유형</th><th className="py-2 pr-4">설명</th><th className="py-2">조치</th>
                </tr></thead><tbody>
                  {FAILURE_CASES.map((fc) => (
                    <tr key={fc.type} className="border-b last:border-0">
                      <td className="py-1.5 pr-4 font-medium">{fc.type}</td><td className="py-1.5 pr-4 text-gray-600">{fc.desc}</td><td className="py-1.5 text-gray-600">{fc.action}</td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            )}

            <button onClick={() => setShowActionGoals(!showActionGoals)} className="w-full flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4 hover:bg-gray-50">
              <span className="flex items-center gap-2 font-bold text-gray-700"><Target className="w-5 h-5" />단계별 행동 목표</span>
              {showActionGoals ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            {showActionGoals && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 overflow-x-auto">
                <table className="w-full text-sm"><thead><tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">단계</th><th className="py-2 pr-4">1차 목표</th><th className="py-2 pr-4">2차 목표</th><th className="py-2">피할 것</th>
                </tr></thead><tbody>
                  {[
                    ['질문', '자연스러운 카페 질문', '키워드 자연삽입', '광고성 질문'],
                    ['첫 답변', '판단 기준 제시', '공감+체크포인트', '상담 스크립트'],
                    ['고객 댓글', '추가 질문 자연스럽게', 'concern 반영', '뜬금없는 정보'],
                    ['설계사 댓글', '판단 정리형 마무리', '영업 없이 닫기', '비교설계 유도'],
                  ].map(([step, g1, g2, avoid]) => (
                    <tr key={step} className="border-b last:border-0">
                      <td className="py-1.5 pr-4 font-medium">{step}</td><td className="py-1.5 pr-4">{g1}</td><td className="py-1.5 pr-4">{g2}</td><td className="py-1.5 text-red-600">{avoid}</td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            )}

            <button onClick={() => setShowTargetKpi(!showTargetKpi)} className="w-full flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4 hover:bg-gray-50">
              <span className="flex items-center gap-2 font-bold text-gray-700"><ListChecks className="w-5 h-5" />목표 KPI / 성과 측정</span>
              {showTargetKpi ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            {showTargetKpi && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 overflow-x-auto">
                <table className="w-full text-sm"><thead><tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">구분</th><th className="py-2 pr-4">지표 예시</th><th className="py-2">비고</th>
                </tr></thead><tbody>
                  {[
                    ['노출·참여', '카페 노출수, 조회수, 댓글 반응', '외부 지표 연동 시'],
                    ['전환', '상담 신청율, 링크 클릭율', '추적 코드 필요'],
                    ['운영 리스크', '경고율 <5%, 재생성율 <10%', '품질 게이트 기반'],
                    ['실험', 'A/B 테스트 승률', '프롬프트 변경 시'],
                  ].map(([cat, metric, note]) => (
                    <tr key={cat} className="border-b last:border-0">
                      <td className="py-1.5 pr-4 font-medium">{cat}</td><td className="py-1.5 pr-4">{metric}</td><td className="py-1.5 text-gray-500">{note}</td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
