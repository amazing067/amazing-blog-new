'use client'

import { useState, useEffect } from 'react'

interface ActionCardProps {
  title: string
  count: number
  color: 'blue' | 'green' | 'red' | 'orange' | 'yellow'
  filter: 'all' | 'active' | 'suspended' | 'expiring' | 'pending'
}

const colorClasses = {
  blue: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border-blue-500',
  green: 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 border-green-500',
  red: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border-red-500',
  orange: 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 border-orange-500',
  yellow: 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 border-yellow-500',
}

export default function ActionCard({ title, count, color, filter }: ActionCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = () => {
    setIsLoading(true)
    // 전역 이벤트를 통해 UsersTable에 필터 변경 알림
    window.dispatchEvent(new CustomEvent('filterChange', { detail: { filter } }))
    setTimeout(() => {
      setIsLoading(false)
    }, 100)
  }

  return (
    <button
      onClick={handleClick}
      className={`${colorClasses[color]} rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105 border-l-4 cursor-pointer relative overflow-hidden`}
      data-filter={filter}
    >
      <div className="relative z-10">
        <div className="text-sm font-medium opacity-90 mb-1">{title}</div>
        <div className="text-3xl font-bold">{count}명</div>
      </div>
      {isLoading && (
        <div className="absolute inset-0 bg-white/20 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </button>
  )
}

