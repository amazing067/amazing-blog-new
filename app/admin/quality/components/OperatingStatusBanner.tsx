'use client'

import { Shield } from 'lucide-react'

type StatusLevel = 'stable' | 'warning' | 'unstable' | 'regen_recommended' | 'check_required'

const STATUS_CONFIG: Record<StatusLevel, { label: string; color: string; bg: string; border: string }> = {
  stable: { label: '안정', color: 'text-emerald-100 dark:text-emerald-100', bg: 'bg-emerald-900 dark:bg-emerald-900', border: 'border-emerald-500/70' },
  warning: { label: '주의', color: 'text-amber-100 dark:text-amber-100', bg: 'bg-amber-900 dark:bg-amber-900', border: 'border-amber-500/70' },
  unstable: { label: '불안정', color: 'text-orange-100 dark:text-orange-100', bg: 'bg-orange-900 dark:bg-orange-900', border: 'border-orange-500/70' },
  regen_recommended: { label: '재생성 권장', color: 'text-red-100 dark:text-red-100', bg: 'bg-red-900 dark:bg-red-900', border: 'border-red-500/70' },
  check_required: { label: '운영 점검 필요', color: 'text-rose-100 dark:text-rose-100', bg: 'bg-rose-900 dark:bg-rose-900', border: 'border-rose-500/70' },
}

export function getOperatingStatus(summary: {
  avgTotalScore?: number
  qualityWarningRate?: number
  regenRate?: number
  failureTopList?: Array<{ tag: string; count: number }>
}): StatusLevel {
  const avg = summary.avgTotalScore ?? 100
  const failRate = summary.qualityWarningRate ?? 0
  const regenRate = summary.regenRate ?? 0

  if (avg >= 95 && failRate < 5 && regenRate < 5) return 'stable'
  if (avg >= 85 && failRate < 15) return 'warning'
  if (regenRate > 30) return 'regen_recommended'
  if (avg < 70) return 'check_required'
  return 'unstable'
}

export default function OperatingStatusBanner({ kpiSummary }: {
  kpiSummary: {
    sectionAverages?: Record<string, number>
    qualityWarningRate?: number
    regenRate?: number
    failureTopList?: Array<{ tag: string; count: number }>
    totalQa: number
    totalRuns?: number
    avgTotalScore?: number | null
    avgLatencyMs?: number
  }
}) {
  const avgScores = Object.values(kpiSummary.sectionAverages || {})
  const computedAvg = avgScores.length > 0 ? Math.round(avgScores.reduce((a, b) => a + b, 0) / avgScores.length) : 0
  const avgTotalScore = kpiSummary.avgTotalScore != null ? Math.round(kpiSummary.avgTotalScore) : computedAvg
  const status = getOperatingStatus({
    avgTotalScore,
    qualityWarningRate: kpiSummary.qualityWarningRate,
    regenRate: kpiSummary.regenRate,
    failureTopList: kpiSummary.failureTopList,
  })
  const cfg = STATUS_CONFIG[status]
  const totalRuns = kpiSummary.totalRuns ?? kpiSummary.totalQa

  return (
    <div className={`rounded-xl border-2 ${cfg.border} ${cfg.bg} px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3`}>
      <div className="flex items-center gap-3">
        <Shield className={`w-6 h-6 ${cfg.color}`} />
        <div>
          <span className={`text-lg font-bold ${cfg.color}`}>{cfg.label}</span>
          <span className="block text-sm text-slate-100/80 mt-1">
            전체 사용자 기준 평균 품질 {avgTotalScore}점 · 경고율 {kpiSummary.qualityWarningRate ?? 0}% · 재생성율 {kpiSummary.regenRate ?? 0}%
          </span>
        </div>
      </div>
      <div className="text-sm text-slate-100/70">
        최근 {kpiSummary.totalQa}건 Q&A · 전체 생성 {totalRuns}건 · 평균 생성 시간 {kpiSummary.avgLatencyMs ? `${(kpiSummary.avgLatencyMs / 1000).toFixed(1)}초` : '-'}
      </div>
    </div>
  )
}
