'use client'

import { useEffect, useState } from 'react'
import {
  BarChart3,
  AlertTriangle,
  FileText,
  MessageSquare,
  Zap,
  DollarSign,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Search,
  FileBarChart,
  CheckCircle2,
  XCircle,
  Shield,
  Target,
  ListChecks,
} from 'lucide-react'

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

type WeeklyReport = {
  user_id: string
  username: string
  full_name: string
  department_id: string | null
  department_name: string | null
  lastActivity: string | null
  stats: {
    qaCount: number
    blogCount: number
    totalTokens: number
    qualityWarningCount: number
    qaWithKeywordVolumeCount: number
    qaKeywordVolumeSum: number
    qualityWarningExamples: string[]
  }
  good: string[]
  bad: string[]
}

const FAILURE_CASES = [
  { type: '질문이 광고 카피처럼 생성됨', desc: '판매 포인트가 과하게 들어가 일반인 질문처럼 안 보임', action: '질문 프롬프트에서 "일반인 고민" 비중 강화, sellingPoint 노출 최소화' },
  { type: '답변이 지나치게 공격적으로 판매함', desc: 'CTA·가입 유도가 과하여 카페 독자·운영 정책에 거부감 유발', action: '답변 톤·구조 선택지 조정, "넌지시 유도" 비중 확대' },
  { type: '댓글이 앞 대화와 연결되지 않음', desc: '고객/설계사 댓글이 이전 맥락을 무시하고 새 주제만 던짐', action: 'conversationHistory 활용 강화, "이전에 다룬 주제 피하기" 지시 강화' },
  { type: '후기 문구가 갑자기 튀어나와 조작처럼 보임', desc: '설계사 유도 직후 바로 극찬 후기가 나오거나 톤이 과함', action: '후기 삽입 위치·조건·톤 규칙 적용 (11절 참고)' },
  { type: '키워드 삽입 때문에 문맥이 깨짐', desc: '연관 키워드를 무리하게 넣어 문장이 어색해짐', action: '키워드 밀도·위치 제어 규칙 적용 (12절 참고)' },
  { type: '질문자와 댓글 페르소나 말투가 너무 비슷함', desc: '원글 작성자와 제3자 댓글이 말투·수준이 구분되지 않음', action: 'COMMENTER_PERSONAS별 말투·길이 가이드 차별화' },
  { type: '검색/키워드 실패 시 품질 저하', desc: 'Naver SearchAd 실패 후 Google 후보만 쓰이거나 검색 결과가 빈약함', action: '폴백 시 "연관 키워드 수 줄이기" 또는 "키워드 없이 생성" 옵션 검토' },
  { type: 'persona 추출 실패', desc: 'targetPersona에서 나이/성별 파싱 실패 시 기본값(30세 남)만 사용', action: '로그로 추출 결과 확인, 특수 페르소나 케이스 문서화' },
]

