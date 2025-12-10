'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.username || !formData.password) {
      setError('아이디와 비밀번호를 입력해주세요')
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()

      // 1. username으로 profiles 테이블에서 이메일 조회
      console.log('로그인 시도:', formData.username)
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('email, is_approved, role, membership_status')
        .eq('username', formData.username)
        .single()

      console.log('프로필 조회 결과:', { profileData, profileError })

      if (profileError || !profileData) {
        console.error('프로필 조회 실패:', {
          code: profileError?.code,
          message: profileError?.message,
          details: profileError?.details,
          hint: profileError?.hint
        })
        
        if (profileError?.code === 'PGRST116') {
          setError('존재하지 않는 아이디입니다')
        } else {
          setError(`오류: ${profileError?.message || '프로필을 찾을 수 없습니다'}`)
        }
        setIsSubmitting(false)
        return
      }

      // 2. 승인 여부 확인
      if (!profileData.is_approved) {
        setError('관리자 승인 대기 중입니다. 승인 후 로그인이 가능합니다.')
        setIsSubmitting(false)
        return
      }

      // 3. 멤버십 상태 확인 (대기/정지 상태면 로그인 불가)
      if (profileData.membership_status === 'pending' || profileData.membership_status === 'suspended') {
        setError('계정이 대기 상태입니다. 관리자에게 문의해주세요.')
        setIsSubmitting(false)
        return
      }

      // 4. 삭제된 계정 확인
      if (profileData.membership_status === 'deleted') {
        setError('삭제된 계정입니다. 관리자에게 문의해주세요.')
        setIsSubmitting(false)
        return
      }

      // 3. 이메일과 비밀번호로 로그인
      console.log('Auth 로그인 시도:', profileData.email)
      
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: profileData.email,
        password: formData.password,
      })

      console.log('Auth 로그인 결과:', { authData, authError })

      if (authError) {
        console.error('Auth 로그인 실패:', authError)
        
        if (authError.message.includes('Invalid')) {
          setError('아이디 또는 비밀번호가 올바르지 않습니다')
        } else {
          setError(`로그인 오류: ${authError.message}`)
        }
        setIsSubmitting(false)
        return
      }

      if (authData.user) {
        // 로그인 성공
        if (profileData.role === 'admin') {
          router.push('/admin/dashboard')
        } else {
          router.push('/dashboard')
        }
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError('로그인 중 오류가 발생했습니다')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-[#1e293b] shadow-md">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-3 w-fit">
            <Shield className="w-8 h-8 text-white" />
            <h1 className="text-2xl font-bold text-white">어메이징사업부</h1>
          </Link>
        </div>
      </header>

      {/* Login Form */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-3xl font-bold text-[#1e293b] text-center mb-8">
            로그인
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 아이디 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                아이디
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e293b]"
                placeholder="아이디를 입력하세요"
                required
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                비밀번호
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e293b]"
                placeholder="비밀번호를 입력하세요"
                autoComplete="current-password"
                required
              />
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#1e293b] text-white font-semibold rounded-lg hover:bg-[#334155] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  로그인 중...
                </>
              ) : (
                '로그인'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              계정이 없으신가요?{' '}
              <Link href="/signup" className="text-[#1e293b] font-semibold hover:underline">
                회원가입
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

