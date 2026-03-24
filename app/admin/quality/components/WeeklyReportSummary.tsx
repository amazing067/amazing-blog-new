'use client'

import { useEffect, useState } from 'react'
import { FileBarChart, CheckCircle2, XCircle, Search } from 'lucide-react'

type WeeklyReport = {
  user_id: string; username: string; full_name: string
  department_id: string | null; department_name: string | null
  lastActivity: string | null
  stats: { qaCount: number; blogCount: number; totalTokens: number; qualityWarningCount: number; qaWithKeywordVolumeCount: number; qaKeywordVolumeSum: number; qualityWarningExamples: string[] }
  good: string[]; bad: string[]
}

export default function WeeklyReportSummary() {
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [reportDays, setReportDays] = useState(7)
  const [searchQuery, setSearchQuery] = useState('')
  const [department, setDepartment] = useState('all')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/weekly-reports?days=${reportDays}`)
      .then(r => r.json())
      .then(json => { if (json.reports) setReports(json.reports) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [reportDays])

  const departments = [...new Set(reports.filter(r => r.department_name).map(r => r.department_name!))]
  const filtered = reports.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!r.username.toLowerCase().includes(q) && !r.full_name.toLowerCase().includes(q)) return false
    }
    if (department !== 'all' && r.department_id !== department) return false
    return true
  })

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2"><FileBarChart className="w-5 h-5 text-purple-500" />주간 리포트 요약</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">선택한 기간 동안 사용자별 Q&A·블로그 생성 건수, 경고 건수, 토큰 사용량과 함께 잘된 점·개선점 요약을 보여줍니다. 검색·본부 필터로 범위를 좁힐 수 있습니다.</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setReportDays(d)} className={`px-3 py-1 rounded text-sm font-medium ${reportDays === d ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600'}`}>
              {d}일
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-slate-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="사용자 검색..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-slate-400"
          />
        </div>
        <select value={department} onChange={e => setDepartment(e.target.value)} className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100">
          <option value="all">전체 본부</option>
          {departments.map(d => <option key={d} value={reports.find(r => r.department_name === d)?.department_id || ''}>{d}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500 dark:text-slate-400">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">해당 기간에 활동한 사용자가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto">
          {filtered.map(r => (
            <div key={r.user_id} className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-2 bg-gray-50/50 dark:bg-slate-800/50">
              <div className="flex justify-between items-center">
                <div className="font-bold text-gray-800 dark:text-slate-100">{r.full_name} <span className="text-gray-500 dark:text-slate-400 font-normal text-sm">@{r.username}</span></div>
                {r.department_name && <span className="bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-200 px-2 py-0.5 rounded text-xs font-medium">{r.department_name}</span>}
              </div>
              <div className="flex gap-4 text-xs text-gray-600 dark:text-slate-300">
                <span>Q&A {r.stats.qaCount}건</span>
                <span>블로그 {r.stats.blogCount}건</span>
                <span>경고 {r.stats.qualityWarningCount}건</span>
                <span>토큰 {r.stats.totalTokens.toLocaleString()}</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400">
                마지막 사용일: {r.lastActivity ? new Date(r.lastActivity).toLocaleString('ko-KR') : '-'}
              </div>
              {r.good.length > 0 && (
                <div className="space-y-1">
                  {r.good.map((g, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-green-700 dark:text-green-300"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />{g}</div>
                  ))}
                </div>
              )}
              {r.bad.length > 0 && (
                <div className="space-y-1">
                  {r.bad.map((b, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-orange-700 dark:text-orange-300"><XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{b}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
