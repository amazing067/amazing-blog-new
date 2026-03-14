'use client'

import { MessageSquare, FileText, Zap, DollarSign, AlertTriangle, Shield, RefreshCw, Clock } from 'lucide-react'

type KpiSummary = {
  totalQa: number
  totalBlog: number
  totalTokens: number
  totalCostKrw: number
  qualityWarningCount: number
  qualityWarningRate?: number
  avgCostPerQa?: number
  avgCostPerBlog?: number
  sectionAverages?: Record<string, number>
  regenRate?: number
  avgLatencyMs?: number
  days: number
}

function Card({ icon, label, value, sub, highlight }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; highlight?: boolean
}) {
  return (
    <div className={`bg-white rounded-xl border p-4 shadow-sm ${highlight ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}>
      <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">{icon}{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

export default function KpiCards({ kpiSummary }: { kpiSummary: KpiSummary }) {
  const fmt = (n: number) => n.toLocaleString()
  const avgScores = Object.values(kpiSummary.sectionAverages || {})
  const avgQuality = avgScores.length > 0 ? Math.round(avgScores.reduce((a, b) => a + b, 0) / avgScores.length) : 0
  const humanLikeness = kpiSummary.sectionAverages?.humanLikeness ?? 0

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-4">KPI 카드</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card icon={<MessageSquare className="w-4 h-4" />} label="Q&A 생성" value={fmt(kpiSummary.totalQa)} sub={`최근 ${kpiSummary.days}일`} />
        <Card icon={<FileText className="w-4 h-4" />} label="블로그 생성" value={fmt(kpiSummary.totalBlog)} />
        <Card icon={<Zap className="w-4 h-4" />} label="토큰 합계" value={fmt(kpiSummary.totalTokens)} />
        <Card icon={<DollarSign className="w-4 h-4" />} label="비용(원)" value={`₩${fmt(kpiSummary.totalCostKrw)}`} sub={kpiSummary.avgCostPerQa ? `QA건당 ₩${fmt(kpiSummary.avgCostPerQa)}` : undefined} />
        <Card icon={<AlertTriangle className="w-4 h-4" />} label="품질 경고" value={fmt(kpiSummary.qualityWarningCount)} sub={`경고율 ${kpiSummary.qualityWarningRate ?? 0}%`} highlight />
        <Card icon={<Shield className="w-4 h-4" />} label="평균 품질점수" value={`${avgQuality}점`} sub="8개 게이트 평균" />
        <Card icon={<Shield className="w-4 h-4" />} label="인간미 점수" value={`${Math.round(humanLikeness)}점`} sub="humanLikeness 평균" />
        <Card icon={<RefreshCw className="w-4 h-4" />} label="재생성율" value={`${kpiSummary.regenRate ?? 0}%`} sub="답변 재생성 비율" />
        <Card icon={<Clock className="w-4 h-4" />} label="평균 응답시간" value={kpiSummary.avgLatencyMs ? `${(kpiSummary.avgLatencyMs / 1000).toFixed(1)}s` : '-'} />
        <Card icon={<FileText className="w-4 h-4" />} label="블로그 건당" value={kpiSummary.avgCostPerBlog ? `₩${fmt(kpiSummary.avgCostPerBlog)}` : '-'} />
      </div>
    </div>
  )
}
