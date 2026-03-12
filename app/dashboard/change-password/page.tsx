'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Lock, Loader2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.newPassword.length < 6) {
      setError('새 비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError('새 비밀번호와 확인이 일치하지 않습니다.')
      return
    }
    if (formData.currentPassword === formData.newPassword) {
      setError('새 비밀번호는 현재 비밀번호와 달라야 합니다.')
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user?.email) {
        setError('로그인 정보를 찾을 수 없습니다. 다시 로그인해 주세요.')
        setIsSubmitting(false)
        return
      }

      // 현재 비밀번호 확인
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: formData.currentPassword,
      })

      if (signInError) {
        setError('현재 비밀번호가 올바르지 않습니다.')
        setIsSubmitting(false)
        return
      }

      // 새 비밀번호로 변경
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword,
      })

      if (updateError) {
        setError(updateError.message || '비밀번호 변경에 실패했습니다.')
        setIsSubmitting(false)
        return
      }

      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch (err: unknown) {
      setError('비밀번호 변경 중 오류가 발생했습니다.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          대시보드로 돌아가기
        </Link>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-xl">
              <Lock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                비밀번호 변경
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                새 비밀번호를 입력해 주세요.
              </p>
            </div>
          </div>

          {success ? (
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 p-4 text-center">
              비밀번호가 변경되었습니다. 대시보드로 이동합니다.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  현재 비밀번호
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  placeholder="현재 비밀번호"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  새 비밀번호
                </label>
                <input
                  type="password"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  placeholder="6자 이상"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  새 비밀번호 확인
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  placeholder="새 비밀번호 다시 입력"
                  autoComplete="new-password"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    변경 중...
                  </>
                ) : (
                  '비밀번호 변경'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
