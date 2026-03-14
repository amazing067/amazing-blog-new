'use client'

import { Shield } from 'lucide-react'

type StatusLevel = 'stable' | 'warning' | 'unstable' | 'regen_recommended' | 'check_required'

const STATUS_CONFIG: Record<StatusLevel, { label: string; color: string; bg: string; border: string }> = {
  stable: { label: '안정', color: 'text-green-800', bg: 'bg-green-50', border: 'border-green-300' },
  warning: { label: '주의', color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-300' },
  unstable: { label: '불안정', color: 'text-orange-800', bg: 'bg-orange-50', border: 'border-orange-300' },
  regen_recommended: { label: '재생성 권장', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300' },
  check_required: { label: '운영 점검 필요', color: 'text-red-900', bg: 'bg-red-100', border: 'border-red-400' },
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
    avgLatencyMs?: number
  }
}) {
  const avgScores = Object.values(kpiSummary.sectionAverages || {})
  const avgTotalScore = avgScores.length > 0 ? Math.round(avgScores.reduce((a, b) => a + b, 0) / avgScores.length) : 0
  const status = getOperatingStatus({
    avgTotalScore,
    qualityWarningRate: kpiSummary.qualityWarningRate,
    regenRate: kpiSummary.regenRate,
    failureTopList: kpiSummary.failureTopList,
  })
  const cfg = STATUS_CONFIG[status]

  return (
    <div className={`rounded-xl border-2 ${cfg.border} ${cfg.bg} px-6 py-4 flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <Shield className={`w-6 h-6 ${cfg.color}`} />
        <div>
          <span className={`text-lg font-bold ${cfg.color}`}>{cfg.label}</span>
          <span className="text-sm text-gray-600 ml-3">
            평균 품질 {avgTotalScore}점 | 경고율 {kpiSummary.qualityWarningRate ?? 0}% | 재생성율 {kpiSummary.regenRate ?? 0}%
          </span>
        </div>
      </div>
      <div className="text-sm text-gray-500">
        총 {kpiSummary.totalQa}건 | 평균 {kpiSummary.avgLatencyMs ? `${(kpiSummary.avgLatencyMs / 1000).toFixed(1)}s` : '-'}
      </div>
    </div>
  )
}
