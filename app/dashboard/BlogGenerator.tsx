'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, LogOut, Sparkles, Copy, Send, FileDown, Clock, BookOpen, TrendingUp, ArrowLeft, UserCheck, History, BarChart3, FileText, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { BlogPost } from '@/types/blog.types'
import { TEMPLATE_TOPICS } from '@/lib/template-topics'
import { addWarningToHTML } from '@/lib/insurance-warnings'

// CSS 선택자 충돌 방지를 위한 유틸리티 함수
const scopeHTMLForEditor = (html: string) => {
  if (!html) return ''
  
  // 1. main 태그 스타일을 .blog-content로 변경
  let scoped = html.replace(/main\s*{/g, '.blog-content {')
  scoped = scoped.replace(/<main>/g, '<div class="blog-content">')
  scoped = scoped.replace(/<\/main>/g, '</div>')
  
  // 2. body 태그 스타일을 .blog-body로 변경 (배경색 유출 방지)
  scoped = scoped.replace(/body\s*{/g, '.blog-body {')
  scoped = scoped.replace(/<body>/g, '<div class="blog-body">')
  scoped = scoped.replace(/<\/body>/g, '</div>')
  
  // 3. header 태그 스타일을 .blog-header로 변경 (헤더 유출 방지)
  scoped = scoped.replace(/header\s*{/g, '.blog-header {')
  scoped = scoped.replace(/<header>/g, '<div class="blog-header">')
  scoped = scoped.replace(/<\/header>/g, '</div>')
  
  return scoped
}

// 저장할 때는 다시 원래대로 복구하는 함수 (선택 사항)
const unscopeHTMLForSave = (html: string) => {
  if (!html) return ''
  let unscoped = html.replace(/\.blog-content\s*{/g, 'main {')
  unscoped = unscoped.replace(/<div class="blog-content">/g, '<main>')
  unscoped = unscoped.replace(/<\/div>/g, '</main>')
  return unscoped
}

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
    name: '실손보험', 
    icon: '🏥',
    keywords: '진료비영수증, 세부산정내역서, 보험금청구',
    tone: 'friendly'
  },
  { 
    id: 'driver', 
    name: '운전자보험', 
    icon: '🚗',
    keywords: '벌금특약, 형사합의금, 변호사비용',
    tone: 'expert'
  },
  { 
    id: 'travel', 
    name: '여행자보험', 
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
  { 
    id: 'cancer', 
    name: '암보험', 
    icon: '🎗️',
    keywords: '암진단비, 암수술비, 암입원비',
    tone: 'expert'
  },
  { 
    id: 'injury', 
    name: '상해보험 비교', 
    icon: '🩹',
    keywords: '상해사망, 상해입원, 상해수술',
    tone: 'friendly'
  },
  { 
    id: 'wholelife', 
    name: '종신보험 추천', 
    icon: '💎',
    keywords: '종신보험, 사망보험금, 해지환급금',
    tone: 'expert'
  },
  { 
    id: 'pension', 
    name: '연금보험 비교', 
    icon: '💰',
    keywords: '연금보험, 노후준비, 확정연금',
    tone: 'friendly'
  },
  { 
    id: 'child', 
    name: '자녀보험 가입', 
    icon: '👶',
    keywords: '어린이보험, 교육보험, 자녀보장',
    tone: 'friendly'
  },
  { 
    id: 'disease', 
    name: '질병보험 비교', 
    icon: '🩺',
    keywords: '질병진단비, 질병입원, 질병수술',
    tone: 'expert'
  },
  { 
    id: 'hospital', 
    name: '입원보험', 
    icon: '🏨',
    keywords: '입원일당, 입원보험금, 입원특약',
    tone: 'friendly'
  },
  { 
    id: 'surgery', 
    name: '수술보험 비교', 
    icon: '⚕️',
    keywords: '수술비보험, 수술특약, 수술보험금',
    tone: 'expert'
  },
  { 
    id: 'critical', 
    name: '중대질병보험', 
    icon: '⚠️',
    keywords: '중대질병, 3대질병, 뇌혈관질환',
    tone: 'expert'
  },
  { 
    id: 'products', 
    name: '보험상품', 
    icon: '📦',
    keywords: '인기보험, 신상품, 추천보험',
    tone: 'friendly'
  },
  { 
    id: 'longterm', 
    name: '장기요양보험', 
    icon: '🛏️',
    keywords: '장기요양, 요양시설, 요양급여',
    tone: 'friendly'
  },
]

export default function BlogGenerator({ profile }: { profile: Profile | null }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'write' | 'history' | 'stats' | 'approval'>('write')
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
  const [isEditMode, setIsEditMode] = useState(false)
  const [editableHTML, setEditableHTML] = useState('')

  // 블로그 글 목록 불러오기
  useEffect(() => {
    if ((activeTab === 'history' || activeTab === 'write' || activeTab === 'stats') && profile?.id) {
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
    setFormData((prev) => {
      const updated = { ...prev, [name]: value }
      
      // 주제가 변경되면 키워드도 자동으로 업데이트
      if (name === 'topic' && value && prev.template) {
        const generatedKeywords = generateKeywordsFromTopic(value, prev.template)
        updated.keywords = generatedKeywords
      }
      
      return updated
    })
  }

  // 주제에 맞게 키워드 자동 생성
  const generateKeywordsFromTopic = (topic: string, templateId: string): string => {
    const keywords: string[] = []
    
    // 주제에서 핵심 단어 추출
    const topicLower = topic.toLowerCase()
    
    // 보험 종류별 기본 키워드
    if (topicLower.includes('실손보험') || topicLower.includes('실손')) {
      keywords.push('실손보험', '진료비영수증', '세부산정내역서', '보험금청구', '자기부담금')
    } else if (topicLower.includes('암보험') || topicLower.includes('암')) {
      keywords.push('암보험', '암진단비', '암수술비', '암입원비', '암치료비')
    } else if (topicLower.includes('운전자보험') || topicLower.includes('운전자')) {
      keywords.push('운전자보험', '벌금특약', '형사합의금', '변호사비용', '사고처리')
    } else if (topicLower.includes('여행자보험') || topicLower.includes('해외여행') || topicLower.includes('여행')) {
      keywords.push('여행자보험', '의료비보장', '항공지연', '수하물보험', '해외여행')
    } else if (topicLower.includes('순환계') || topicLower.includes('심근경색') || topicLower.includes('뇌졸중') || topicLower.includes('협심증')) {
      keywords.push('순환계질환', '심근경색', '뇌졸중', '협심증', '진단비')
    } else if (topicLower.includes('치매') || topicLower.includes('간병')) {
      keywords.push('치매간병보험', '간병비', '치매진단', '인정등급', '요양')
    } else if (topicLower.includes('상해보험') || topicLower.includes('상해')) {
      keywords.push('상해보험', '상해사망', '상해입원', '상해수술', '재해')
    } else if (topicLower.includes('종신보험') || topicLower.includes('종신')) {
      keywords.push('종신보험', '사망보험금', '해지환급금', '종신보장', '사망보장')
    } else if (topicLower.includes('연금보험') || topicLower.includes('연금')) {
      keywords.push('연금보험', '노후준비', '확정연금', '연금수령', '연금저축')
    } else if (topicLower.includes('자녀보험') || topicLower.includes('어린이보험') || topicLower.includes('자녀') || topicLower.includes('어린이')) {
      keywords.push('자녀보험', '어린이보험', '교육보험', '자녀보장', '아동보험')
    } else if (topicLower.includes('질병보험') || topicLower.includes('질병')) {
      keywords.push('질병보험', '질병진단비', '질병입원', '질병수술', '질병보장')
    } else if (topicLower.includes('입원보험') || topicLower.includes('입원')) {
      keywords.push('입원보험', '입원일당', '입원보험금', '입원특약', '입원보장')
    } else if (topicLower.includes('수술보험') || topicLower.includes('수술')) {
      keywords.push('수술보험', '수술비보험', '수술특약', '수술보험금', '수술보장')
    } else if (topicLower.includes('중대질병') || topicLower.includes('3대질병')) {
      keywords.push('중대질병보험', '3대질병', '뇌혈관질환', '중대질병보장', '중대질병진단비')
    } else if (topicLower.includes('장기요양') || topicLower.includes('요양')) {
      keywords.push('장기요양보험', '요양시설', '요양급여', '장기요양', '요양보장')
    } else if (topicLower.includes('펫보험') || topicLower.includes('반려동물') || topicLower.includes('펫')) {
      keywords.push('펫보험', '반려동물보험', '동물병원', '펫수술비', '반려동물치료')
    } else if (topicLower.includes('고당대통') || topicLower.includes('고당대통보험')) {
      keywords.push('고당대통보험', '고당대통', '건강보험', '보장내용', '보험료')
    } else if (topicLower.includes('화재보험') || topicLower.includes('화재')) {
      keywords.push('화재보험', '화재사고', '화재보장', '재산보험', '화재보험금')
    } else if (topicLower.includes('주택보험') || topicLower.includes('주택')) {
      keywords.push('주택보험', '주택화재', '주택보장', '재산보험', '주택보험금')
    } else if (topicLower.includes('자동차보험') || topicLower.includes('자동차')) {
      keywords.push('자동차보험', '자동차사고', '자동차보장', '자동차보험료', '자동차특약')
    } else if (topicLower.includes('건강보험') || topicLower.includes('건강')) {
      keywords.push('건강보험', '건강보장', '건강보험료', '건강진단', '건강관리')
    } else if (topicLower.includes('정기보험') || topicLower.includes('정기')) {
      keywords.push('정기보험', '정기보장', '정기보험료', '사망보장', '정기보험금')
    }
    
    // 주제에서 추가 키워드 추출
    if (topicLower.includes('가입')) keywords.push('가입조건', '가입절차')
    if (topicLower.includes('보험료')) keywords.push('보험료비교', '보험료계산', '보험료인상')
    if (topicLower.includes('보장')) keywords.push('보장범위', '보장내용', '보장한도')
    if (topicLower.includes('청구')) keywords.push('청구절차', '청구서류', '청구방법')
    if (topicLower.includes('해지')) keywords.push('해지환급금', '해지절차')
    if (topicLower.includes('특약')) keywords.push('특약추가', '특약종류')
    if (topicLower.includes('비교')) keywords.push('보험사비교', '상품비교')
    if (topicLower.includes('추천')) keywords.push('추천상품', '추천보험')
    if (topicLower.includes('순위')) keywords.push('보험사순위', '상품순위')
    if (topicLower.includes('신규') || topicLower.includes('신상품')) keywords.push('신규상품', '신상품')
    if (topicLower.includes('트렌드') || topicLower.includes('유행')) keywords.push('보험트렌드', '인기상품')
    
    // 중복 제거 및 최대 5개로 제한
    const uniqueKeywords = Array.from(new Set(keywords)).slice(0, 5)
    
    // 키워드가 없으면 템플릿 기본 키워드 사용
    const defaultTemplate = TEMPLATES.find(t => t.id === templateId)
    return uniqueKeywords.length > 0 ? uniqueKeywords.join(', ') : (defaultTemplate?.keywords || '보험, 보험료, 보장')
  }

  const handleTemplateSelect = (template: typeof TEMPLATES[0]) => {
    // 인기 검색어 중 랜덤하게 하나 선택
    const popularTopics = TEMPLATE_TOPICS[template.id] || []
    const randomTopic = popularTopics.length > 0
      ? popularTopics[Math.floor(Math.random() * popularTopics.length)]
      : template.name
    
    // 주제에 맞게 키워드 자동 생성
    const generatedKeywords = generateKeywordsFromTopic(randomTopic, template.id)
    
    setFormData({
      topic: randomTopic, // 랜덤 주제 자동 입력
      keywords: generatedKeywords, // 주제에 맞게 자동 생성된 키워드
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
      
      // 심의필 이미지 가져오기
      let finalHTML = data.html
      
      // SVG 그래프의 텍스트가 뒤에 숨지 않도록 z-index 추가
      finalHTML = finalHTML.replace(/<svg/g, '<svg style="position: relative; z-index: 1;"')
      finalHTML = finalHTML.replace(/<text/g, '<text style="position: relative; z-index: 10;"')
      
      // 업무광고심의 참고자료에 따른 경고 문구 자동 추가
      finalHTML = addWarningToHTML(finalHTML, formData.topic, formData.keywords, formData.template || '')
      
      // 심의필 이미지 자동 추가 (localStorage에서 가져오기)
      if (typeof window !== 'undefined') {
        const approvalImage = localStorage.getItem('approval_certificate_image')
        if (approvalImage) {
          // HTML 하단에 심의필 이미지 추가
          const approvalSection = `
<div style="margin-top: 60px; padding-top: 40px; border-top: 2px solid #e5e7eb; text-align: center;">
  <img src="${approvalImage}" alt="심의필" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);" />
</div>`
          
          // </body> 태그 앞에 추가 (가장 마지막에)
          if (finalHTML.includes('</body>')) {
            finalHTML = finalHTML.replace('</body>', approvalSection + '\n</body>')
          } else if (finalHTML.includes('</html>')) {
            finalHTML = finalHTML.replace('</html>', approvalSection + '\n</html>')
          } else {
            // </body>나 </html>이 없으면 마지막에 추가
            finalHTML += approvalSection
          }
        }
      }
      
      // 편집 가능한 HTML로 설정 (심의필 이미지 포함된 최종 HTML)
      setEditableHTML(finalHTML)
      setGeneratedHTML(finalHTML)
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
/* body 대신 클래스 사용 권장 (위 함수가 변환해주지만 명시적으로 작성) */
.blog-body {
  font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
  line-height: 1.75;
  background: var(--bg);
  color: #1b2430;
  margin: 0;
  padding: 0;
}
.blog-header {
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
.blog-content {
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
<div class="blog-body">
<div class="blog-header">
  <h1>${formData.topic}</h1>
  <div class="badges">
    <span>✓ 2025 최신</span>
    <span>✓ 전문가 검증</span>
    <span>✓ 실전 팁</span>
    <span>✓ 무료 상담</span>
  </div>
</div>

<div class="blog-content">
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
</div>
</div>
</html>`
      
      clearInterval(progressInterval)
      setProgress(100)
      // 스코핑 적용하여 편집용 HTML 설정
      const scopedDummyHTML = scopeHTMLForEditor(dummyHTML)
      setEditableHTML(scopedDummyHTML)
      setGeneratedHTML(dummyHTML) // 원본은 generatedHTML에 유지
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
    // SVG 그래프의 텍스트가 뒤에 숨지 않도록 z-index 추가
    let htmlContent = post.html_content || ''
    htmlContent = htmlContent.replace(/<svg/g, '<svg style="position: relative; z-index: 1;"')
    htmlContent = htmlContent.replace(/<text/g, '<text style="position: relative; z-index: 10;"')
    
    // 업무광고심의 참고자료에 따른 경고 문구 자동 추가 (없는 경우에만)
    if (!htmlContent.includes('⚠️') && !htmlContent.includes('운전자보험 안내') && !htmlContent.includes('안내')) {
      htmlContent = addWarningToHTML(htmlContent, post.topic || '', post.keywords || '', post.template || '')
    }
    
    // 원본 저장
    setGeneratedHTML(htmlContent)
    
    // 편집용으로는 스코핑 된 HTML 설정 (레이아웃 깨짐 방지 핵심)
    setEditableHTML(scopeHTMLForEditor(htmlContent))
    setIsEditMode(false) // 편집 모드 초기화
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
      {/* 편집 모드일 때 앱 헤더 보호 스타일 */}
      {isEditMode && (
        <style dangerouslySetInnerHTML={{
          __html: `
            /* 앱 헤더의 h1 보호 - 모든 전역 스타일 오버라이드 */
            header.bg-gradient-to-r h1,
            header h1.text-xl,
            header > div > div > div > h1 {
              font-size: 1.25rem !important;
              margin: 0 !important;
              margin-top: 0 !important;
              margin-bottom: 0 !important;
              padding: 0 !important;
              font-weight: 700 !important;
              line-height: 1.5 !important;
              color: white !important;
              text-align: left !important;
            }
            /* 헤더 컨테이너도 보호 */
            header.bg-gradient-to-r {
              padding-top: 1rem !important;
              padding-bottom: 1rem !important;
            }
          `
        }} />
      )}
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
                <h1 
                  className="text-xl font-bold text-white"
                  style={isEditMode ? {
                    fontSize: '1.25rem',
                    margin: '0',
                    marginTop: '0',
                    marginBottom: '0',
                    padding: '0',
                    fontWeight: '700',
                    lineHeight: '1.5',
                    color: 'white'
                  } : undefined}
                >
                  보험 블로그 AI 생성기
                </h1>
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
            <button
              onClick={() => setActiveTab('approval')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'approval'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-5 h-5" />
              📋 심의필 만들기
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
              <div className="grid grid-cols-4 gap-3">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className={`p-3 rounded-lg border-2 transition-all min-h-[100px] flex flex-col items-center justify-center ${
                      formData.template === template.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow'
                    }`}
                  >
                    <div className="text-3xl mb-2 flex-shrink-0">{template.icon}</div>
                    <div className="text-xs font-semibold text-gray-700 text-center leading-tight break-words px-1">{template.name}</div>
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
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-2xl font-bold">{blogPosts.length}</div>
                  <div className="text-xs opacity-80">전체 작성글</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{blogPosts.filter((p) => p.status === 'published').length}</div>
                  <div className="text-xs opacity-80">발행 완료</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{blogPosts.filter((p) => p.status === 'draft').length}</div>
                  <div className="text-xs opacity-80">작성 중</div>
                </div>
              </div>
            </div>
          </div>

          {/* 오른쪽 패널 - 결과 미리보기 (60%) */}
          <div className="lg:col-span-3 bg-white rounded-xl shadow-lg overflow-hidden flex flex-col h-full">
            {/* 액션 버튼 바 */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b flex justify-between items-center flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-800">결과 미리보기</h3>
              {generatedHTML && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-semibold ${
                      isEditMode 
                        ? 'bg-purple-600 text-white hover:bg-purple-700' 
                        : 'bg-purple-500 text-white hover:bg-purple-600'
                    }`}
                  >
                    ✏️ {isEditMode ? '편집 완료' : '편집 모드'}
                  </button>
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
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {!generatedHTML ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
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
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                  {isEditMode ? (
                    <div className="flex-1 overflow-hidden min-h-0 p-4 flex flex-col">
                      {/* 편집 도구 바 */}
                      <div className="bg-white rounded-lg p-1.5 border-2 border-purple-300 shadow-md mb-1.5" style={{ flexShrink: 0 }}>
                        <div className="space-y-1">
                          {/* 첫 번째 줄: 텍스트 스타일 + 글씨 크기 */}
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <button
                              onClick={() => document.execCommand('bold', false)}
                              className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-800 font-bold"
                              title="굵게"
                            >
                              <strong>B</strong>
                            </button>
                            <button
                              onClick={() => document.execCommand('italic', false)}
                              className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-800 italic"
                              title="기울임"
                            >
                              <em>I</em>
                            </button>
                            <button
                              onClick={() => document.execCommand('underline', false)}
                              className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-800 underline"
                              title="밑줄"
                            >
                              <u>U</u>
                            </button>
                            <button
                              onClick={() => document.execCommand('strikeThrough', false)}
                              className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-800 line-through"
                              title="취소선"
                            >
                              <s>S</s>
                            </button>
                            <div className="w-px h-4 bg-gray-300 mx-0.5"></div>
                            <button
                              onClick={() => document.execCommand('fontSize', false, '1')}
                              className="px-1.5 py-1 bg-gray-100 text-gray-700 rounded text-[10px] hover:bg-gray-200"
                              title="작게"
                            >
                              작게
                            </button>
                            <button
                              onClick={() => document.execCommand('fontSize', false, '3')}
                              className="px-1.5 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                              title="보통"
                            >
                              보통
                            </button>
                            <button
                              onClick={() => document.execCommand('fontSize', false, '5')}
                              className="px-1.5 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                              title="크게"
                            >
                              크게
                            </button>
                            <button
                              onClick={() => document.execCommand('fontSize', false, '7')}
                              className="px-1.5 py-1 bg-gray-100 text-gray-700 rounded text-base hover:bg-gray-200"
                              title="아주 크게"
                            >
                              아주크게
                            </button>
                          </div>
                          
                          {/* 두 번째 줄: 정렬 + 색상 */}
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <button
                              onClick={() => document.execCommand('justifyLeft', false)}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                              title="왼쪽 정렬"
                            >
                              ⬅
                            </button>
                            <button
                              onClick={() => document.execCommand('justifyCenter', false)}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                              title="가운데 정렬"
                            >
                              ⬌
                            </button>
                            <button
                              onClick={() => document.execCommand('justifyRight', false)}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                              title="오른쪽 정렬"
                            >
                              ➡
                            </button>
                            <button
                              onClick={() => document.execCommand('justifyFull', false)}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                              title="양쪽 정렬"
                            >
                              ⬌⬌
                            </button>
                            <div className="w-px h-4 bg-gray-300 mx-0.5"></div>
                            <button
                              onClick={() => document.execCommand('foreColor', false, '#2563eb')}
                              className="w-6 h-6 bg-blue-500 rounded hover:bg-blue-600 border border-blue-600"
                              title="파란색"
                            ></button>
                            <button
                              onClick={() => document.execCommand('foreColor', false, '#dc2626')}
                              className="w-6 h-6 bg-red-500 rounded hover:bg-red-600 border border-red-600"
                              title="빨간색"
                            ></button>
                            <button
                              onClick={() => document.execCommand('foreColor', false, '#16a34a')}
                              className="w-6 h-6 bg-green-500 rounded hover:bg-green-600 border border-green-600"
                              title="초록색"
                            ></button>
                            <button
                              onClick={() => document.execCommand('foreColor', false, '#ca8a04')}
                              className="w-6 h-6 bg-yellow-500 rounded hover:bg-yellow-600 border border-yellow-600"
                              title="노란색"
                            ></button>
                            <button
                              onClick={() => document.execCommand('foreColor', false, '#7c3aed')}
                              className="w-6 h-6 bg-purple-500 rounded hover:bg-purple-600 border border-purple-600"
                              title="보라색"
                            ></button>
                            <button
                              onClick={() => document.execCommand('foreColor', false, '#000000')}
                              className="w-6 h-6 bg-gray-900 rounded hover:bg-black border border-gray-700"
                              title="검은색"
                            ></button>
                            <button
                              onClick={() => document.execCommand('foreColor', false, '#ffffff')}
                              className="w-6 h-6 bg-white rounded hover:bg-gray-100 border-2 border-gray-400"
                              title="흰색"
                            ></button>
                          </div>
                          
                          {/* 세 번째 줄: 배경색 + 기타 */}
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className="text-[10px] text-gray-600 mr-1">배경:</span>
                            <button
                              onClick={() => document.execCommand('backColor', false, '#fef3c7')}
                              className="w-5 h-5 bg-yellow-100 rounded border border-yellow-300 hover:border-yellow-500"
                              title="노란 배경"
                            ></button>
                            <button
                              onClick={() => document.execCommand('backColor', false, '#dbeafe')}
                              className="w-5 h-5 bg-blue-100 rounded border border-blue-300 hover:border-blue-500"
                              title="파란 배경"
                            ></button>
                            <button
                              onClick={() => document.execCommand('backColor', false, '#fce7f3')}
                              className="w-5 h-5 bg-pink-100 rounded border border-pink-300 hover:border-pink-500"
                              title="분홍 배경"
                            ></button>
                            <button
                              onClick={() => document.execCommand('backColor', false, '#ffffff')}
                              className="w-5 h-5 bg-white rounded border-2 border-gray-400 hover:border-gray-600"
                              title="배경 제거"
                            ></button>
                            <div className="w-px h-4 bg-gray-300 mx-0.5"></div>
                            <button
                              onClick={() => document.execCommand('insertUnorderedList', false)}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                              title="글머리 기호"
                            >
                              •
                            </button>
                            <button
                              onClick={() => document.execCommand('insertOrderedList', false)}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                              title="번호 목록"
                            >
                              1.
                            </button>
                            <button
                              onClick={() => document.execCommand('createLink', false, '#')}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                              title="링크 추가"
                            >
                              🔗
                            </button>
                            <button
                              onClick={() => document.execCommand('removeFormat', false)}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                              title="서식 제거"
                            >
                              ✂
                            </button>
                            <button
                              onClick={() => document.execCommand('undo', false)}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                              title="실행 취소"
                            >
                              ↶
                            </button>
                            <button
                              onClick={() => document.execCommand('redo', false)}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                              title="다시 실행"
                            >
                              ↷
                            </button>
                          </div>
                        </div>
                      </div>
                      {/* 편집 가능한 미리보기 */}
                      <div className="flex-1 overflow-hidden min-h-0">
                        <div
                          className="bg-white rounded-lg p-6 w-full h-full overflow-y-auto border-2 border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          contentEditable
                          ref={(el) => {
                            if (el && isEditMode) {
                              el.focus()
                            }
                          }}
                          dangerouslySetInnerHTML={{ __html: editableHTML || (generatedHTML ? scopeHTMLForEditor(generatedHTML) : '') }}
                        onBlur={(e) => {
                          const newHTML = e.currentTarget.innerHTML
                          setEditableHTML(newHTML)
                          // 저장용에는 원본을 유지 (스코핑된 HTML을 그대로 저장해도 무방)
                          setGeneratedHTML(newHTML)
                        }}
                          style={{ 
                            outline: 'none',
                            wordBreak: 'break-word',
                            minHeight: 0
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-hidden min-h-0 p-4">
                      <iframe
                        srcDoc={generatedHTML}
                        className="w-full h-full border-0 rounded-lg bg-white"
                        title="미리보기"
                        style={{ height: '100%', width: '100%', minHeight: 0 }}
                      />
                    </div>
                  )}
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

        {/* 심의필 만들기 탭 */}
        {activeTab === 'approval' && (
          <ApprovalGenerator profile={profile} />
        )}
      </main>
    </div>
  )
}

// 심의필 생성 컴포넌트
function ApprovalGenerator({ profile }: { profile: Profile | null }) {
  // 로컬스토리지에서 저장된 등록번호 불러오기
  const getStoredRegistrationNumber = (): string => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('insurance_registration_number') || ''
    }
    return ''
  }

  // 로컬스토리지에서 저장된 지점명 불러오기
  const getStoredBranchName = (): string => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('insurance_branch_name') || ''
    }
    return ''
  }

  const [formData, setFormData] = useState({
    companyName: '프라임에셋', // 고정
    branchName: getStoredBranchName(),
    designerName: profile?.full_name || '',
    registrationNumber: getStoredRegistrationNumber(),
    approvalNumber: '',
    approvalStartDate: '2026.00.00',
    approvalEndDate: '2027.00.00',
    includeWarning: true,
  })

  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null)
  const [isEditingRegistration, setIsEditingRegistration] = useState(false)
  const [isEditingBranch, setIsEditingBranch] = useState(false)

  // 로고 이미지 로드 (고정 파일 사용 - public 폴더)
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setLogoImage(img)
    }
    img.onerror = () => {
      console.warn('로고 이미지를 불러올 수 없습니다. 기본 로고를 사용합니다.')
      setLogoImage(null)
    }
    // public 폴더의 로고 이미지 경로
    // 프라임에셋 로고 이미지 (public/prime-logo.png)
    img.src = '/prime-logo.png'
  }, [])

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value }
      
      // 등록번호가 변경되면 로컬스토리지에 저장
      if (field === 'registrationNumber' && typeof window !== 'undefined') {
        localStorage.setItem('insurance_registration_number', value as string)
      }
      
      // 지점명이 변경되면 로컬스토리지에 저장
      if (field === 'branchName' && typeof window !== 'undefined') {
        localStorage.setItem('insurance_branch_name', value as string)
      }
      
      return newData
    })
    generatePreview()
  }

  const handleSaveRegistrationNumber = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('insurance_registration_number', formData.registrationNumber)
      setIsEditingRegistration(false)
      alert('협회등록번호가 저장되었습니다.')
    }
  }

  const handleEditRegistrationNumber = () => {
    setIsEditingRegistration(true)
  }

  const handleSaveBranchName = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('insurance_branch_name', formData.branchName)
      setIsEditingBranch(false)
      alert('지점명이 저장되었습니다.')
    }
  }

  const handleEditBranchName = () => {
    setIsEditingBranch(true)
  }

  const generatePreview = () => {
    const canvas = document.createElement('canvas')
    // 크기 증가
    canvas.width = 900
    canvas.height = 550
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 배경 (더 부드러운 그라데이션)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    bgGradient.addColorStop(0, '#f8fafc')
    bgGradient.addColorStop(0.5, '#ffffff')
    bgGradient.addColorStop(1, '#f1f5f9')
    ctx.fillStyle = bgGradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // 상단 장식 라인
    const topGradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
    topGradient.addColorStop(0, '#0d9488')
    topGradient.addColorStop(0.5, '#14b8a6')
    topGradient.addColorStop(1, '#0d9488')
    ctx.fillStyle = topGradient
    ctx.fillRect(0, 0, canvas.width, 4)

    // 로고 영역 (가운데 상단) - 원본 이미지 사용 또는 그리기 (크게)
    const logoWidth = 300
    const logoHeight = 120
    const logoX = (canvas.width - logoWidth) / 2
    const logoY = 25

    if (logoImage) {
      // 원본 이미지 사용 (가운데 정렬)
      ctx.drawImage(logoImage, logoX, logoY, logoWidth, logoHeight)
    } else {
      // 이미지가 없으면 기본 로고 그리기 (모던 스타일)
      ctx.fillStyle = '#0d9488'
      ctx.beginPath()
      ctx.moveTo(logoX, logoY + 3)
      for (let i = 0; i <= logoWidth; i += 5) {
        const wave = Math.sin(i * 0.1) * 2
        ctx.lineTo(logoX + i, logoY + wave)
      }
      ctx.lineTo(logoX + logoWidth, logoY + logoHeight)
      ctx.lineTo(logoX, logoY + logoHeight)
      ctx.closePath()
      ctx.fill()
      
      // PRIME 텍스트 (훨씬 더 크게)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 64px "Arial", sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('PRIME', logoX + 30, logoY + 22)
      
      let xOffset = logoX + 30
      const yOffset = logoY + 22
      ctx.fillText('P', xOffset, yOffset)
      xOffset += 38
      ctx.fillText('R', xOffset, yOffset)
      xOffset += 38
      ctx.fillStyle = '#84cc16'
      ctx.fillRect(xOffset + 3, yOffset - 3, 9, 58)
      xOffset += 32
      ctx.fillStyle = '#ffffff'
      ctx.fillText('M', xOffset, yOffset)
      xOffset += 44
      ctx.fillText('E', xOffset, yOffset)
      
      // ASSET 텍스트 (훨씬 더 크게)
      ctx.font = '54px "Arial", sans-serif'
      ctx.fillText('ASSET', logoX + 30, logoY + 82)
      
      // 한글 회사명 (로고 오른쪽, 훨씬 더 크게)
      ctx.fillStyle = '#0d9488'
      ctx.font = 'bold 54px "Malgun Gothic", "맑은 고딕", sans-serif'
      ctx.fillText(formData.companyName, logoX + logoWidth + 30, logoY + 70)
    }

    // 회사명 및 지점명 (가운데 정렬, 더 큰 글씨, 그라데이션 효과, 위로 올림)
    ctx.textAlign = 'center'
    let companyText = '프라임에셋'
    if (formData.branchName) {
      companyText += ` ${formData.branchName}`
    }
    
    // 그라데이션 텍스트 효과 (더 예쁘게)
    const textGradient = ctx.createLinearGradient(
      canvas.width / 2 - 200, 0,
      canvas.width / 2 + 200, 0
    )
    textGradient.addColorStop(0, '#0d9488')
    textGradient.addColorStop(0.3, '#14b8a6')
    textGradient.addColorStop(0.7, '#2dd4bf')
    textGradient.addColorStop(1, '#0d9488')
    ctx.fillStyle = textGradient
    ctx.font = 'bold 36px "Malgun Gothic", "맑은 고딕", sans-serif'
    
    // 그림자 효과 제거
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    ctx.fillText(companyText, canvas.width / 2, logoY + logoHeight + 30)
    
    // 밑줄 추가 (회사명/지점명 아래에만, 더 예쁘게)
    const underlineGradient = ctx.createLinearGradient(
      canvas.width / 2 - 150, 0,
      canvas.width / 2 + 150, 0
    )
    underlineGradient.addColorStop(0, '#0d9488')
    underlineGradient.addColorStop(0.5, '#14b8a6')
    underlineGradient.addColorStop(1, '#0d9488')
    ctx.strokeStyle = underlineGradient
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    const companyTextWidth = ctx.measureText(companyText).width
    ctx.beginPath()
    ctx.moveTo(canvas.width / 2 - companyTextWidth / 2 - 15, logoY + logoHeight + 42)
    ctx.lineTo(canvas.width / 2 + companyTextWidth / 2 + 15, logoY + logoHeight + 42)
    ctx.stroke()

    // 설계사 정보 및 등록번호 (가운데 정렬, 세로로 배치, 더 큰 글씨, 굵은 검은색, 간격 추가)
    ctx.font = 'bold 20px "Malgun Gothic", "맑은 고딕", sans-serif'
    ctx.fillStyle = '#000000'
    const designerText = `설계사 ${formData.designerName}`
    const registrationText = `손.생보 협회 등록번호 ${formData.registrationNumber || '00000000000000'}`
    ctx.fillText(designerText, canvas.width / 2, logoY + logoHeight + 75)
    ctx.fillText(registrationText, canvas.width / 2, logoY + logoHeight + 100)

    // 심의필 정보 (가운데 정렬, 더 큰 글씨, 강조 박스 - 더 예쁘게)
    // 지점명은 제외하고 회사명만 표시
    const approvalCompanyName = '프라임에셋'
    const approvalText = `${approvalCompanyName} 심의필 제${formData.approvalNumber || '000000'}호 (${formData.approvalStartDate || '2026.00.00'}~${formData.approvalEndDate || '2027.00.00'})`
    
    // 텍스트 크기 측정 (정확한 측정을 위해 폰트 먼저 설정)
    ctx.font = 'bold 21px "Malgun Gothic", "맑은 고딕", sans-serif'
    const approvalTextWidth = ctx.measureText(approvalText).width
    
    // 텍스트에 맞게 최적화된 패딩 (글자에 딱 맞게)
    const boxPadding = 18
    const boxX = canvas.width / 2 - approvalTextWidth / 2 - boxPadding
    const boxY = logoY + logoHeight + 115
    const boxWidth = approvalTextWidth + boxPadding * 2
    const boxHeight = 38
    const borderRadius = 12
    
    // 박스 그림자
    ctx.fillStyle = 'rgba(30, 64, 175, 0.1)'
    ctx.fillRect(boxX + 2, boxY + 2, boxWidth, boxHeight)
    
    // 박스 배경 (그라데이션)
    const boxGradient = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxHeight)
    boxGradient.addColorStop(0, '#eff6ff')
    boxGradient.addColorStop(1, '#dbeafe')
    ctx.fillStyle = boxGradient
    
    // 둥근 모서리
    ctx.beginPath()
    ctx.moveTo(boxX + borderRadius, boxY)
    ctx.lineTo(boxX + boxWidth - borderRadius, boxY)
    ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + borderRadius)
    ctx.lineTo(boxX + boxWidth, boxY + boxHeight - borderRadius)
    ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - borderRadius, boxY + boxHeight)
    ctx.lineTo(boxX + borderRadius, boxY + boxHeight)
    ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - borderRadius)
    ctx.lineTo(boxX, boxY + borderRadius)
    ctx.quadraticCurveTo(boxX, boxY, boxX + borderRadius, boxY)
    ctx.closePath()
    ctx.fill()
    
    // 테두리
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 1.5
    ctx.stroke()
    
    // 텍스트 (그림자 없이)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.fillStyle = '#1e40af'
    ctx.fillText(approvalText, canvas.width / 2, logoY + logoHeight + 139)

    // 준수 문구 (가운데 정렬, 더 큰 글씨, 굵은 검은색, 그림자 없음)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 18px "Malgun Gothic", "맑은 고딕", sans-serif'
    ctx.fillText('본 광고는 광고심의기준을 준수하였으며, 유효기간은 심의일로부터 1년입니다.', canvas.width / 2, logoY + logoHeight + 170)

    // 경고 문구 (가운데 정렬, 항상 포함, 더 큰 글씨, 강조, 간격 추가, 그림자 없음)
    let yPos = logoY + logoHeight + 200
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.fillStyle = '#dc2626'
    ctx.font = 'bold 18px "Malgun Gothic", "맑은 고딕", sans-serif'
    ctx.fillText('보험계약자가 기존 보험계약을 해지하고 새로운 보험계약을 체결하는 과정에서', canvas.width / 2, yPos)
    
    ctx.fillStyle = '#991b1b'
    ctx.font = '16px "Malgun Gothic", "맑은 고딕", sans-serif'
    yPos += 28
    ctx.fillText('① 질병이력, 연령증가 등으로 가입이 거절되거나 보험료가 인상될 수 있습니다.', canvas.width / 2, yPos)
    yPos += 25
    ctx.fillText('② 가입 상품에 따라 새로운 면책기간 적용 및 보장 제한 등 기타 불이익이 발생할 수 있습니다.', canvas.width / 2, yPos)
    yPos += 35

    // 추가 안내사항 (가운데 정렬, 더 큰 글씨, 굵은 검은색, 그림자 없음)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 17px "Malgun Gothic", "맑은 고딕", sans-serif'
    ctx.fillText('• 본 내용은 모집종사자 개인의 의견이며, 계약 체결에 따른 이익 또는 손실은 보험계약자 등에게 귀속됩니다.', canvas.width / 2, yPos)
    yPos += 30
    ctx.fillText('• 보험사 및 상품별로 상이할 수 있으므로, 관련한 세부사항은 반드시 해당 약관을 참조하시기 바랍니다.', canvas.width / 2, yPos)
    yPos += 30
    ctx.fillText('• 보험회사 상품별, 성별, 연령, 직업 등에 따라 가입가능한 담보와 가입금액, 보험료는 달라질 수 있습니다.', canvas.width / 2, yPos)

    const imageData = canvas.toDataURL('image/png')
    setPreviewImage(imageData)
    
    // localStorage에 심의필 이미지 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem('approval_certificate_image', imageData)
    }
  }

  useEffect(() => {
    generatePreview()
  }, [formData, logoImage])

  const handleDownload = () => {
    if (!previewImage) return
    
    const link = document.createElement('a')
    link.download = `심의필_${formData.approvalNumber || '00000'}_${new Date().getTime()}.png`
    link.href = previewImage
    link.click()
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          심의필 만들기
        </h2>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* 입력 폼 */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  회사명
                </label>
                <div className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                  프라임에셋
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  지점명
                  {formData.branchName && !isEditingBranch && (
                    <span className="ml-2 text-xs text-green-600 font-normal">(저장됨)</span>
                  )}
                </label>
                {isEditingBranch ? (
                  <div>
                    <input
                      type="text"
                      value={formData.branchName}
                      onChange={(e) => handleInputChange('branchName', e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-1.5"
                      placeholder="예: 강남지점"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleSaveBranchName}
                        className="flex-1 px-2.5 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-xs"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingBranch(false)
                          setFormData(prev => ({
                            ...prev,
                            branchName: getStoredBranchName()
                          }))
                        }}
                        className="flex-1 px-2.5 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold text-xs"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1.5 items-center">
                    <input
                      type="text"
                      value={formData.branchName}
                      readOnly
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
                      placeholder="지점명"
                    />
                    <button
                      onClick={handleEditBranchName}
                      className="px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-xs whitespace-nowrap flex-shrink-0"
                    >
                      수정
                    </button>
                  </div>
                )}
                {formData.branchName && !isEditingBranch && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    저장됨
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  설계사명
                </label>
                <input
                  type="text"
                  value={formData.designerName}
                  onChange={(e) => handleInputChange('designerName', e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  협회 등록번호
                  {formData.registrationNumber && !isEditingRegistration && (
                    <span className="ml-2 text-xs text-green-600 font-normal">(저장됨)</span>
                  )}
                </label>
                {isEditingRegistration ? (
                  <div>
                    <input
                      type="text"
                      value={formData.registrationNumber}
                      onChange={(e) => handleInputChange('registrationNumber', e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-1.5"
                      placeholder="00000000000000"
                      maxLength={14}
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleSaveRegistrationNumber}
                        className="flex-1 px-2.5 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-xs"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingRegistration(false)
                          setFormData(prev => ({
                            ...prev,
                            registrationNumber: getStoredRegistrationNumber()
                          }))
                        }}
                        className="flex-1 px-2.5 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold text-xs"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1.5 items-center">
                    <input
                      type="text"
                      value={formData.registrationNumber}
                      readOnly
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
                      placeholder="00000000000000"
                    />
                    <button
                      onClick={handleEditRegistrationNumber}
                      className="px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-xs whitespace-nowrap flex-shrink-0"
                    >
                      수정
                    </button>
                  </div>
                )}
                {formData.registrationNumber && !isEditingRegistration && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    저장됨
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                심의필 번호
              </label>
              <input
                type="text"
                value={formData.approvalNumber}
                onChange={(e) => handleInputChange('approvalNumber', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="00000"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  유효기간 시작일
                </label>
                <input
                  type="text"
                  value={formData.approvalStartDate}
                  onChange={(e) => handleInputChange('approvalStartDate', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="2026.00.00"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  유효기간 종료일
                </label>
                <input
                  type="text"
                  value={formData.approvalEndDate}
                  onChange={(e) => handleInputChange('approvalEndDate', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="2026.00.00"
                />
              </div>
            </div>


            <button
              onClick={handleDownload}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <FileDown className="w-5 h-5" />
              이미지 다운로드
            </button>
          </div>

          {/* 미리보기 */}
          <div className="flex flex-col">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              미리보기
            </label>
            <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden shadow-lg">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="심의필 미리보기"
                  className="w-full h-auto block"
                />
              ) : (
                <div className="w-full h-64 bg-white rounded-lg flex items-center justify-center text-gray-400 text-sm">
                  미리보기 생성 중...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

