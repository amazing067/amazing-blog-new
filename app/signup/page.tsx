'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { DEPARTMENTS } from '@/lib/constants/departments'

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    phone: '',
    password: '',
    password_confirm: '',
    department_id: '',
    department_name: '',
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
    const numbers = value.replace(/[^\d]/g, '')
    const limitedNumbers = numbers.slice(0, 11)
    
    if (limitedNumbers.length <= 3) {
      return limitedNumbers
    } else if (limitedNumbers.length <= 7) {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3)}`
    } else {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3, 7)}-${limitedNumbers.slice(7)}`
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    
    if (name === 'phone') {
      const formatted = formatPhoneNumber(value)
      setFormData((prev) => ({ ...prev, [name]: formatted }))
      return
    }
    
    if (name === 'department_id') {
      const selectedDept = DEPARTMENTS.find(d => d.id === value)
      setFormData((prev) => ({
        ...prev,
        department_id: value,
        department_name: selectedDept?.name || '',
      }))
      return
    }
    
    setFormData((prev) => ({ ...prev, [name]: value }))
    
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
      const response = await fetch('/api/signup/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.username })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '아이디 확인 중 오류가 발생했습니다')
      }

      setUsernameCheck({
        checked: true,
        available: result.available,
        message: result.message,
      })
    } catch (err: any) {
      console.error('아이디 중복확인 오류:', err)
      setError(err.message || '아이디 확인 중 오류가 발생했습니다')
      setUsernameCheck({
        checked: false,
        available: false,
        message: '',
      })
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

    if (!formData.full_name || !formData.phone) {
      setError('모든 필드를 입력해주세요')
      return
    }

    if (!formData.department_id || formData.department_id.trim() === '') {
      setError('본부를 선택해주세요')
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
      const requestBody = {
        username: formData.username.trim(),
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        department_id: formData.department_id.trim(),
        department_name: formData.department_name.trim(),
      }

      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      // 응답 본문 읽기
      const responseText = await response.text()
      console.log('[회원가입] 응답 원본:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        responseText: responseText.substring(0, 500)
      })
      
      let result: any = {}
      
      try {
        if (responseText) {
          result = JSON.parse(responseText)
        } else {
          result = { error: `서버 응답이 비어있습니다 (${response.status})` }
        }
      } catch (parseError: any) {
        console.error('[회원가입] JSON 파싱 실패:', parseError)
        // JSON 파싱 실패 시 텍스트를 에러로 처리
        throw new Error(`서버 응답을 읽을 수 없습니다: ${responseText.substring(0, 200)}`)
      }

      console.log('[회원가입] 파싱된 응답:', {
        hasError: !!result.error,
        hasSuccess: !!result.success,
        error: result.error,
        message: result.message,
        details: result.details,
        code: result.code,
        fullResult: result
      })

      // 에러 응답 처리
      if (!response.ok) {
        let errorMsg = result.error || result.message || `서버 오류 (${response.status})`
        
        // details가 있으면 더 구체적인 메시지 표시
        if (result.details) {
          if (result.details.includes('Database error')) {
            errorMsg = '데이터베이스 오류가 발생했습니다. 관리자에게 문의해주세요.'
          } else if (result.details.includes('email') || result.details.includes('Email')) {
            errorMsg = '이메일 관련 오류가 발생했습니다. 관리자에게 문의해주세요.'
          } else if (result.details.includes('constraint') || result.details.includes('NOT NULL')) {
            errorMsg = '필수 정보가 누락되었습니다. 관리자에게 문의해주세요.'
          }
        }
        
        console.error('[회원가입 실패] 상세:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMsg,
          details: result.details,
          code: result.code,
          hint: result.hint,
          fullResult: result
        })
        throw new Error(errorMsg)
      }

      // 성공 응답 확인
      if (!result.success) {
        const errorMsg = result.error || '회원가입에 실패했습니다'
        console.error('[회원가입 실패]', result)
        throw new Error(errorMsg)
      }

      // 성공
      alert(result.message || '회원가입이 완료되었습니다. 관리자 승인 대기 중입니다.')
      router.push('/login')
    } catch (err: any) {
      console.error('[회원가입 오류]', err)
      
      // 네트워크 오류
      if (err?.name === 'TypeError' && err?.message?.includes('fetch')) {
        setError('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.')
        return
      }
      
      // 일반 오류
      const errorMessage = err?.message || '회원가입 중 오류가 발생했습니다'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-[#1e293b] shadow-md">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-3 w-fit">
            <Shield className="w-8 h-8 text-white" />
            <h1 className="text-2xl font-bold text-white">어메이징사업부</h1>
          </Link>
        </div>
      </header>

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

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                본부 *
              </label>
              <select
                name="department_id"
                value={formData.department_id}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e293b]"
                required
              >
                <option value="">본부를 선택하세요 (필수)</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

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
                autoComplete="new-password"
                required
              />
            </div>

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
                autoComplete="new-password"
                required
              />
            </div>

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
