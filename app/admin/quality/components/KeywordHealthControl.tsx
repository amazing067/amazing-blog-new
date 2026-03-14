'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'

type KeywordDist = { keyword: string; count: number; avgVolume: number | null; inTitleRate: number; productGroups: string[] }
type KeywordHealthData = {
  keywordDistribution: KeywordDist[]
  zeroVolumeKeywords: Array<{ keyword: string; count: number }>
  topConcernKeywords: Array<{ keyword: string; count: number }>
  keywordPerGeneration: { avg: number; min: number; max: number }
}

export default function KeywordHealthControl({ days }: { days: number }) {
  const [data, setData] = useState<KeywordHealthData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/keyword-health?days=${days}`)
      .then(r => r.json())
      .then(json => { if (json.success) setData(json) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  if (loading) return <div className="text-center py-8 text-gray-400">키워드 데이터 로딩...</div>

  if (!data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2"><Search className="w-5 h-5 text-blue-500" />키워드 건강 관리</h2>
        <p className="text-sm text-gray-500">데이터를 불러오지 못했습니다.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Search className="w-5 h-5 text-blue-500" />키워드 건강 관리</h2>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold">{data.keywordPerGeneration.avg}</div>
          <div className="text-xs text-gray-500">생성당 평균 키워드</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold">{data.zeroVolumeKeywords.length}</div>
          <div className="text-xs text-gray-500">검색량 0 키워드</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold">{data.topConcernKeywords.length}</div>
          <div className="text-xs text-gray-500">concern 키워드 종류</div>
        </div>
      </div>

      {data.keywordDistribution.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-2">상위 키워드 분포</h3>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-3">키워드</th><th className="py-2 pr-3">횟수</th><th className="py-2 pr-3">평균 검색량</th><th className="py-2 pr-3">제목 포함율</th><th className="py-2">상품군</th>
              </tr></thead>
              <tbody>
                {data.keywordDistribution.slice(0, 20).map(kw => (
                  <tr key={kw.keyword} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 font-medium">{kw.keyword}</td>
                    <td className="py-1.5 pr-3">{kw.count}</td>
                    <td className="py-1.5 pr-3">{kw.avgVolume !== null ? kw.avgVolume.toLocaleString() : '-'}</td>
                    <td className="py-1.5 pr-3">{kw.inTitleRate}%</td>
                    <td className="py-1.5 text-gray-500 truncate max-w-[150px]">{kw.productGroups.join(', ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.zeroVolumeKeywords.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-amber-700 mb-2">검색량 0 키워드 (주의)</h3>
          <div className="flex flex-wrap gap-2">
            {data.zeroVolumeKeywords.slice(0, 10).map(kw => (
              <span key={kw.keyword} className="bg-amber-50 text-amber-800 px-2 py-1 rounded text-xs">{kw.keyword} ({kw.count})</span>
            ))}
          </div>
        </div>
      )}

      {data.topConcernKeywords.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-2">상위 Concern 키워드</h3>
          <div className="flex flex-wrap gap-2">
            {data.topConcernKeywords.slice(0, 10).map(kw => (
              <span key={kw.keyword} className="bg-blue-50 text-blue-800 px-2 py-1 rounded text-xs">{kw.keyword} ({kw.count})</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
