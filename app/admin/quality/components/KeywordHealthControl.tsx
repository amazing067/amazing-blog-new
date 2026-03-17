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
  totalGenerationsWithDisplay: number
  marketHeadPresenceRate: number
  marketHeadBigKeywordRate: number
  internalKeywordLeakCount: number
  zeroVolumeRate: number
  unknownVolumeRate: number
  displayWithVolumeRate?: number
  concernReflectionRate?: number | null
  concernCustomerLanguageRate?: number | null
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
  market_head: '시장 대표 (검색창에 가장 많이 치는 큰 이름)',
  product_core: '상품 핵심 (이 글이 다루는 보험의 중심 표현)',
  concern_search: '고민 검색 (고객이 검색창에 칠 만한 고민 표현)',
  customer_concern: '고객 고민 (글에서 직접 이야기하는 고민 문장)',
  persona_longtail: '페르소나 (어떤 사람이 쓰는지 나타내는 말)',
  intent_head: '의도 (보험료/비교 등 행동 의도를 보여주는 말)',
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
        키워드 건강 관제 (전체 운영 기준)
      </h2>
      <p className="text-sm text-gray-500 dark:text-slate-300 mt-1">
        모든 사용자가 쓴 글에서, 검색 키워드와 표시 키워드 5칸이 제대로 작동하고 있는지 모니터링합니다.
      </p>

      {/* 상단 요약 카드: 전체 운영 상태 */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="시장 대표 키워드 존재율"
            value={`${stats.marketHeadPresenceRate}%`}
            sub="표시 키워드 5칸 중 market_head가 채워진 세션 비율"
          />
          <SummaryCard
            label="큰 시장 키워드 사용율"
            value={`${stats.marketHeadBigKeywordRate}%`}
            sub="암보험·실손보험·건강보험 같은 큰 이름을 쓴 비율"
          />
          <SummaryCard
            label="검색량 있는 표시 키워드 비율"
            value={stats.displayWithVolumeRate != null ? `${stats.displayWithVolumeRate}%` : '-'}
            sub="검색량이 0이 아닌 표시 키워드 비율"
          />
          <SummaryCard
            label="검색량 0 키워드 비율"
            value={`${stats.zeroVolumeRate}%`}
            sub="많을수록 검색에 도움이 안 되는 키워드가 많다는 뜻"
            highlight={stats.zeroVolumeRate > 20}
          />
          <SummaryCard
            label="고객 고민, 사람 말투 비율"
            value={stats.concernCustomerLanguageRate != null ? `${stats.concernCustomerLanguageRate}%` : '-'}
            sub="고객 고민 칸이 내부어가 아닌 자연스러운 우리말로 채워진 비율"
          />
        </div>
      )}

      {stats && (
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60 p-4">
          <h3 className="text-sm font-bold text-gray-800 dark:text-slate-100 mb-1">displayKeywords 5칸 역할 안내</h3>
          <p className="text-xs text-gray-600 dark:text-slate-300 mb-2">
            한 세션마다 표시 키워드는 항상 다섯 칸으로 저장됩니다. 이 다섯 칸이 잘 채워져 있어야 전체 운영 품질이 건강합니다.
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-700 dark:text-slate-200">
            <li><strong className="font-semibold">market_head</strong> — {ROLE_LABELS.market_head}</li>
            <li><strong className="font-semibold">product_core</strong> — {ROLE_LABELS.product_core}</li>
            <li><strong className="font-semibold">customer_concern</strong> — {ROLE_LABELS.customer_concern}</li>
            <li><strong className="font-semibold">persona_longtail</strong> — {ROLE_LABELS.persona_longtail}</li>
            <li><strong className="font-semibold">intent_head</strong> — {ROLE_LABELS.intent_head}</li>
          </ul>
          <p className="text-xs text-gray-600 dark:text-slate-300 mt-2">
            이 다섯 칸 중 어디에 내부 상품 코드(예: 20년납, 2종, (4165))가 새어 나오는지 함께 감시합니다. (현재 누출 슬롯 수: {stats.internalKeywordLeakCount}개)
          </p>
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
          <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200 mb-2">키워드 분포 (표시 키워드 5칸 기준)</h3>
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
