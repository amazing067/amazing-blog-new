'use client'

import { MessageSquare, FileText, Zap, DollarSign, AlertTriangle, Shield, RefreshCw, Clock, Users, Activity, Search, MessageCircle } from 'lucide-react'

type KpiSummary = {
  totalQa: number
  totalBlog?: number
  totalTokens: number
  totalCostKrw: number
  totalUsers?: number
  totalRuns?: number
  qualityWarningCount: number
  qualityWarningRate?: number
  avgCostPerQa?: number
  avgCostPerBlog?: number
  avgTotalScore?: number | null
  sectionAverages?: Record<string, number>
  regenRate?: number
  avgLatencyMs?: number
  days: number
  zeroVolumeKeywordRate?: number | null
  threadMissingCount?: number
  finalAgentEndingMissingCount?: number
}

function Card({
  icon,
  label,
  value,
  sub,
  highlight,
  badge,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  highlight?: boolean
  badge?: '정상' | '주의' | '위험'
}) {
  const badgeClass =
    badge === '정상'
      ? 'bg-emerald-100 text-emerald-800 border border-emerald-400 dark:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-600'
      : badge === '주의'
        ? 'bg-amber-100 text-amber-800 border border-amber-400 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-600'
        : badge === '위험'
          ? 'bg-red-100 text-red-800 border border-red-400 dark:bg-red-900/60 dark:text-red-200 dark:border-red-600'
          : ''
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm dark:border-slate-700 ${
        highlight ? 'border-amber-500/50 bg-amber-500/10 dark:bg-amber-500/10' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700'
      }`}
    >
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-300 text-sm mb-1">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-slate-50">{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">{sub}</div>}
      {badge && <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}>{badge}</span>}
    </div>
  )
}

export default function KpiCards({ kpiSummary }: { kpiSummary: KpiSummary }) {
  const fmt = (n: number) => n.toLocaleString()
  const avgScore = kpiSummary.avgTotalScore ?? (() => {
    const avgScores = Object.values(kpiSummary.sectionAverages || {})
    return avgScores.length > 0 ? Math.round(avgScores.reduce((a, b) => a + b, 0) / avgScores.length) : 0
  })()

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 mb-4">전체 사용자 KPI</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <Card
          icon={<MessageSquare className="w-4 h-4" />}
          label="전체 생성 건수"
          value={fmt(kpiSummary.totalRuns ?? kpiSummary.totalQa)}
          sub={`최근 ${kpiSummary.days}일`}
        />
        <Card
          icon={<Users className="w-4 h-4" />}
          label="전체 사용자 수"
          value={fmt(kpiSummary.totalUsers ?? 0)}
        />
        <Card
          icon={<Shield className="w-4 h-4" />}
          label="평균 총점"
          value={kpiSummary.avgTotalScore != null ? `${kpiSummary.avgTotalScore}점` : `${avgScore}점`}
          sub="8개 게이트 가중평균"
        />
        <Card
          icon={<RefreshCw className="w-4 h-4" />}
          label="재생성 비율"
          value={`${kpiSummary.regenRate ?? 0}%`}
          sub="답변 재생성 비율"
        />
        <Card
          icon={<Search className="w-4 h-4" />}
          label="검색량 0 키워드 비율"
          value={kpiSummary.zeroVolumeKeywordRate != null ? `${kpiSummary.zeroVolumeKeywordRate}%` : '-'}
          sub="표시 키워드 5칸 기준"
          highlight={kpiSummary.zeroVolumeKeywordRate != null && kpiSummary.zeroVolumeKeywordRate > 20}
          badge={kpiSummary.zeroVolumeKeywordRate != null && kpiSummary.zeroVolumeKeywordRate > 20 ? '주의' : kpiSummary.zeroVolumeKeywordRate != null && kpiSummary.zeroVolumeKeywordRate > 40 ? '위험' : undefined}
        />
        <Card
          icon={<MessageCircle className="w-4 h-4" />}
          label="댓글 대화 누락 건수"
          value={fmt(kpiSummary.threadMissingCount ?? 0)}
          highlight={(kpiSummary.threadMissingCount ?? 0) > 0}
          badge={(kpiSummary.threadMissingCount ?? 0) > 0 ? '주의' : undefined}
        />
        <Card
          icon={<Activity className="w-4 h-4" />}
          label="최종 마무리 문장 누락"
          value={fmt(kpiSummary.finalAgentEndingMissingCount ?? 0)}
          highlight={(kpiSummary.finalAgentEndingMissingCount ?? 0) > 0}
          badge={(kpiSummary.finalAgentEndingMissingCount ?? 0) > 0 ? '주의' : undefined}
        />
        <Card icon={<Zap className="w-4 h-4" />} label="토큰 합계" value={fmt(kpiSummary.totalTokens)} />
        <Card
          icon={<DollarSign className="w-4 h-4" />}
          label="비용(원)"
          value={`₩${fmt(kpiSummary.totalCostKrw)}`}
          sub={kpiSummary.avgCostPerQa ? `QA건당 ₩${fmt(kpiSummary.avgCostPerQa)}` : undefined}
        />
        <Card
          icon={<AlertTriangle className="w-4 h-4" />}
          label="품질 경고"
          value={fmt(kpiSummary.qualityWarningCount)}
          sub={`경고율 ${kpiSummary.qualityWarningRate ?? 0}%`}
          highlight={kpiSummary.qualityWarningRate != null && kpiSummary.qualityWarningRate > 10}
        />
        <Card icon={<Clock className="w-4 h-4" />} label="평균 응답시간" value={kpiSummary.avgLatencyMs ? `${(kpiSummary.avgLatencyMs / 1000).toFixed(1)}s` : '-'} />
        {kpiSummary.totalBlog != null && (
          <Card icon={<FileText className="w-4 h-4" />} label="블로그 생성" value={fmt(kpiSummary.totalBlog)} />
        )}
      </div>
    </div>
  )
}
