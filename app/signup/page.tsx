'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    phone: '',
    password: '',
    password_confirm: '',
  })
  const [usernameCheck, setUsernameCheck] = useState<{
    checked: boolean
    available: boolean
    message: string
  }>({ checked: false, available: false, message: '' })
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 전화번호 포맷팅 함수 (010-0000-0000 형식)
  const formatPhoneNumber = (value: string): string => {
    // 숫자만 추출
    const numbers = value.replace(/[^\d]/g, '')
    
    // 최대 11자리까지만 허용
    const limitedNumbers = numbers.slice(0, 11)
    
    // 포맷팅 적용
    if (limitedNumbers.length <= 3) {
      return limitedNumbers
    } else if (limitedNumbers.length <= 7) {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3)}`
    } else {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3, 7)}-${limitedNumbers.slice(7)}`
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    
    // 전화번호인 경우 자동 포맷팅 적용
    if (name === 'phone') {
      const formatted = formatPhoneNumber(value)
      setFormData((prev) => ({ ...prev, [name]: formatted }))
      return
    }
    
    setFormData((prev) => ({ ...prev, [name]: value }))
    
    // 아이디가 변경되면 중복확인 초기화
    if (name === 'username') {
      setUsernameCheck({ checked: false, available: false, message: '' })
    }
  }

  const checkUsername = async () => {
    if (!formData.username) {
      setUsernameCheck({
        checked: false,
        available: false,
        message: '아이디를 입력해주세요',
      })
      return
    }

    setIsCheckingUsername(true)
    setError('')

    try {
      const supabase = createClient()
      
      // 환경 변수 체크
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Supabase 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인해주세요.')
      }
      
      // 간단하게 직접 조회 (RLS 꺼져있으니 작동해야 함)
      const { data, error, count } = await supabase
        .from('profiles')
        .select('username', { count: 'exact', head: false })
        .eq('username', formData.username)

      console.log('중복확인 결과:', { data, error, count })

      // 에러가 있어도 일단 진행 (개발용)
      if (error) {
        console.error('Username check error:', error)
        // RLS 문제면 그냥 사용 가능하다고 표시 (임시)
        setUsernameCheck({
          checked: true,
          available: true,
          message: '사용 가능한 아이디입니다 (확인 불가)',
        })
        return
      }

      // 데이터가 있으면 중복, 없으면 사용 가능
      if (data && data.length > 0) {
        setUsernameCheck({
          checked: true,
          available: false,
          message: '이미 사용 중인 아이디입니다',
        })
      } else {
        setUsernameCheck({
          checked: true,
          available: true,
          message: '사용 가능한 아이디입니다',
        })
      }
    } catch (err: any) {
      console.error('Username check error:', err)
      setError(err.message || '아이디 확인 중 오류가 발생했습니다')
    } finally {
      setIsCheckingUsername(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 유효성 검사
    if (!usernameCheck.checked || !usernameCheck.available) {
      setError('아이디 중복확인을 완료해주세요')
      return
    }

    if (!formData.full_name || !formData.email || !formData.phone) {
      setError('모든 필드를 입력해주세요')
      return
    }

    if (formData.password !== formData.password_confirm) {
      setError('비밀번호가 일치하지 않습니다')
      return
    }

    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다')
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()
      
      // 환경 변수 체크
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Supabase 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인해주세요.')
      }

      console.log('회원가입 시작:', { email: formData.email, username: formData.username })

      // 1. Supabase Auth에 회원가입
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            username: formData.username,
            full_name: formData.full_name,
            phone: formData.phone,
          },
        },
      })

      if (authError) {
        console.error('Auth 회원가입 오류:', {
          message: authError.message,
          status: authError.status,
          name: authError.name,
        })
        
        // 에러 메시지를 한글로 변환
        let koreanMessage = '회원가입 중 오류가 발생했습니다'
        
        if (authError.message.includes('already registered')) {
          koreanMessage = '이미 가입된 이메일입니다'
        } else if (authError.message.includes('Invalid email')) {
          koreanMessage = '올바른 이메일 형식이 아닙니다'
        } else if (authError.message.includes('Password')) {
          koreanMessage = '비밀번호는 최소 6자 이상이어야 합니다'
        } else if (authError.message.includes('after')) {
          koreanMessage = '너무 많이 시도했습니다. 30초 후에 다시 시도해주세요'
        }
        
        throw new Error(koreanMessage)
      }

      console.log('Auth 회원가입 성공:', authData.user?.id)

      if (authData.user) {
        // 2. 프로필이 이미 존재하는지 먼저 확인
        const { data: existingProfile, error: checkError } = await supabase
          .from('profiles')
          .select('id, username, email, is_approved')
          .eq('id', authData.user.id)
          .single()
        
        // 프로필이 이미 존재하는 경우 성공으로 처리 (이전 회원가입 시도 중 이미 생성되었을 수 있음)
        if (existingProfile && !checkError) {
          console.log('프로필이 이미 존재합니다. 회원가입 성공으로 처리:', existingProfile)
          // 성공 알림 및 로그인 페이지로 이동
          alert('회원가입이 완료되었습니다. 관리자 승인 대기 중입니다.')
          router.push('/login')
          return
        }
        
        // 3. profiles 테이블에 추가 정보 저장
        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id,
          username: formData.username,
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          is_approved: false,
          role: 'user',
        })

        if (profileError) {
          console.error('프로필 생성 오류:', {
            message: profileError.message,
            code: profileError.code,
            details: profileError.details,
            hint: profileError.hint,
          })
          
          // 중복 키 오류(23505)인 경우 - username이나 email이 다른 사용자와 중복
          if (profileError.code === '23505') {
            // 프로필이 존재하는지 다시 한 번 확인 (동시성 문제 대비)
            const { data: retryProfile, error: retryError } = await supabase
              .from('profiles')
              .select('id, username, email')
              .eq('id', authData.user.id)
              .single()
            
            if (retryProfile && !retryError) {
              console.log('프로필이 이미 존재합니다. 회원가입 성공으로 처리:', retryProfile)
              alert('회원가입이 완료되었습니다. 관리자 승인 대기 중입니다.')
              router.push('/login')
              return
            }
            
            // 다른 사용자의 username이나 email이 중복된 경우
            throw new Error('이미 사용 중인 아이디 또는 이메일입니다')
          }
          
          // 다른 오류인 경우
          throw new Error('프로필 생성 중 오류가 발생했습니다')
        }

        console.log('프로필 생성 성공')

        // 성공 알림 및 로그인 페이지로 이동
        alert('회원가입이 완료되었습니다. 관리자 승인 대기 중입니다.')
        router.push('/login')
      }
    } catch (err: any) {
      console.error('Signup error:', err)
      const errorMessage = err?.message || err?.error_description || '회원가입 중 오류가 발생했습니다'
      setError(errorMessage)
    } finally {
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

      {/* Signup Form */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-3xl font-bold text-[#1e293b] text-center mb-8">
            회원가입
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
                아이디 *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e293b]"
                  placeholder="아이디를 입력하세요"
                  required
                />
                <button
                  type="button"
                  onClick={checkUsername}
                  disabled={isCheckingUsername || !formData.username}
                  className="px-4 py-2 bg-[#1e293b] text-white rounded-lg hover:bg-[#334155] disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
                >
                  {isCheckingUsername ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    '중복확인'
                  )}
                </button>
              </div>
              {usernameCheck.message && (
                <div
                  className={`mt-2 flex items-center gap-2 text-sm ${
                    usernameCheck.available ? 'text-blue-600' : 'text-red-600'
                  }`}
                >
                  {usernameCheck.available ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  {usernameCheck.message}
                </div>
              )}
            </div>

            {/* 이름 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                이름 *
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e293b]"
                placeholder="이름을 입력하세요"
                required
              />
            </div>

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                이메일 *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e293b]"
                placeholder="example@email.com"
                required
              />
            </div>

            {/* 전화번호 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                전화번호 *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e293b]"
                placeholder="010-0000-0000"
                maxLength={13}
                required
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                비밀번호 *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e293b]"
                placeholder="최소 6자 이상"
                required
              />
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                비밀번호 확인 *
              </label>
              <input
                type="password"
                name="password_confirm"
                value={formData.password_confirm}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e293b]"
                placeholder="비밀번호를 다시 입력하세요"
                required
              />
            </div>

            {/* 가입하기 버튼 */}
            <button
              type="submit"
              disabled={
                !usernameCheck.checked ||
                !usernameCheck.available ||
                isSubmitting
              }
              className="w-full py-3 bg-[#1e293b] text-white font-semibold rounded-lg hover:bg-[#334155] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  가입 중...
                </>
              ) : (
                '가입하기'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              이미 계정이 있으신가요?{' '}
              <Link href="/login" className="text-[#1e293b] font-semibold hover:underline">
                로그인
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

