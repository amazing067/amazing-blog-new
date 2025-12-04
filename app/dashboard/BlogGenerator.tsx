'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, LogOut, Sparkles, Copy, Send, FileDown, Clock, BookOpen, TrendingUp, ArrowLeft, UserCheck, History, BarChart3, FileText, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { BlogPost } from '@/types/blog.types'

interface Profile {
  id: string
  username: string
  full_name: string
  email: string
  phone: string
  role?: string
}

const TEMPLATES = [
  { 
    id: 'medical', 
    name: '실손보험 청구 가이드', 
    icon: '🏥',
    keywords: '진료비영수증, 세부산정내역서, 보험금청구',
    tone: 'friendly'
  },
  { 
    id: 'driver', 
    name: '운전자보험 필수특약', 
    icon: '🚗',
    keywords: '벌금특약, 형사합의금, 변호사비용',
    tone: 'expert'
  },
  { 
    id: 'travel', 
    name: '해외여행자보험', 
    icon: '✈️',
    keywords: '의료비보장, 항공지연, 수하물보험',
    tone: 'friendly'
  },
  { 
    id: 'circulatory', 
    name: '순환계 질환 진단비', 
    icon: '🫀',
    keywords: '심근경색, 뇌졸중, 협심증',
    tone: 'expert'
  },
  { 
    id: 'dementia', 
    name: '치매간병보험', 
    icon: '🧠',
    keywords: '간병비, 치매진단, 인정등급',
    tone: 'friendly'
  },
]