export default function QualityKpiPanel() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<{
    qualityLogs: QualityLog[]
    kpiSummary: KpiSummary
    keywordLogs?: KeywordLog[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFailureCases, setShowFailureCases] = useState(false)
  const [showQualityGateCriteria, setShowQualityGateCriteria] = useState(false)
  const [showActionGoals, setShowActionGoals] = useState(false)
  const [showTargetKpi, setShowTargetKpi] = useState(false)
  const [weeklyReports, setWeeklyReports] = useState<{ days: number; reports: WeeklyReport[] } | null>(null)
  const [weeklyLoading, setWeeklyLoading] = useState(false)
  const [reportDays, setReportDays] = useState(7)
  const [showWeeklyReports, setShowWeeklyReports] = useState(true)
  const [reportSearchQuery, setReportSearchQuery] = useState('')
  const [reportDepartment, setReportDepartment] = useState<string>('all') // 'all' | department_id

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

  useEffect(() => {
    let cancelled = false
    setWeeklyLoading(true)
    fetch(`/api/admin/weekly-reports?days=${reportDays}`)
      .then((res) => res.json().then((json) => ({ res, json })))
      .then(({ res, json }) => {
        if (cancelled) return
        if (!res.ok) throw new Error(json?.error || res.statusText)
        setWeeklyReports({ days: json.days, reports: json.reports ?? [] })
      })
      .catch(() => {
        if (!cancelled) setWeeklyReports(null)
      })
      .finally(() => {
        if (!cancelled) setWeeklyLoading(false)
      })
    return () => { cancelled = true }
  }, [reportDays])

  const formatDate = (s: string) => (s ? new Date(s).toLocaleString('ko-KR') : '-')
  const formatNum = (n: number) => n.toLocaleString()

  return (
    <div className="space-y-8">
      {/* 기간 선택 */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-gray-600">기간:</span>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              days === d
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            최근 {d}일
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-gray-500">불러오는 중...</div>
      )}

      {!loading && data && (
        <>
          {/* KPI 요약 카드 */}
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              KPI 요약
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <MessageSquare className="w-4 h-4" />
                  Q&A 생성
                </div>
                <div className="text-2xl font-bold text-gray-900">{formatNum(data.kpiSummary.totalQa)}</div>
                <div className="text-xs text-gray-400">건</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <FileText className="w-4 h-4" />
                  블로그 생성
                </div>
                <div className="text-2xl font-bold text-gray-900">{formatNum(data.kpiSummary.totalBlog)}</div>
                <div className="text-xs text-gray-400">건</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <Zap className="w-4 h-4" />
                  토큰 합계
                </div>
                <div className="text-2xl font-bold text-gray-900">{formatNum(data.kpiSummary.totalTokens)}</div>
                <div className="text-xs text-gray-400">tokens</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <DollarSign className="w-4 h-4" />
                  비용(원)
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatNum(data.kpiSummary.totalCostKrw)}
                </div>
                <div className="text-xs text-gray-400">KRW</div>
              </div>
              <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-amber-700 text-sm mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  품질 경고
                </div>
                <div className="text-2xl font-bold text-amber-800">{formatNum(data.kpiSummary.qualityWarningCount)}</div>
                <div className="text-xs text-gray-400">건</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="text-gray-500 text-sm mb-1">기간</div>
                <div className="text-lg font-semibold text-gray-900">최근 {data.kpiSummary.days}일</div>
                <div className="text-xs text-gray-400">기준</div>
              </div>
            </div>
            {/* 경고율 · 건당 비용 */}
            {(data.kpiSummary.qualityWarningRate != null || data.kpiSummary.avgCostPerQa != null) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                {data.kpiSummary.qualityWarningRate != null && (
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-amber-700 text-sm mb-1">경고율</div>
                    <div className="text-xl font-bold text-amber-800">{data.kpiSummary.qualityWarningRate}%</div>
                    <div className="text-xs text-gray-500">전체 생성 건 대비 품질 경고 발생 비율</div>
                  </div>
                )}
                {data.kpiSummary.avgCostPerQa != null && data.kpiSummary.avgCostPerQa > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="text-gray-500 text-sm mb-1">Q&A 건당 비용</div>
                    <div className="text-xl font-bold text-gray-900">{formatNum(data.kpiSummary.avgCostPerQa)}원</div>
                    <div className="text-xs text-gray-400">평균</div>
                  </div>
                )}
                {data.kpiSummary.avgCostPerBlog != null && data.kpiSummary.avgCostPerBlog > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="text-gray-500 text-sm mb-1">블로그 건당 비용</div>
                    <div className="text-xl font-bold text-gray-900">{formatNum(data.kpiSummary.avgCostPerBlog)}원</div>
                    <div className="text-xs text-gray-400">평균</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 경고 유형별 건수 */}
          {data.kpiSummary.warningTypeCounts && Object.keys(data.kpiSummary.warningTypeCounts).length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                경고 유형별 건수
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-4 font-semibold text-gray-700">경고 유형</th>
                        <th className="text-right py-2 px-4 font-semibold text-gray-700">건수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.kpiSummary.warningTypeCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([label, count]) => (
                          <tr key={label} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-4 text-amber-800">{label}</td>
                            <td className="py-2 px-4 text-right font-medium text-gray-800">{formatNum(count)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 최근 품질 경고 테이블 */}
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              최근 품질 경고 (8절 품질 게이트)
            </h2>
            {data.qualityLogs.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                이 기간에 품질 경고가 발생한 건이 없습니다.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">일시</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">사용자</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">질문 제목</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">질문 본문</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">경고 내용</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">토큰</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.qualityLogs.map((row) => (
                        <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-4 text-gray-600 whitespace-nowrap">{formatDate(row.created_at)}</td>
                          <td className="py-2 px-4">
                            <span className="font-medium text-gray-800">{row.username}</span>
                            {row.full_name && row.full_name !== '-' && (
                              <span className="text-gray-500 ml-1">({row.full_name})</span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-gray-800 max-w-[220px]" title={row.questionTitle || ''}>
                            {row.questionTitle ? (
                              <span className="line-clamp-2">{row.questionTitle}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-gray-700 max-w-[280px]" title={row.questionContentSnippet || ''}>
                            {row.questionContentSnippet ? (
                              <span className="line-clamp-2 text-sm">{row.questionContentSnippet}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-2 px-4">
                            <ul className="list-disc list-inside text-amber-800 space-y-0.5">
                              {row.qualityWarnings.map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          </td>
                          <td className="py-2 px-4 text-right text-gray-600">{formatNum(row.total_tokens)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 핵심 키워드 사용 현황 (Naver/Google 수집 키워드 확인) */}
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-emerald-600" />
              핵심 키워드 사용 현황
            </h2>
            <p className="text-sm text-gray-500 mb-3">
              Q&A 생성 시 사용된 핵심 키워드와 월간 검색량(사람들이 많이 찾는 키워드)을 확인하세요. Naver 검색량은 PC+모바일 합계입니다.
            </p>
            {(!data.keywordLogs || data.keywordLogs.length === 0) ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                이 기간에 키워드가 저장된 Q&A 생성 이력이 없습니다. (이 기능 반영 이후 생성된 건만 표시됩니다)
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">일시</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">사용자</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">상품명</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">핵심 키워드 (상위 5개) · 검색량</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.keywordLogs.map((row) => {
                        const withVol = row.searchKeywordsWithVolume && row.searchKeywordsWithVolume.length > 0
                          ? row.searchKeywordsWithVolume
                          : row.searchKeywords.map((k) => ({ keyword: k, volume: null as number | null }))
                        const formatVol = (v: number | null) =>
                          v == null ? '-' : v >= 10000 ? `${(v / 10000).toFixed(1)}만` : v.toLocaleString()
                        return (
                          <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-4 text-gray-600 whitespace-nowrap">{formatDate(row.created_at)}</td>
                            <td className="py-2 px-4">
                              <span className="font-medium text-gray-800">{row.username}</span>
                              {row.full_name && row.full_name !== '-' && (
                                <span className="text-gray-500 ml-1">({row.full_name})</span>
                              )}
                            </td>
                            <td className="py-2 px-4 text-gray-700 max-w-[200px] truncate" title={row.productName}>
                              {row.productName}
                            </td>
                            <td className="py-2 px-4">
                              <span className="text-emerald-800 font-medium">
                                {withVol.map((x) => (x.volume != null ? `${x.keyword} (${formatVol(x.volume)})` : x.keyword)).join(' · ')}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 사용자별 주간 분석 보고서 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setShowWeeklyReports(!showWeeklyReports)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
            >
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FileBarChart className="w-5 h-5 text-indigo-600" />
                사용자별 주간 분석 보고서
              </h2>
              {showWeeklyReports ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
            </button>
            {showWeeklyReports && (
              <div className="p-4 pt-0 border-t border-gray-200 space-y-4">
                {/* 기간: 버튼형 */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-600 shrink-0">기간</span>
                  <div className="flex flex-wrap gap-2">
                    {[7, 14, 30].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setReportDays(d)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                          reportDays === d
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        최근 {d}일
                      </button>
                    ))}
                  </div>
                </div>
                {weeklyReports && weeklyReports.reports.length > 0 && (
                  <>
                    {/* 본부: 버튼형 */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-600 shrink-0">본부</span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setReportDepartment('all')}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            reportDepartment === 'all'
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          전체
                        </button>
                        {Array.from(
                          new Map(
                            weeklyReports.reports
                              .filter((r) => r.department_id || r.department_name)
                              .map((r) => [
                                r.department_id || r.department_name || '',
                                r.department_name || r.department_id || '미지정'
                              ])
                          ).entries()
                        )
                          .sort((a, b) => (a[1] || '').localeCompare(b[1] || ''))
                          .map(([val, label]) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setReportDepartment(val)}
                              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                reportDepartment === val
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        {weeklyReports.reports.some((r) => !r.department_id && !r.department_name) && (
                          <button
                            type="button"
                            onClick={() => setReportDepartment('none')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                              reportDepartment === 'none'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            미지정
                          </button>
                        )}
                      </div>
                    </div>
                    {/* 검색 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Search className="w-4 h-4 text-gray-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="아이디 또는 이름으로 검색"
                        value={reportSearchQuery}
                        onChange={(e) => setReportSearchQuery(e.target.value)}
                        className="flex-1 min-w-0 max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      {reportSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setReportSearchQuery('')}
                          className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                        >
                          지우기
                        </button>
                      )}
                    </div>
                  </>
                )}
                {weeklyLoading ? (
                  <div className="text-center py-8 text-gray-500">보고서 불러오는 중...</div>
                ) : !weeklyReports || weeklyReports.reports.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">해당 기간 활동 이력이 없습니다.</div>
                ) : (() => {
                  const q = reportSearchQuery.trim().toLowerCase()
                  let filtered = q
                    ? weeklyReports.reports.filter(
                        (r) =>
                          (r.username || '').toLowerCase().includes(q) ||
                          (r.full_name || '').toLowerCase().includes(q)
                      )
                    : weeklyReports.reports
                  if (reportDepartment !== 'all') {
                    if (reportDepartment === 'none') {
                      filtered = filtered.filter((r) => !r.department_id && !r.department_name)
                    } else {
                      filtered = filtered.filter(
                        (r) => (r.department_id || r.department_name || '') === reportDepartment
                      )
                    }
                  }
                  if (filtered.length === 0) {
                    return <div className="text-center py-8 text-gray-500">검색 결과가 없습니다.</div>
                  }
                  // 전체 선택 시: 본부 구분 없이 최근 활동순 정렬
                  if (reportDepartment === 'all') {
                    const sorted = [...filtered].sort((a, b) => {
                      const tA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0
                      const tB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0
                      return tB - tA
                    })
                    return (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {sorted.map((r) => (
                          <div
                            key={r.user_id}
                            className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-gray-900">
                                {r.username}
                                {r.full_name && r.full_name !== '-' && (
                                  <span className="text-gray-500 font-normal ml-1">({r.full_name})</span>
                                )}
                              </div>
                              {r.lastActivity && (
                                <div className="text-xs text-gray-500">
                                  최근 활동:{' '}
                                  {new Date(r.lastActivity).toLocaleString('ko-KR', {
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              )}
                            </div>
                            {r.good.length > 0 && (
                              <div>
                                <div className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> 잘한 점
                                </div>
                                <ul className="text-sm text-green-800 space-y-0.5">
                                  {r.good.map((g, i) => (
                                    <li key={i}>· {g}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {r.bad.length > 0 && (
                              <div>
                                <div className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
                                  <XCircle className="w-3.5 h-3.5" /> 보완할 점
                                </div>
                                <ul className="text-sm text-amber-800 space-y-0.5">
                                  {r.bad.map((b, i) => (
                                    <li key={i}>· {b}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {r.good.length === 0 && r.bad.length === 0 && (
                              <p className="text-sm text-gray-500">요약 없음</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  }
                  const byDept = new Map<string, WeeklyReport[]>()
                  filtered.forEach((r) => {
                    const key = r.department_name || r.department_id || '미지정'
                    if (!byDept.has(key)) byDept.set(key, [])
                    byDept.get(key)!.push(r)
                  })
                  const deptEntries = Array.from(byDept.entries()).sort((a, b) => a[0].localeCompare(b[0]))
                  return (
                    <div className="space-y-6">
                      {deptEntries.map(([deptName, list]) => (
                        <div key={deptName}>
                          <h3 className="text-sm font-bold text-gray-700 mb-3 pb-2 border-b border-gray-200">
                            {deptName}
                          </h3>
                          <div className="grid gap-4 sm:grid-cols-2">
                            {list.map((r) => (
                              <div
                                key={r.user_id}
                                className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3"
                              >
                                <div className="font-semibold text-gray-900">
                                  {r.username}
                                  {r.full_name && r.full_name !== '-' && (
                                    <span className="text-gray-500 font-normal ml-1">({r.full_name})</span>
                                  )}
                                </div>
                                {r.good.length > 0 && (
                                  <div>
                                    <div className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> 잘한 점
                                    </div>
                                    <ul className="text-sm text-green-800 space-y-0.5">
                                      {r.good.map((g, i) => (
                                        <li key={i}>· {g}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {r.bad.length > 0 && (
                                  <div>
                                    <div className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
                                      <XCircle className="w-3.5 h-3.5" /> 보완할 점
                                    </div>
                                    <ul className="text-sm text-amber-800 space-y-0.5">
                                      {r.bad.map((b, i) => (
                                        <li key={i}>· {b}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {r.good.length === 0 && r.bad.length === 0 && (
                                  <p className="text-sm text-gray-500">요약 없음</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          {/* 품질 게이트 검수 기준 (8절) */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowQualityGateCriteria(!showQualityGateCriteria)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 transition-colors"
            >
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Shield className="w-5 h-5 text-gray-600" />
                품질 게이트 검수 기준 (8절)
              </h2>
              {showQualityGateCriteria ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
            </button>
            {showQualityGateCriteria && (
              <div className="p-4 pt-0 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-4">
                  통과/재생성/폐기 판단 시 참고. 문서 <code className="bg-gray-200 px-1 rounded">docs/카페-Q&A-프롬프트-총정리.md</code> 8절과 동일합니다.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="text-left py-2 px-3 font-semibold text-gray-800">항목</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-800">질문(Step 1)</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-800">답변(Step 2)</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-800">대화 댓글(Step 3)</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-800">후기</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-gray-100">
                        <td className="py-2 px-3 font-medium text-gray-800 align-top">자연스러움</td>
                        <td className="py-2 px-3 text-gray-600 align-top">사람이 쓴 카페 질문글처럼 읽히는가</td>
                        <td className="py-2 px-3 text-gray-600 align-top">설계사 답글처럼 읽히는가</td>
                        <td className="py-2 px-3 text-gray-600 align-top">앞뒤 맥락과 말투가 이어지는가</td>
                        <td className="py-2 px-3 text-gray-600 align-top">가입 후 감사 인사처럼 읽히는가</td>
                      </tr>
                      <tr className="border-t border-gray-100">
                        <td className="py-2 px-3 font-medium text-gray-800 align-top">광고성</td>
                        <td className="py-2 px-3 text-gray-600 align-top">홍보글/광고 카피처럼 보이지 않는가</td>
                        <td className="py-2 px-3 text-gray-600 align-top">과하게 판매 유도만 하지 않는가</td>
                        <td className="py-2 px-3 text-gray-600 align-top">설계사 댓글이 연속 영업 톤만 아닌가</td>
                        <td className="py-2 px-3 text-gray-600 align-top">극찬·과장 없이 현실적인가</td>
                      </tr>
                      <tr className="border-t border-gray-100">
                        <td className="py-2 px-3 font-medium text-gray-800 align-top">정합성</td>
                        <td className="py-2 px-3 text-gray-400 align-top">—</td>
                        <td className="py-2 px-3 text-gray-600 align-top">질문 내용과 답변이 엇나가지 않는가</td>
                        <td className="py-2 px-3 text-gray-600 align-top">고객 질문에 맞게 답하는가</td>
                        <td className="py-2 px-3 text-gray-400 align-top">—</td>
                      </tr>
                      <tr className="border-t border-gray-100">
                        <td className="py-2 px-3 font-medium text-gray-800 align-top">반복성</td>
                        <td className="py-2 px-3 text-gray-400 align-top">—</td>
                        <td className="py-2 px-3 text-gray-600 align-top">이전 답변과 패턴이 동일하지 않은가</td>
                        <td className="py-2 px-3 text-gray-600 align-top">이미 다룬 주제·표현이 반복되지 않는가</td>
                        <td className="py-2 px-3 text-gray-600 align-top">후기 패턴이 매번 비슷하지 않은가</td>
                      </tr>
                      <tr className="border-t border-gray-100">
                        <td className="py-2 px-3 font-medium text-gray-800 align-top">키워드 과밀도</td>
                        <td className="py-2 px-3 text-gray-600 align-top">핵심 키워드가 억지로 나열되지 않았는가</td>
                        <td className="py-2 px-3 text-gray-600 align-top">키워드가 문맥에 녹아 있는가</td>
                        <td className="py-2 px-3 text-gray-400 align-top">—</td>
                        <td className="py-2 px-3 text-gray-400 align-top">—</td>
                      </tr>
                      <tr className="border-t border-gray-100">
                        <td className="py-2 px-3 font-medium text-gray-800 align-top">후기 진정성</td>
                        <td className="py-2 px-3 text-gray-400 align-top">—</td>
                        <td className="py-2 px-3 text-gray-400 align-top">—</td>
                        <td className="py-2 px-3 text-gray-400 align-top">—</td>
                        <td className="py-2 px-3 text-gray-600 align-top">조작·작업글처럼 느껴지지 않는가</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 실패 케이스 사전 (9절) */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFailureCases(!showFailureCases)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-100 transition-colors"
            >
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-slate-600" />
                실패 케이스 사전 (9절)
              </h2>
              {showFailureCases ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>
            {showFailureCases && (
              <div className="p-4 pt-0 border-t border-slate-200">
                <p className="text-sm text-gray-600 mb-4">
                  재생성/폐기 판단 및 디버깅 시 참고용. 문서 <code className="bg-slate-200 px-1 rounded">docs/카페-Q&A-프롬프트-총정리.md</code> 9절과 동일합니다.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="text-left py-2 px-3 font-semibold text-slate-800">유형</th>
                        <th className="text-left py-2 px-3 font-semibold text-slate-800">설명</th>
                        <th className="text-left py-2 px-3 font-semibold text-slate-800">대응 방향</th>
                      </tr>
                    </thead>
                    <tbody>
                      {FAILURE_CASES.map((row, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="py-2 px-3 font-medium text-slate-800 align-top">{row.type}</td>
                          <td className="py-2 px-3 text-slate-600 align-top">{row.desc}</td>
                          <td className="py-2 px-3 text-slate-700 align-top">{row.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 단계별 행동 목표 (10절) */}
          <div className="bg-blue-50/50 rounded-xl border border-blue-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowActionGoals(!showActionGoals)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-blue-100/50 transition-colors"
            >
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                단계별 행동 목표 (10절)
              </h2>
              {showActionGoals ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
            </button>
            {showActionGoals && (
              <div className="p-4 pt-0 border-t border-blue-200">
                <p className="text-sm text-gray-600 mb-4">
                  단계별 1차·2차 목표와 피할 것을 정해 두면 프롬프트 수정 시 균형을 잡기 쉽습니다.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-blue-200 rounded-lg overflow-hidden bg-white">
                    <thead>
                      <tr className="bg-blue-100">
                        <th className="text-left py-2 px-3 font-semibold text-gray-800">단계</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-800">1차 목표</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-800">2차 목표</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-800">피할 것</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-gray-100"><td className="py-2 px-3 font-medium text-gray-800 align-top">질문</td><td className="py-2 px-3 text-gray-600 align-top">진짜 사람이 고민하는 듯 보이기</td><td className="py-2 px-3 text-gray-600 align-top">궁금증·상황이 구체적으로 드러나기</td><td className="py-2 px-3 text-gray-600 align-top">광고 카피·판매 포인트 과다 노출</td></tr>
                      <tr className="border-t border-gray-100"><td className="py-2 px-3 font-medium text-gray-800 align-top">첫 답변</td><td className="py-2 px-3 text-gray-600 align-top">신뢰 확보 + 기본 설득</td><td className="py-2 px-3 text-gray-600 align-top">구체적 금액·조건·비교로 이해 도움</td><td className="py-2 px-3 text-gray-600 align-top">과한 CTA·반박 없는 일방 주장</td></tr>
                      <tr className="border-t border-gray-100"><td className="py-2 px-3 font-medium text-gray-800 align-top">고객 댓글</td><td className="py-2 px-3 text-gray-600 align-top">추가 궁금증이 자연스럽게 발생</td><td className="py-2 px-3 text-gray-600 align-top">페르소나에 맞는 말투·관심사</td><td className="py-2 px-3 text-gray-600 align-top">같은 주제·같은 톤 반복</td></tr>
                      <tr className="border-t border-gray-100"><td className="py-2 px-3 font-medium text-gray-800 align-top">설계사 댓글</td><td className="py-2 px-3 text-gray-600 align-top">고객 질문에 맞게 짧게 답변</td><td className="py-2 px-3 text-gray-600 align-top">과하지 않게 다음 행동(쪽지/상담) 유도</td><td className="py-2 px-3 text-gray-600 align-top">연속적인 강한 영업 멘트</td></tr>
                      <tr className="border-t border-gray-100"><td className="py-2 px-3 font-medium text-gray-800 align-top">후기</td><td className="py-2 px-3 text-gray-600 align-top">과장 없이 사회적 증거 보강</td><td className="py-2 px-3 text-gray-600 align-top">안심·현실 톤의 짧은 감사 인사</td><td className="py-2 px-3 text-gray-600 align-top">극찬형·조작 느낌</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 목표 KPI (13절) */}
          <div className="bg-emerald-50/50 rounded-xl border border-emerald-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTargetKpi(!showTargetKpi)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-emerald-100/50 transition-colors"
            >
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-emerald-600" />
                목표 KPI · 성과 측정 (13절)
              </h2>
              {showTargetKpi ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
            </button>
            {showTargetKpi && (
              <div className="p-4 pt-0 border-t border-emerald-200">
                <p className="text-sm text-gray-600 mb-4">
                  시스템 목적은 “예쁜 글”이 아니라 전환·운영 안정성입니다. 아래 지표를 카페/플랫폼에서 수집 가능한 범위에서 정의하면, 프롬프트·정책 수정을 데이터 기준으로 할 수 있습니다.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-emerald-200 rounded-lg overflow-hidden bg-white">
                    <thead>
                      <tr className="bg-emerald-100">
                        <th className="text-left py-2 px-3 font-semibold text-gray-800">구분</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-800">지표 예시</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-800">비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-gray-100"><td className="py-2 px-3 font-medium text-gray-800 align-top">노출·참여</td><td className="py-2 px-3 text-gray-600 align-top">제목 클릭률, 답변까지 체류율, 댓글 지속률</td><td className="py-2 px-3 text-gray-500 align-top">카페/플랫폼에서 수집 가능 범위에서 정의</td></tr>
                      <tr className="border-t border-gray-100"><td className="py-2 px-3 font-medium text-gray-800 align-top">전환</td><td className="py-2 px-3 text-gray-600 align-top">쪽지/문의 유도율, 저장·공감 비율</td><td className="py-2 px-3 text-gray-500 align-top">목표 전환 액션을 정해 두고 추적</td></tr>
                      <tr className="border-t border-gray-100"><td className="py-2 px-3 font-medium text-gray-800 align-top">운영 리스크</td><td className="py-2 px-3 text-gray-600 align-top">운영자 삭제/신고율, 이용자 신고 접수</td><td className="py-2 px-3 text-gray-500 align-top">광고/작업글 패널티 감소가 목표일 때</td></tr>
                      <tr className="border-t border-gray-100"><td className="py-2 px-3 font-medium text-gray-800 align-top">실험</td><td className="py-2 px-3 text-gray-600 align-top">후기 삽입 유무에 따른 전환 차이, 키워드 밀도별 자연스러움/전환</td><td className="py-2 px-3 text-gray-500 align-top">A/B 테스트 항목 후보</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
