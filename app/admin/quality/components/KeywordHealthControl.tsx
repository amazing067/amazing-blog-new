'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'

type KeywordDist = {
  keyword: string
  count: number
  avgVolume: number | null
  inTitleRate: number
  role?: string | null
  productGroups: string[]
}
type DisplayKeywordsStats = {
  marketHeadPresenceRate: number
  zeroVolumeRate: number
  unknownVolumeRate: number
  displayWithVolumeRate?: number
  concernReflectionRate?: number | null
  rolePresenceRate: Record<string, number>
}
type KeywordHealthData = {
  keywordDistribution: KeywordDist[]
  zeroVolumeKeywords: Array<{ keyword: string; count: number }>
  topConcernKeywords: Array<{ keyword: string; count: number }>
  keywordPerGeneration: { avg: number; min: number; max: number }
  displayKeywordsStats?: DisplayKeywordsStats | null
}

const ROLE_LABELS: Record<string, string> = {
  market_head: '시장 대표',
  product_core: '상품 핵심',
  concern_search: '고민 검색',
  persona_longtail: '페르소나',
  intent_head: '의도',
}

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? 'border-red-500/50 bg-red-500/10 dark:bg-red-500/10 dark:border-red-500/40'
          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900'
      }`}
    >
      <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">{label}</div>
      <div className="text-xl font-bold text-gray-900 dark:text-slate-50">{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

export default function KeywordHealthControl({ days }: { days: number }) {
  const [data, setData] = useState<KeywordHealthData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/keyword-health?days=${days}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  if (loading) {
    return (
      <div className="text-center py-8 text-slate-400 dark:text-slate-400">키워드 데이터 로딩...</div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
        <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 mb-2 flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-500" />
          키워드 건강 관리 (전체 사용자 기준)
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">데이터를 불러오지 못했습니다.</p>
      </div>
    )
  }

  const stats = data.displayKeywordsStats

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-6">
      <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
        <Search className="w-5 h-5 text-blue-500" />
        키워드 건강 관리 (전체 사용자 기준)
      </h2>

      {/* 상단 4개 요약 카드 */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="시장 대표 키워드 존재율"
            value={`${stats.marketHeadPresenceRate}%`}
            sub="display 5칸 기준"
          />
          <SummaryCard
            label="검색량 있는 display 키워드 비율"
            value={stats.displayWithVolumeRate != null ? `${stats.displayWithVolumeRate}%` : '-'}
            sub="볼륨 > 0 비율"
          />
          <SummaryCard
            label="검색량 0 키워드 비율"
            value={`${stats.zeroVolumeRate}%`}
            sub="주의 대상"
            highlight={stats.zeroVolumeRate > 20}
          />
          <SummaryCard
            label="concern 키워드 반영률"
            value={stats.concernReflectionRate != null ? `${stats.concernReflectionRate}%` : '-'}
            sub="고민 키워드 반영 비율"
          />
        </div>
      )}

      {/* 검색량 0 키워드 강조 영역 */}
      {data.zeroVolumeKeywords.length > 0 && (
        <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 dark:bg-amber-500/10 p-4">
          <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-2">검색량 0 키워드 (주의)</h3>
          <div className="flex flex-wrap gap-2">
            {data.zeroVolumeKeywords.slice(0, 15).map((kw) => (
              <span
                key={kw.keyword}
                className="bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/40 px-2 py-1 rounded text-xs font-medium"
              >
                {kw.keyword} ({kw.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 키워드 분포 표 */}
      {data.keywordDistribution.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200 mb-2">키워드 분포 (display 5칸 기준)</h3>
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto rounded-lg border border-gray-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                <tr className="text-left">
                  <th className="py-2 px-3 text-gray-600 dark:text-slate-200">키워드</th>
                  <th className="py-2 px-3 text-gray-600 dark:text-slate-200 text-right">등장 횟수</th>
                  <th className="py-2 px-3 text-gray-600 dark:text-slate-200 text-right">평균 검색량</th>
                  <th className="py-2 px-3 text-gray-600 dark:text-slate-200 text-right">제목 포함률</th>
                  <th className="py-2 px-3 text-gray-600 dark:text-slate-200">역할</th>
                  <th className="py-2 px-3 text-gray-600 dark:text-slate-200">주요 상품군</th>
                </tr>
              </thead>
              <tbody>
                {data.keywordDistribution.slice(0, 30).map((kw) => (
                  <tr
                    key={kw.keyword}
                    className="border-b border-gray-100 dark:border-slate-700 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-2 px-3 font-medium text-gray-900 dark:text-slate-100">{kw.keyword}</td>
                    <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-slate-100">{kw.count}</td>
                    <td className="py-2 px-3 text-right">
                      {kw.avgVolume !== null && kw.avgVolume > 0 ? (
                        <span className="font-medium text-gray-900 dark:text-slate-100">{kw.avgVolume.toLocaleString()}</span>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/40">
                          검색량 없음
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-slate-100">{kw.inTitleRate}%</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-slate-300">{kw.role ? ROLE_LABELS[kw.role] || kw.role : '-'}</td>
                    <td className="py-2 px-3 text-gray-600 dark:text-slate-400 truncate max-w-[180px]">{kw.productGroups.join(', ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.topConcernKeywords.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200 mb-2">상위 Concern 키워드</h3>
          <div className="flex flex-wrap gap-2">
            {data.topConcernKeywords.slice(0, 10).map((kw) => (
              <span
                key={kw.keyword}
                className="bg-blue-500/20 text-blue-800 dark:text-blue-400 border border-blue-500/40 px-2 py-1 rounded text-xs"
              >
                {kw.keyword} ({kw.count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