export default function BlogGenerator({ profile }: { profile: Profile | null }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'write' | 'history' | 'stats'>('write')
  const [formData, setFormData] = useState({
    topic: '',
    keywords: '',
    product: 'auto',
    tone: 'friendly',
    template: '',
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedHTML, setGeneratedHTML] = useState('')
  const [progress, setProgress] = useState(0)
  const [sources, setSources] = useState<any[]>([])
  const [sourcesMarkdown, setSourcesMarkdown] = useState('')
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([])
  const [isLoadingPosts, setIsLoadingPosts] = useState(false)

  // 블로그 글 목록 불러오기
  useEffect(() => {
    if (activeTab === 'history' && profile?.id) {
      loadBlogPosts()
    }
  }, [activeTab, profile])

  const loadBlogPosts = async () => {
    if (!profile?.id) return
    
    setIsLoadingPosts(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setBlogPosts(data || [])
    } catch (error) {
      console.error('글 목록 로딩 오류:', error)
    } finally {
      setIsLoadingPosts(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleTemplateSelect = (template: typeof TEMPLATES[0]) => {
    setFormData({
      topic: template.name,
      keywords: template.keywords,
      product: 'auto',
      tone: template.tone,
      template: template.id,
    })
  }

  const handleGenerate = async () => {
    if (!formData.topic) {
      alert('주제를 입력해주세요!')
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setGeneratedHTML('')

    // 진행률 애니메이션
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 10
      })
    }, 300)

    try {
      // 실제 Gemini API 호출
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: formData.topic,
          keywords: formData.keywords,
          product: formData.product,
          tone: formData.tone,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'API 오류')
      }

      clearInterval(progressInterval)
      setProgress(100)
      setGeneratedHTML(data.html)
      setSources(data.sources || [])
      setSourcesMarkdown(data.sourcesMarkdown || '')
      
    } catch (error: any) {
      console.error('생성 오류:', error)
      alert('글 생성 중 오류가 발생했습니다: ' + error.message)
      
      // 오류 시 더미 HTML 표시 (개발용)
      const dummyHTML = `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${formData.topic} | 완벽 가이드</title>
<style>
:root {
  --primary: #3683f1;
  --navy: #25467a;
  --bg: #f7fafc;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
  line-height: 1.75;
  background: var(--bg);
  color: #1b2430;
  margin: 0;
  padding: 0;
}
header {
  background: linear-gradient(135deg, var(--primary), var(--navy));
  color: white;
  padding: 40px 24px;
  text-align: center;
}
h1 {
  font-size: 32px;
  margin: 0 0 16px;
  font-weight: 700;
}
.badges {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 16px;
}
.badges span {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.4);
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
}
main {
  max-width: 850px;
  margin: 0 auto;
  padding: 24px;
}
.card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 20px rgba(35, 96, 164, 0.08);
  padding: 24px;
  margin: 24px 0;
}
h2 {
  color: var(--navy);
  margin: 32px 0 16px;
  font-size: 26px;
  font-weight: 700;
  padding-bottom: 12px;
  border-bottom: 3px solid var(--primary);
}
.highlight {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  border: 2px solid #fbbf24;
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
}
</style>
</head>
<body>
<header>
  <h1>${formData.topic}</h1>
  <div class="badges">
    <span>✓ 2025 최신</span>
    <span>✓ 전문가 검증</span>
    <span>✓ 실전 팁</span>
    <span>✓ 무료 상담</span>
  </div>
</header>

<main>
  <div class="card">
    <p><strong>키워드:</strong> ${formData.keywords || '보험, 가이드'}</p>
    <p><strong>추천 상품:</strong> ${formData.product === 'auto' ? 'AI 자동 추천' : formData.product}</p>
    <p><strong>작성 톤:</strong> ${formData.tone === 'friendly' ? '친절한 상담사' : formData.tone === 'expert' ? '전문가' : '경각심'}</p>
  </div>

  <h2>📚 핵심 내용</h2>
  <div class="card">
    <p>이 글은 <strong>${formData.topic}</strong>에 대한 완벽한 가이드입니다.</p>
    <p>실제 보험 전문가의 노하우를 바탕으로 작성되었으며, 
    고객 상담 시 바로 활용할 수 있는 실전 정보를 담고 있습니다.</p>
  </div>

  <h2>💰 보험료 예시</h2>
  <div class="card">
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #f2f7ff;">
          <th style="padding: 12px; text-align: left;">나이</th>
          <th style="padding: 12px; text-align: left;">성별</th>
          <th style="padding: 12px; text-align: left;">월 보험료</th>
          <th style="padding: 12px; text-align: left;">보장 내용</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eef3f9;">40세</td>
          <td style="padding: 12px; border-bottom: 1px solid #eef3f9;">남</td>
          <td style="padding: 12px; border-bottom: 1px solid #eef3f9;">85,000원</td>
          <td style="padding: 12px; border-bottom: 1px solid #eef3f9;">기본형</td>
        </tr>
        <tr>
          <td style="padding: 12px;">50세</td>
          <td style="padding: 12px;">여</td>
          <td style="padding: 12px;">125,000원</td>
          <td style="padding: 12px;">프리미엄형</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="highlight">
    <strong>💡 전문가 추천</strong>
    <p style="margin-top: 12px;">
      ${formData.topic}에 대해 더 자세한 상담이 필요하시다면 
      전문 컨설턴트와 무료 상담을 받아보세요!
    </p>
  </div>

  <p style="text-align: center; margin-top: 40px; color: #999; font-size: 14px;">
    © 2025 어메이징사업부. All rights reserved.
  </p>
</main>
</body>
</html>`
      
      clearInterval(progressInterval)
      setProgress(100)
      setGeneratedHTML(dummyHTML)
    } finally {
      setIsGenerating(false)
      setProgress(0)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedHTML)
    alert('HTML이 클립보드에 복사되었습니다!')
  }

  const handlePublish = () => {
    alert('네이버 블로그 발행 기능은 곧 추가됩니다!')
  }

  const handleDownloadPDF = () => {
    alert('PDF 다운로드 기능은 곧 추가됩니다!')
  }

  const handleDownloadSources = async () => {
    if (sources.length === 0) {
      alert('출처 정보가 없습니다')
      return
    }

    try {
      // 동적 import (클라이언트 사이드에서만)
      const { downloadSourcesPDF } = await import('@/lib/generate-sources-pdf')
      
      downloadSourcesPDF(sources, formData.topic || '보험 블로그')
      
      alert('✅ 출처 PDF가 다운로드되었습니다!')
    } catch (error) {
      console.error('PDF 생성 오류:', error)
      
      // 폴백: Markdown 다운로드
      const blob = new Blob([sourcesMarkdown], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `출처_${formData.topic.slice(0, 20)}_${new Date().toISOString().split('T')[0]}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      alert('✅ 출처 Markdown이 다운로드되었습니다!')
    }
  }

  const handleSave = async () => {
    if (!generatedHTML || !profile?.id) {
      alert('저장할 콘텐츠가 없습니다')
      return
    }

    try {
      const supabase = createClient()
      
      // 제목 추출 (HTML에서)
      const titleMatch = generatedHTML.match(/<title>(.*?)<\/title>/)
      const title = titleMatch ? titleMatch[1] : formData.topic

      // 텍스트 추출 (대략적)
      const plainText = generatedHTML.replace(/<[^>]*>/g, '').slice(0, 500)
      const wordCount = plainText.length

      const { error } = await supabase.from('blog_posts').insert({
        user_id: profile.id,
        topic: formData.topic,
        keywords: formData.keywords,
        product: formData.product,
        tone: formData.tone,
        template: formData.template,
        html_content: generatedHTML,
        plain_text: plainText,
        title: title,
        word_count: wordCount,
        status: 'draft',
      })

      if (error) throw error

      alert('✅ 글이 저장되었습니다!')
      // 히스토리 탭으로 이동
      setActiveTab('history')
      loadBlogPosts()
    } catch (error: any) {
      console.error('저장 오류:', error)
      alert('저장 중 오류가 발생했습니다: ' + error.message)
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm('이 글을 삭제하시겠습니까?')) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', postId)

      if (error) throw error

      alert('✅ 삭제되었습니다')
      loadBlogPosts()
    } catch (error: any) {
      console.error('삭제 오류:', error)
      alert('삭제 중 오류가 발생했습니다: ' + error.message)
    }
  }

  const handleViewPost = (post: BlogPost) => {
    setGeneratedHTML(post.html_content)
    setFormData({
      topic: post.topic,
      keywords: post.keywords || '',
      product: post.product || 'auto',
      tone: post.tone || 'friendly',
      template: post.template || '',
    })
    setActiveTab('write')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1e293b] via-[#334155] to-[#1e293b] shadow-xl">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {profile?.role === 'admin' && (
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-lg hover:bg-white/20 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                대시보드
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-2 rounded-xl shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">보험 블로그 AI 생성기</h1>
                <p className="text-xs text-gray-300">{profile?.full_name}님 환영합니다</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile?.role === 'admin' && (
              <button
                onClick={() => router.push('/admin/users')}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
              >
                <UserCheck className="w-4 h-4" />
                회원관리
              </button>
            )}
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-lg hover:bg-white/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* 탭 네비게이션 */}
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-white rounded-xl shadow-lg p-2 flex gap-2">
            <button
              onClick={() => setActiveTab('write')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'write'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Sparkles className="w-5 h-5" />
              ✨ 새 글 쓰기
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <History className="w-5 h-5" />
              📚 내 글 목록
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'stats'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              📊 통계
            </button>
          </div>
        </div>

        {/* 탭 콘텐츠 */}
        {activeTab === 'write' && (
        <div className="grid lg:grid-cols-5 gap-6 h-[calc(100vh-200px)]">
          
          {/* 왼쪽 패널 - 입력 폼 (40%) */}
          <div className="lg:col-span-2 space-y-4 overflow-y-auto">
            
            {/* 템플릿 선택 */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-[#1e293b] mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
                템플릿 선택
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.template === template.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow'
                    }`}
                  >
                    <div className="text-3xl mb-2">{template.icon}</div>
                    <div className="text-xs font-semibold text-gray-700">{template.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 입력 폼 */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-[#1e293b] mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                글 생성 조건
              </h3>

              <div className="space-y-4">
                {/* 주제 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    주제 (Topic) *
                  </label>
                  <input
                    type="text"
                    name="topic"
                    value={formData.topic}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="예: 40세 뇌혈관 진단비 비교"
                  />
                </div>

                {/* 키워드 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    핵심 키워드
                  </label>
                  <input
                    type="text"
                    name="keywords"
                    value={formData.keywords}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="예: 비갱신형, 100세만기, 무해지환급형"
                  />
                </div>

                {/* 상품 선택 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    강조할 상품
                  </label>
                  <select
                    name="product"
                    value={formData.product}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="auto">자동 추천 (AI)</option>
                    <option value="a">A사 (가성비)</option>
                    <option value="b">B사 (보장중심)</option>
                    <option value="c">C사 (수술비특화)</option>
                  </select>
                </div>

                {/* 톤 선택 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    글의 톤
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                      <input
                        type="radio"
                        name="tone"
                        value="friendly"
                        checked={formData.tone === 'friendly'}
                        onChange={handleChange}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">😊 친절한 상담사 톤</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                      <input
                        type="radio"
                        name="tone"
                        value="expert"
                        checked={formData.tone === 'expert'}
                        onChange={handleChange}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">👨‍💼 냉철한 전문가 톤</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                      <input
                        type="radio"
                        name="tone"
                        value="warning"
                        checked={formData.tone === 'warning'}
                        onChange={handleChange}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">⚠️ 경각심 주는 톤</span>
                    </label>
                  </div>
                </div>

                {/* 생성 버튼 */}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !formData.topic}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
                >
                  {isGenerating ? (
                    <>
                      <Clock className="w-5 h-5 animate-spin" />
                      AI가 원고를 작성 중입니다... ({progress}%)
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      ✨ AI 글쓰기 시작
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 통계 카드 */}
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
              <h3 className="text-sm font-semibold mb-4 opacity-90">이번 달 통계</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-3xl font-bold">24</div>
                  <div className="text-xs opacity-80">생성한 글</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">18</div>
                  <div className="text-xs opacity-80">발행 완료</div>
                </div>
              </div>
            </div>
          </div>

          {/* 오른쪽 패널 - 결과 미리보기 (60%) */}
          <div className="lg:col-span-3 bg-white rounded-xl shadow-lg overflow-hidden flex flex-col">
            {/* 액션 버튼 바 */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">결과 미리보기</h3>
              {generatedHTML && (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                  >
                    <Save className="w-4 h-4" />
                    저장
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
                  >
                    <Copy className="w-4 h-4" />
                    복사
                  </button>
                  <button
                    onClick={handlePublish}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <Send className="w-4 h-4" />
                    발행
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    <FileDown className="w-4 h-4" />
                    PDF
                  </button>
                  {sources.length > 0 && (
                    <button
                      onClick={handleDownloadSources}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm"
                      title="사용된 출처 목록 다운로드"
                    >
                      <FileText className="w-4 h-4" />
                      출처
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 미리보기 영역 */}
            <div className="flex-1 overflow-y-auto p-6">
              {!generatedHTML ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="text-8xl mb-6">📝</div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">
                    AI 블로그 글 생성 준비 완료!
                  </h3>
                  <p className="text-gray-500 mb-6">
                    왼쪽에서 주제를 입력하고<br />
                    [✨ AI 글쓰기 시작] 버튼을 눌러주세요
                  </p>
                  <div className="flex gap-2 text-sm text-gray-400">
                    <span>⚡ 평균 30초</span>
                    <span>•</span>
                    <span>📊 SEO 최적화</span>
                    <span>•</span>
                    <span>🎨 반응형 디자인</span>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4">
                  <iframe
                    srcDoc={generatedHTML}
                    className="w-full h-full min-h-[600px] border-0 rounded-lg bg-white"
                    title="미리보기"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* 히스토리 탭 */}
        {activeTab === 'history' && (
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                  <History className="w-7 h-7 text-blue-600" />
                  내가 작성한 글
                </h2>
                <button
                  onClick={loadBlogPosts}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  🔄 새로고침
                </button>
              </div>

              {isLoadingPosts ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-gray-500">로딩 중...</p>
                </div>
              ) : blogPosts.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {blogPosts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl p-6 hover:shadow-xl transition-all hover:scale-[1.02]"
                    >
                      {/* 아이콘 */}
                      <div className="text-4xl mb-3">
                        {TEMPLATES.find((t) => t.id === post.template)?.icon || '📝'}
                      </div>

                      {/* 제목 */}
                      <h3 className="text-lg font-bold text-gray-800 mb-2 line-clamp-2">
                        {post.title || post.topic}
                      </h3>

                      {/* 메타 정보 */}
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                        <span>{new Date(post.created_at).toLocaleDateString('ko-KR')}</span>
                        <span>•</span>
                        <span>{post.word_count || 0}자</span>
                        {post.status === 'published' && (
                          <>
                            <span>•</span>
                            <span className="text-green-600 font-semibold">발행됨</span>
                          </>
                        )}
                      </div>

                      {/* 미리보기 텍스트 */}
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {post.plain_text || '내용 없음'}
                      </p>

                      {/* 액션 버튼 */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewPost(post)}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-semibold"
                        >
                          👁️ 보기
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors text-xs font-semibold"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="text-8xl mb-4">📝</div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">
                    아직 작성한 글이 없습니다
                  </h3>
                  <p className="text-gray-500 mb-6">
                    [✨ 새 글 쓰기] 탭에서 첫 번째 블로그를 만들어보세요!
                  </p>
                  <button
                    onClick={() => setActiveTab('write')}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
                  >
                    글쓰기 시작하기 →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 통계 탭 */}
        {activeTab === 'stats' && (
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-8 flex items-center gap-3">
                <BarChart3 className="w-7 h-7 text-blue-600" />
                통계 대시보드
              </h2>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
                  <div className="text-5xl font-bold mb-2">{blogPosts.length}</div>
                  <div className="text-blue-100">전체 작성 글</div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
                  <div className="text-5xl font-bold mb-2">
                    {blogPosts.filter((p) => p.status === 'published').length}
                  </div>
                  <div className="text-green-100">발행 완료</div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-6 text-white shadow-lg">
                  <div className="text-5xl font-bold mb-2">
                    {blogPosts.filter((p) => p.status === 'draft').length}
                  </div>
                  <div className="text-purple-100">작성 중</div>
                </div>
              </div>

              <div className="mt-8 bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">최근 활동</h3>
                {blogPosts.slice(0, 5).map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between py-3 border-b border-gray-200 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-800">{post.title || post.topic}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(post.created_at).toLocaleDateString('ko-KR')}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewPost(post)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
                    >
                      보기 →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

