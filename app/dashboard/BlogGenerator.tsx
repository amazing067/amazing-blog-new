'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, LogOut, Sparkles, Copy, Send, FileDown, Clock, BookOpen, TrendingUp, ArrowLeft, UserCheck, History, BarChart3, FileText, Save, MessageSquare, Image as ImageIcon } from 'lucide-react'
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
  
  // 4. ★★★ 핵심: 모든 전역 태그 선택자를 .blog-editor 내부로 스코핑
  // 모든 HTML 태그를 포함하여 완전히 격리
  const globalTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li', 'table', 'th', 'td', 'blockquote', 'span', 'div', 'section', 'article', 'aside', 'nav', 'footer', 'button', 'main', 'header', 'body', 'html', 'form', 'input', 'textarea', 'select', 'label', 'img', 'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'text', 'g', 'defs', 'use', 'symbol', 'clipPath', 'mask', 'pattern', 'linearGradient', 'radialGradient', 'stop', 'filter', 'feGaussianBlur', 'feColorMatrix', 'feComposite', 'feOffset', 'feMerge', 'feMergeNode', 'feFlood', 'feImage', 'feBlend', 'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight', 'feDropShadow', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feMorphology', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence', 'foreignObject', 'marker', 'metadata', 'style', 'title', 'desc', 'view', 'animate', 'animateColor', 'animateMotion', 'animateTransform', 'set', 'mpath', 'tspan', 'tref', 'textPath', 'altGlyph', 'altGlyphDef', 'altGlyphItem', 'glyph', 'glyphRef', 'hkern', 'vkern', 'font', 'font-face', 'font-face-format', 'font-face-name', 'font-face-src', 'font-face-uri', 'missing-glyph', 'cursor', 'a', 'altGlyphDef', 'altGlyphItem', 'animate', 'animateColor', 'animateMotion', 'animateTransform', 'circle', 'clipPath', 'color-profile', 'cursor', 'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode', 'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence', 'filter', 'font', 'font-face', 'font-face-format', 'font-face-name', 'font-face-src', 'font-face-uri', 'foreignObject', 'g', 'glyph', 'glyphRef', 'hkern', 'image', 'line', 'linearGradient', 'marker', 'mask', 'metadata', 'missing-glyph', 'mpath', 'path', 'pattern', 'polygon', 'polyline', 'radialGradient', 'rect', 'script', 'set', 'stop', 'style', 'svg', 'switch', 'symbol', 'text', 'textPath', 'title', 'tref', 'tspan', 'use', 'view', 'vkern']
  
  scoped = scoped.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, cssContent) => {
    let scopedCss = cssContent
    
    // ★★★ 매우 중요: 모든 CSS 선택자를 .blog-editor로 스코핑 - 완전 격리
    // 방법: CSS 선택자를 파싱하여 모든 선택자 앞에 .blog-editor 추가
    
    // 1. 모든 CSS 규칙 블록을 찾아서 선택자 부분만 스코핑
    // 선택자 { 속성 } 형태를 찾아서 선택자 부분만 수정
    scopedCss = scopedCss.replace(/([^{}]+)\{([^{}]*)\}/g, (ruleMatch: string, selectors: string, properties: string) => {
      // 선택자가 이미 .blog-editor로 시작하거나, @로 시작하는 경우는 제외
      if (selectors.trim().startsWith('@') || selectors.includes('.blog-editor')) {
        return ruleMatch
      }
      
      // 선택자를 분리하고 각각에 .blog-editor 추가
      const scopedSelectors = selectors.split(',').map((selector: string) => {
        const trimmed = selector.trim()
        // 이미 .blog-editor가 포함되어 있으면 그대로
        if (trimmed.includes('.blog-editor')) {
          return trimmed
        }
        // @로 시작하는 경우 (예: @media, @keyframes)는 그대로
        if (trimmed.startsWith('@')) {
          return trimmed
        }
        // :root, :host 등 특수 선택자는 그대로
        if (trimmed.startsWith(':root') || trimmed.startsWith(':host')) {
          return trimmed
        }
        // 그 외 모든 선택자에 .blog-editor 추가
        return `.blog-editor ${trimmed}`
      }).join(', ')
      
      return `${scopedSelectors} {${properties}}`
    })
    
    // 2. @media 쿼리 내부도 처리
    scopedCss = scopedCss.replace(/@media[^{]*\{([\s\S]*?)\}/gi, (mediaMatch: string, mediaContent: string) => {
      const scopedMedia = mediaContent.replace(/([^{}]+)\{([^{}]*)\}/g, (ruleMatch: string, selectors: string, properties: string) => {
        if (selectors.trim().startsWith('@') || selectors.includes('.blog-editor')) {
          return ruleMatch
        }
        const scopedSelectors = selectors.split(',').map((selector: string) => {
          const trimmed = selector.trim()
          if (trimmed.includes('.blog-editor') || trimmed.startsWith('@') || trimmed.startsWith(':root') || trimmed.startsWith(':host')) {
            return trimmed
          }
          return `.blog-editor ${trimmed}`
        }).join(', ')
        return `${scopedSelectors} {${properties}}`
      })
      return mediaMatch.replace(mediaContent, scopedMedia)
    })
    
    // 스타일은 유지하되, scoped 속성 추가로 격리 강화
    return `<style scoped>${scopedCss}</style>`
  })
  
  // HTML을 .blog-editor로 감싸기 (이미 감싸져 있지 않은 경우만)
  if (!scoped.trim().startsWith('<div class="blog-editor"') && 
      !scoped.trim().startsWith("<div class='blog-editor'") &&
      !scoped.includes('class="blog-editor"') && 
      !scoped.includes("class='blog-editor'")) {
    scoped = `<div class="blog-editor">${scoped}</div>`
  }
  
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

export default function BlogGenerator({ profile: initialProfile }: { profile: Profile | null }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<'write' | 'history' | 'stats' | 'approval' | 'qa' | 'image-analysis'>('write')
  const [profile, setProfile] = useState<Profile | null>(initialProfile)
  const [formData, setFormData] = useState({
    topic: '',
    keywords: '',
    product: 'auto',
    tone: 'friendly',
    template: '',
    designSheetImage: '',
    designSheetAnalysis: null as { productName: string; targetPersona: string; worryPoint: string; sellingPoint: string } | null,
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAnalyzingDesignSheet, setIsAnalyzingDesignSheet] = useState(false)
  const [generatedHTML, setGeneratedHTML] = useState('')
  const [progress, setProgress] = useState(0)
  const [sources, setSources] = useState<any[]>([])
  const [sourcesMarkdown, setSourcesMarkdown] = useState('')
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([])
  const [isLoadingPosts, setIsLoadingPosts] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editableHTML, setEditableHTML] = useState('')

  // 현재 로그인한 사용자의 프로필 정보 다시 가져오기 (세션 업데이트 대응)
  useEffect(() => {
    const loadCurrentProfile = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          
          if (!error && profileData) {
            setProfile(profileData)
          }
        }
      } catch (error) {
        console.error('프로필 로드 오류:', error)
      }
    }
    
    loadCurrentProfile()
  }, [])

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

  const handleDesignSheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64String = reader.result as string
      setFormData(prev => ({ ...prev, designSheetImage: base64String, designSheetAnalysis: null }))
      
      // 제안서 이미지 분석
      setIsAnalyzingDesignSheet(true)
      try {
        const response = await fetch('/api/analyze-design-sheet', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageBase64: base64String
          }),
        })

        const data = await response.json()
        if (data.success && data.data) {
          // 제안서 분석 결과를 바탕으로 주제와 키워드 자동 생성
          const analysis = data.data
          const productName = analysis.productName || '보험'
          const targetPersona = analysis.targetPersona || ''
          
          // 주제 자동 생성: 상품명 + 대상 고객
          const autoTopic = `${productName} ${targetPersona ? targetPersona + ' ' : ''}가이드`
          
          // 키워드 자동 생성: 상품명에서 핵심 키워드 추출
          const productKeywords = productName.split(' ').filter((word: string) => word.length > 1)
          const autoKeywords = productKeywords.join(', ') || productName
          
          // formData에 자동으로 채우기
          setFormData(prev => ({
            ...prev,
            designSheetAnalysis: analysis,
            topic: prev.topic || autoTopic, // 이미 주제가 있으면 유지, 없으면 자동 생성
            keywords: prev.keywords || autoKeywords, // 이미 키워드가 있으면 유지, 없으면 자동 생성
          }))
        }
      } catch (error) {
        console.error('제안서 분석 오류:', error)
        alert('제안서 분석 중 오류가 발생했습니다.')
      } finally {
        setIsAnalyzingDesignSheet(false)
      }
    }
    reader.readAsDataURL(file)
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
      designSheetImage: '',
      designSheetAnalysis: null,
    })
  }

  const handleGenerate = async () => {
    if (!formData.topic && !formData.designSheetImage) {
      alert('주제를 입력하거나 제안서 이미지를 첨부해주세요!')
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
          designSheetImage: formData.designSheetImage || undefined,
          designSheetAnalysis: formData.designSheetAnalysis || undefined,
          authorName: profile?.full_name || undefined,
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
      
      // 제안서 이미지 추가 (있는 경우)
      if (formData.designSheetImage) {
        const designSheetSection = `
<div style="margin-top: 40px; margin-bottom: 40px; padding: 30px; background: #f8f9fa; border-radius: 12px; border: 2px solid #e5e7eb;">
  <h2 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
    <span style="display: inline-block; width: 6px; height: 24px; background: linear-gradient(to bottom, #3683f1, #25467a); border-radius: 4px;"></span>
    제안서
  </h2>
  <img src="${formData.designSheetImage}" alt="보험 제안서" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);" />
</div>`
        
        // 본문 중간에 추가 (</main> 태그 앞)
        if (finalHTML.includes('</main>')) {
          finalHTML = finalHTML.replace('</main>', designSheetSection + '\n</main>')
        } else if (finalHTML.includes('</body>')) {
          finalHTML = finalHTML.replace('</body>', designSheetSection + '\n</body>')
        } else {
          finalHTML += designSheetSection
        }
      }
      
      // 심의필 이미지 자동 추가 (localStorage에서 가져오기, 사용자별)
      if (typeof window !== 'undefined' && profile?.id) {
        const approvalImage = localStorage.getItem(`approval_certificate_image_${profile.id}`)
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

  const handleDownloadPDF = async () => {
    if (!generatedHTML) {
      alert('생성된 글이 없습니다!')
      return
    }

    try {
      // 로딩 메시지
      alert('PDF 생성 중입니다... 잠시만 기다려주세요.')
      
      // html2canvas와 jsPDF 동적 import
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      // 임시 iframe 생성하여 HTML 렌더링
      const iframe = document.createElement('iframe')
      iframe.style.position = 'absolute'
      iframe.style.left = '-9999px'
      iframe.style.top = '0'
      iframe.style.width = '900px'
      iframe.style.border = 'none'
      iframe.srcdoc = generatedHTML
      
      document.body.appendChild(iframe)

      // iframe 로드 대기
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('iframe 로드 시간 초과'))
        }, 10000)

        iframe.onload = () => {
          clearTimeout(timeout)
          setTimeout(() => resolve(), 1000) // 스타일 및 이미지 로드 대기
        }
        
        // 이미 로드된 경우
        if (iframe.contentDocument?.readyState === 'complete') {
          clearTimeout(timeout)
          setTimeout(() => resolve(), 1000)
        }
      })

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (!iframeDoc || !iframeDoc.body) {
        throw new Error('iframe 문서를 가져올 수 없습니다')
      }

      const body = iframeDoc.body
      const html = iframeDoc.documentElement

      // 스크롤 높이 계산
      const bodyHeight = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      )

      // iframe 높이 설정
      iframe.style.height = `${bodyHeight}px`

      // 추가 대기 (높이 조정 후 렌더링 완료 대기)
      await new Promise(resolve => setTimeout(resolve, 500))

      // html2canvas로 이미지 변환
      const canvas = await html2canvas(body, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 900,
        height: bodyHeight,
        windowWidth: 900,
        windowHeight: bodyHeight,
      })

      // PDF 생성
      const imgData = canvas.toDataURL('image/png', 0.95)
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = pdfWidth / imgWidth
      const imgScaledWidth = pdfWidth
      const imgScaledHeight = imgHeight * ratio

      // 여러 페이지로 나누기 (이미지를 올바르게 분할)
      const totalPages = Math.ceil(imgScaledHeight / pdfHeight) || 1
      
      for (let i = 0; i < totalPages; i++) {
        if (i > 0) {
          pdf.addPage()
        }
        
        // 각 페이지의 Y 오프셋 계산 (픽셀 단위)
        const sourceY = (i * pdfHeight) / ratio
        const remainingHeight = imgHeight - sourceY
        const pageHeight = Math.min(pdfHeight / ratio, remainingHeight)
        
        // 각 페이지를 위한 임시 캔버스 생성
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = imgWidth
        pageCanvas.height = Math.ceil(pageHeight)
        const pageCtx = pageCanvas.getContext('2d')
        
        if (pageCtx && pageHeight > 0) {
          // 원본 캔버스에서 해당 페이지 영역 복사
          pageCtx.fillStyle = '#ffffff'
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
          pageCtx.drawImage(
            canvas,
            0, Math.floor(sourceY), imgWidth, Math.ceil(pageHeight),  // 소스 영역
            0, 0, imgWidth, Math.ceil(pageHeight)                      // 대상 영역
          )
          
          const pageImgData = pageCanvas.toDataURL('image/png', 0.95)
          const pageImgScaledHeight = pageHeight * ratio
          pdf.addImage(pageImgData, 'PNG', 0, 0, imgScaledWidth, pageImgScaledHeight, undefined, 'FAST')
        }
      }

      // 파일명 생성
      const sanitizedTopic = (formData.topic || '글').replace(/[^\w\s가-힣]/g, '').slice(0, 20)
      const fileName = `보험블로그_${sanitizedTopic}_${new Date().toISOString().split('T')[0]}.pdf`
      
      // PDF 다운로드
      pdf.save(fileName)

      // 정리
      document.body.removeChild(iframe)

      alert('✅ PDF가 다운로드되었습니다!')
    } catch (error: any) {
      console.error('PDF 생성 오류:', error)
      alert('PDF 다운로드 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'))
    }
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
      designSheetImage: '',
      designSheetAnalysis: null,
    })
    setActiveTab('write')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* 그라데이션 애니메이션 스타일 */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes shimmer {
            0% {
              background-position: -200% center;
            }
            100% {
              background-position: 200% center;
            }
          }
        `
      }} />
      {/* 편집 모드일 때 앱 헤더 격리 - CSS Containment으로 완전 격리 */}
      {isEditMode && (
        <style dangerouslySetInnerHTML={{
          __html: `
            /* 블로그 생성기 컨테이너 격리 */
            .blog-generator-container {
              isolation: isolate !important;
              contain: layout style paint !important;
              position: relative !important;
              z-index: 1 !important;
            }
            
            /* 블로그 편집 영역 격리 - CSS Containment */
            .blog-editor {
              isolation: isolate !important;
              contain: layout style paint !important;
              position: relative !important;
              z-index: 1 !important;
            }
            
            /* Q&A 생성기 컨테이너 격리 */
            .qa-generator-wrapper,
            .qa-generator-container {
              isolation: isolate !important;
              contain: layout style paint !important;
              position: relative !important;
              z-index: 1 !important;
            }
            
            .qa-question-container,
            .qa-answer-container {
              isolation: isolate !important;
              contain: layout style paint !important;
              position: relative !important;
              z-index: 1 !important;
            }
            
            /* ★★★ 앱 헤더 완전 격리 - 비편집 모드 크기 유지 (최우선 적용) */
            /* 모든 가능한 선택자 경로에 대해 헤더 크기 고정 */
            header.bg-gradient-to-r,
            header.bg-gradient-to-r.shadow-xl,
            header[class*="bg-gradient-to-r"],
            header[class*="from-[#1e293b]"],
            body > header.bg-gradient-to-r,
            .min-h-screen > header.bg-gradient-to-r,
            div.min-h-screen > header.bg-gradient-to-r {
              contain: layout style paint !important;
              isolation: isolate !important;
              position: relative !important;
              z-index: 9999 !important;
              padding-top: 0 !important;
              padding-bottom: 0 !important;
              padding-left: 0 !important;
              padding-right: 0 !important;
              margin: 0 !important;
              margin-top: 0 !important;
              margin-bottom: 0 !important;
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
              line-height: normal !important;
              box-sizing: border-box !important;
            }
            
            /* 헤더 내부 컨테이너 - 비편집 모드 크기 유지 (모든 선택자) */
            header.bg-gradient-to-r > div.container,
            header.bg-gradient-to-r > div[class*="container"],
            header.bg-gradient-to-r > div.mx-auto,
            header.bg-gradient-to-r > div[class*="mx-auto"],
            header.bg-gradient-to-r > div.container.mx-auto,
            body > header.bg-gradient-to-r > div.container,
            .min-h-screen > header.bg-gradient-to-r > div.container {
              contain: layout style !important;
              padding-top: 0.5rem !important; /* py-2 = 8px - 비편집 모드와 동일 */
              padding-bottom: 0.5rem !important; /* py-2 = 8px - 비편집 모드와 동일 */
              padding-left: 1rem !important; /* px-4 = 16px */
              padding-right: 1rem !important; /* px-4 = 16px */
              margin: 0 auto !important;
              margin-top: 0 !important;
              margin-bottom: 0 !important;
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;
              width: 100% !important;
              max-width: 1280px !important;
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
              line-height: normal !important;
              box-sizing: border-box !important;
            }
            
            /* 헤더 내부 flex 컨테이너 (왼쪽) - 비편집 모드 크기 유지 */
            header.bg-gradient-to-r > div.container > div:first-child,
            header.bg-gradient-to-r > div[class*="container"] > div:first-child,
            header.bg-gradient-to-r > div.container > div.flex:first-child {
              display: flex !important;
              align-items: center !important;
              gap: 1rem !important; /* gap-4 - 비편집 모드와 동일 */
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
              margin: 0 !important;
              margin-top: 0 !important;
              margin-bottom: 0 !important;
              padding: 0 !important;
              padding-top: 0 !important;
              padding-bottom: 0 !important;
              line-height: normal !important;
              box-sizing: border-box !important;
            }
            
            /* 헤더 내부 flex 컨테이너 (오른쪽) - 비편집 모드 크기 유지 */
            header.bg-gradient-to-r > div.container > div:last-child,
            header.bg-gradient-to-r > div[class*="container"] > div:last-child,
            header.bg-gradient-to-r > div.container > div.flex:last-child {
              display: flex !important;
              align-items: center !important;
              gap: 0.75rem !important; /* gap-3 - 비편집 모드와 동일 */
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
              margin: 0 !important;
              margin-top: 0 !important;
              margin-bottom: 0 !important;
              padding: 0 !important;
              padding-top: 0 !important;
              padding-bottom: 0 !important;
              line-height: normal !important;
              box-sizing: border-box !important;
            }
            
            /* 헤더 h1 (제목) - 비편집 모드 크기 유지 (모든 선택자) */
            header.bg-gradient-to-r h1,
            header.bg-gradient-to-r > div.container h1,
            header.bg-gradient-to-r > div.container > div h1,
            header.bg-gradient-to-r > div.container > div > div h1 {
              font-size: 1.125rem !important; /* text-lg - 비편집 모드와 동일 */
              font-weight: 700 !important;
              margin: 0 !important;
              margin-top: 0 !important;
              margin-bottom: 0 !important;
              padding: 0 !important;
              padding-top: 0 !important;
              padding-bottom: 0 !important;
              line-height: 1.5 !important;
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
              box-sizing: border-box !important;
            }
            
            /* 헤더 p (환영 메시지) - 비편집 모드 크기 유지 (모든 선택자) */
            header.bg-gradient-to-r p,
            header.bg-gradient-to-r > div.container p,
            header.bg-gradient-to-r > div.container > div p,
            header.bg-gradient-to-r > div.container > div > div p {
              font-size: 0.75rem !important; /* text-xs - 비편집 모드와 동일 */
              font-weight: 600 !important; /* font-semibold */
              margin: 0 !important;
              margin-top: 0 !important;
              margin-bottom: 0 !important;
              padding: 0 !important;
              padding-top: 0 !important;
              padding-bottom: 0 !important;
              line-height: 1.5 !important;
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
              box-sizing: border-box !important;
            }
            
            /* 헤더 버튼 - 비편집 모드 크기 유지 (모든 선택자) */
            header.bg-gradient-to-r button,
            header.bg-gradient-to-r > div.container button,
            header.bg-gradient-to-r > div.container > div button,
            header.bg-gradient-to-r > div.container > div > div button {
              padding: 0.375rem 0.625rem !important; /* px-2.5 py-1.5 - 비편집 모드와 동일 */
              font-size: 0.875rem !important; /* text-sm - 비편집 모드와 동일 */
              font-weight: 600 !important; /* font-semibold */
              border-radius: 0.375rem !important; /* rounded-md */
              margin: 0 !important;
              margin-top: 0 !important;
              margin-bottom: 0 !important;
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
              line-height: normal !important;
              display: flex !important;
              align-items: center !important;
              gap: 0.375rem !important; /* gap-1.5 - 비편집 모드와 동일 */
              white-space: nowrap !important;
              box-sizing: border-box !important;
            }
            
            /* 헤더 버튼 아이콘 - 비편집 모드 크기 유지 (모든 선택자) */
            header.bg-gradient-to-r button svg,
            header.bg-gradient-to-r > div.container button svg,
            header.bg-gradient-to-r > div.container > div button svg {
              width: 0.875rem !important; /* w-3.5 = 14px - 비편집 모드와 동일 */
              height: 0.875rem !important; /* h-3.5 = 14px - 비편집 모드와 동일 */
              flex-shrink: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              box-sizing: border-box !important;
            }
            
            /* 헤더 아이콘 컨테이너 (Sparkles) - 비편집 모드 크기 유지 */
            header.bg-gradient-to-r > div.container > div > div[class*="bg-gradient-to-br"],
            header.bg-gradient-to-r > div[class*="container"] > div > div[class*="bg-gradient-to-br"] {
              padding: 0.375rem !important; /* p-1.5 = 6px - 비편집 모드와 동일 */
              margin: 0 !important;
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
              box-sizing: border-box !important;
            }
            
            /* 헤더 아이콘 (Sparkles) - 비편집 모드 크기 유지 */
            header.bg-gradient-to-r > div.container > div > div[class*="bg-gradient-to-br"] svg,
            header.bg-gradient-to-r > div[class*="container"] > div > div[class*="bg-gradient-to-br"] svg {
              width: 1.25rem !important; /* w-5 = 20px - 비편집 모드와 동일 */
              height: 1.25rem !important; /* h-5 = 20px - 비편집 모드와 동일 */
              margin: 0 !important;
              padding: 0 !important;
              box-sizing: border-box !important;
            }
            
            /* 헤더 form - 비편집 모드 크기 유지 */
            header.bg-gradient-to-r form,
            header.bg-gradient-to-r > div.container form,
            header.bg-gradient-to-r > div.container > div form {
              margin: 0 !important;
              padding: 0 !important;
              display: inline-block !important;
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
              box-sizing: border-box !important;
            }
            
            /* 헤더 내부 모든 요소 - 블로그 콘텐츠의 영향을 받지 않도록 */
            header.bg-gradient-to-r *,
            header.bg-gradient-to-r > div.container *,
            header.bg-gradient-to-r > div.container > div * {
              box-sizing: border-box !important;
            }
            
            /* 탭 네비게이션 격리 및 원래 크기 유지 */
            main.container {
              contain: layout style;
              padding-top: 0.5rem !important; /* py-2 = 8px */
              padding-bottom: 0.5rem !important; /* py-2 = 8px */
              padding-left: 1rem !important; /* px-4 = 16px */
              padding-right: 1rem !important; /* px-4 = 16px */
            }
            
            /* 탭 네비게이션 외부 컨테이너 - 원래 크기 유지 */
            main.container > div.max-w-7xl.mx-auto {
              margin-left: auto !important;
              margin-right: auto !important;
              max-width: 80rem !important; /* max-w-7xl */
              margin-bottom: 0.75rem !important; /* mb-3 = 12px */
            }
            
            /* 탭 네비게이션 컨테이너 - 원래 크기 유지 */
            main.container > div.max-w-7xl > div.bg-white.rounded-xl.shadow-lg {
              padding: 0.375rem !important; /* p-1.5 = 6px */
              margin: 0 !important;
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
              line-height: normal !important;
            }
            
            /* 탭 네비게이션 버튼 컨테이너 - 원래 크기 유지 */
            main.container > div.max-w-7xl > div.bg-white.rounded-xl.shadow-lg.flex {
              gap: 0.375rem !important; /* gap-1.5 = 6px */
              display: flex !important;
              align-items: center !important;
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
            }
            
            /* 탭 네비게이션 버튼 - 원래 크기 유지 */
            main.container > div.max-w-7xl > div.bg-white.rounded-xl button {
              padding: 0.5rem 1rem !important; /* px-4 py-2 */
              font-size: 0.875rem !important; /* text-sm */
              font-weight: 600 !important; /* font-semibold */
              border-radius: 0.375rem !important; /* rounded-md */
              margin: 0 !important;
              white-space: nowrap !important;
              line-height: 1.25rem !important;
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
              display: flex !important;
              align-items: center !important;
              gap: 0.375rem !important; /* gap-1.5 */
            }
            
            /* 탭 네비게이션 아이콘 - 원래 크기 유지 */
            main.container > div.max-w-7xl > div.bg-white.rounded-xl button svg {
              width: 1rem !important; /* w-4 = 16px */
              height: 1rem !important; /* h-4 = 16px */
              flex-shrink: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            
            /* 결과 미리보기 버튼 바 격리 및 원래 크기 유지 */
            .bg-gradient-to-r.from-gray-50.to-gray-100 {
              contain: layout style;
              padding-top: 0.5rem !important; /* py-2 = 8px */
              padding-bottom: 0.5rem !important; /* py-2 = 8px */
              padding-left: 1rem !important; /* px-4 = 16px */
              padding-right: 1rem !important; /* px-4 = 16px */
              margin: 0 !important;
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
              line-height: normal !important;
            }
            
            /* 결과 미리보기 제목 - 원래 크기 유지 */
            .bg-gradient-to-r.from-gray-50.to-gray-100 h3 {
              font-size: 1rem !important; /* text-base */
              font-weight: 700 !important;
              margin: 0 !important;
              padding: 0 !important;
              line-height: normal !important;
              height: auto !important;
            }
            
            /* 결과 미리보기 버튼들 - 원래 크기 유지 */
            .bg-gradient-to-r.from-gray-50.to-gray-100 button {
              padding: 0.375rem 0.625rem !important; /* px-2.5 py-1.5 */
              font-size: 0.75rem !important; /* text-xs */
              font-weight: 600 !important; /* font-semibold */
              border-radius: 0.375rem !important; /* rounded-md */
              margin: 0 !important;
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
              line-height: normal !important;
              display: flex !important;
              align-items: center !important;
              gap: 0.25rem !important; /* gap-1 */
            }
            
            /* 결과 미리보기 버튼 아이콘 - 원래 크기 유지 */
            .bg-gradient-to-r.from-gray-50.to-gray-100 button svg {
              width: 0.875rem !important; /* w-3.5 = 14px */
              height: 0.875rem !important; /* h-3.5 = 14px */
              flex-shrink: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            
            /* 결과 미리보기 버튼 컨테이너 - 원래 크기 유지 */
            .bg-gradient-to-r.from-gray-50.to-gray-100 > div.flex {
              gap: 0.375rem !important; /* gap-1.5 */
              display: flex !important;
              align-items: center !important;
              height: auto !important;
              min-height: auto !important;
              max-height: none !important;
            }
          `
        }} />
      )}
      {/* Header */}
      <header 
        className="bg-gradient-to-r from-[#1e293b] via-[#334155] to-[#1e293b] shadow-xl"
        style={isEditMode ? {
          contain: 'layout style paint',
          isolation: 'isolate',
          position: 'relative',
          zIndex: 9999,
          paddingTop: '0px',
          paddingBottom: '0px',
          paddingLeft: '0px',
          paddingRight: '0px',
          margin: '0px',
          marginTop: '0px',
          marginBottom: '0px',
          marginLeft: '0px',
          marginRight: '0px',
          height: 'auto',
          minHeight: 'auto',
          maxHeight: 'none',
          lineHeight: 'normal',
          boxSizing: 'border-box',
          overflow: 'visible'
        } : {}}
      >
        <div 
          className="container mx-auto px-4 py-2 flex justify-between items-center"
          style={isEditMode ? {
            paddingTop: '0.5rem',
            paddingBottom: '0.5rem',
            paddingLeft: '1rem',
            paddingRight: '1rem',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: 'auto',
            minHeight: 'auto',
            maxHeight: 'none',
            lineHeight: 'normal',
            boxSizing: 'border-box'
          } : {}}
        >
          <div 
            className="flex items-center gap-4"
            style={isEditMode ? {
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              height: 'auto',
              minHeight: 'auto',
              maxHeight: 'none',
              margin: 0,
              padding: 0,
              lineHeight: 'normal',
              boxSizing: 'border-box'
            } : {}}
          >
            {profile?.role === 'admin' && (
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 backdrop-blur-sm text-white text-sm font-semibold rounded-md hover:bg-white/20 transition-colors"
                style={isEditMode ? {
                  padding: '0.375rem 0.625rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  margin: 0,
                  height: 'auto',
                  minHeight: 'auto',
                  maxHeight: 'none',
                  lineHeight: 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  whiteSpace: 'nowrap',
                  boxSizing: 'border-box'
                } : {}}
              >
                <ArrowLeft className="w-3.5 h-3.5" style={isEditMode ? { width: '0.875rem', height: '0.875rem', margin: 0, padding: 0 } : {}} />
                대시보드
              </button>
            )}
            <div 
              className="flex items-center gap-2.5"
              style={isEditMode ? {
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                height: 'auto',
                minHeight: 'auto',
                maxHeight: 'none',
                margin: 0,
                padding: 0,
                lineHeight: 'normal',
                boxSizing: 'border-box'
              } : {}}
            >
              <div 
                className="bg-gradient-to-br from-yellow-400 to-orange-500 p-1.5 rounded-lg shadow-lg"
                style={isEditMode ? {
                  padding: '0.375rem',
                  margin: 0,
                  height: 'auto',
                  minHeight: 'auto',
                  maxHeight: 'none',
                  boxSizing: 'border-box'
                } : {}}
              >
                <Sparkles className="w-5 h-5 text-white" style={isEditMode ? { width: '1.25rem', height: '1.25rem', margin: 0, padding: 0 } : {}} />
              </div>
              <div style={isEditMode ? { margin: 0, padding: 0, height: 'auto', minHeight: 'auto', maxHeight: 'none' } : {}}>
                <h1 
                  className="text-lg font-bold"
                  style={{
                    background: 'linear-gradient(90deg, #60a5fa, #a78bfa, #c084fc, #a78bfa, #60a5fa)',
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    animation: 'shimmer 3s ease-in-out infinite',
                    ...(isEditMode ? {
                      fontSize: '1.125rem',
                      margin: '0',
                      marginTop: '0',
                      marginBottom: '0',
                      padding: '0',
                      fontWeight: '700',
                      lineHeight: '1.5',
                      height: 'auto',
                      minHeight: 'auto',
                      maxHeight: 'none',
                      boxSizing: 'border-box'
                    } : {})
                  }}
                >
                  보험 블로그 AI 생성기
                </h1>
                <p 
                  className="text-xs font-semibold"
                  style={{
                    background: 'linear-gradient(90deg, #fcd34d, #fb923c, #fbbf24, #fb923c, #fcd34d)',
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    animation: 'shimmer 3s ease-in-out infinite',
                    ...(isEditMode ? {
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      margin: '0',
                      padding: '0',
                      lineHeight: '1.5',
                      height: 'auto',
                      minHeight: 'auto',
                      maxHeight: 'none',
                      boxSizing: 'border-box'
                    } : {})
                  }}
                >
                  {profile?.full_name}님 환영합니다
                </p>
              </div>
            </div>
          </div>
          <div 
            className="flex items-center gap-3"
            style={isEditMode ? {
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              height: 'auto',
              minHeight: 'auto',
              maxHeight: 'none',
              margin: 0,
              padding: 0,
              lineHeight: 'normal',
              boxSizing: 'border-box'
            } : {}}
          >
            {profile?.role === 'admin' && (
              <button
                onClick={() => router.push('/admin/users')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-600 text-white text-sm font-semibold rounded-md hover:bg-purple-700 transition-colors"
                style={isEditMode ? {
                  padding: '0.375rem 0.625rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  margin: 0,
                  height: 'auto',
                  minHeight: 'auto',
                  maxHeight: 'none',
                  lineHeight: 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  whiteSpace: 'nowrap',
                  boxSizing: 'border-box'
                } : {}}
              >
                <UserCheck className="w-3.5 h-3.5" style={isEditMode ? { width: '0.875rem', height: '0.875rem', margin: 0, padding: 0 } : {}} />
                회원관리
              </button>
            )}
            <form 
              action="/api/auth/signout" 
              method="post"
              style={isEditMode ? {
                margin: 0,
                padding: 0,
                display: 'inline-block',
                height: 'auto',
                minHeight: 'auto',
                maxHeight: 'none',
                boxSizing: 'border-box'
              } : {}}
            >
              <button
                type="submit"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 backdrop-blur-sm text-white text-sm font-semibold rounded-md hover:bg-white/20 transition-colors"
                style={isEditMode ? {
                  padding: '0.375rem 0.625rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  margin: 0,
                  height: 'auto',
                  minHeight: 'auto',
                  maxHeight: 'none',
                  lineHeight: 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  whiteSpace: 'nowrap',
                  boxSizing: 'border-box'
                } : {}}
              >
                <LogOut className="w-3.5 h-3.5" style={isEditMode ? { width: '0.875rem', height: '0.875rem', margin: 0, padding: 0 } : {}} />
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-2">
        {/* 탭 네비게이션 */}
        <div className="max-w-7xl mx-auto mb-3">
          <div className="bg-white rounded-xl shadow-lg p-1.5 flex gap-1.5">
            <button
              onClick={() => setActiveTab('write')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'write'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              ✨ 새 글 쓰기
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <History className="w-4 h-4" />
              📚 내 글 목록
            </button>
            <button
              onClick={() => setActiveTab('qa')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'qa'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              💬 Q&A 생성기
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'stats'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              📊 통계
            </button>
            <button
              onClick={() => setActiveTab('approval')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'approval'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              📋 심의필 만들기
            </button>
            <button
              onClick={() => setActiveTab('image-analysis')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'image-analysis'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              🏥 전문 이미지 분석기
            </button>
          </div>
        </div>

        {/* 탭 콘텐츠 */}
        {activeTab === 'write' && (
        <div className="blog-generator-container grid lg:grid-cols-5 gap-6" style={{ 
          contain: 'layout style paint',
          isolation: 'isolate',
          position: 'relative',
          zIndex: 1,
          alignItems: 'stretch'
        }}>
          
          {/* 왼쪽 패널 - 입력 폼 (40%) */}
          <div className="lg:col-span-2 space-y-4 flex flex-col">
            
            {/* 템플릿 선택 */}
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h3 className="text-base font-bold text-[#1e293b] mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-500" />
                템플릿 선택
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className={`p-2 rounded-lg border-2 transition-all min-h-[75px] flex flex-col items-center justify-center ${
                      formData.template === template.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow'
                    }`}
                  >
                    <div className="text-2xl mb-1 flex-shrink-0">{template.icon}</div>
                    <div className="text-[10px] font-semibold text-gray-700 text-center leading-tight break-words px-0.5">{template.name}</div>
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

                {/* 제안서 이미지 업로드 (선택) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    제안서 이미지 (선택)
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleDesignSheetUpload}
                      disabled={isGenerating}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isGenerating}
                      className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors text-sm text-gray-700 text-left"
                    >
                      {formData.designSheetImage ? '제안서 이미지 첨부됨' : '선택된 파일 없음'}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isGenerating || isAnalyzingDesignSheet}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-semibold whitespace-nowrap flex items-center gap-1.5"
                    >
                      {isAnalyzingDesignSheet ? (
                        <>
                          <Clock className="w-4 h-4 animate-spin" />
                          분석 중...
                        </>
                      ) : (
                        '📎 첨부'
                      )}
                    </button>
                  </div>
                  {isAnalyzingDesignSheet && (
                    <p className="text-base font-semibold text-blue-600 mt-2 flex items-center gap-2">
                      <Clock className="w-5 h-5 animate-spin" />
                      제안서 분석 중...
                    </p>
                  )}
                  {formData.designSheetImage && formData.designSheetAnalysis && !isAnalyzingDesignSheet && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ 제안서가 분석되었습니다. 글 생성 시 제안서 내용이 포함됩니다.
                    </p>
                  )}
                </div>

                {/* 생성 버튼 */}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || isAnalyzingDesignSheet || (!formData.topic && !formData.designSheetImage)}
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
          <div className="lg:col-span-3 bg-white rounded-xl shadow-lg flex flex-col" style={{ 
            contain: 'layout style paint',
            isolation: 'isolate',
            position: 'relative',
            zIndex: 1,
            minHeight: 0,
            maxHeight: '100%'
          }}>
            {/* 액션 버튼 바 */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2 border-b flex justify-between items-center flex-shrink-0">
              <h3 className="text-base font-bold text-gray-800">결과 미리보기</h3>
              {generatedHTML && (
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md transition-colors text-xs font-semibold ${
                      isEditMode 
                        ? 'bg-purple-600 text-white hover:bg-purple-700' 
                        : 'bg-purple-500 text-white hover:bg-purple-600'
                    }`}
                  >
                    ✏️ {isEditMode ? '편집완료' : '편집'}
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-semibold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    저장
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-700 text-white rounded-md hover:bg-gray-800 transition-colors text-xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    복사
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    PDF
                  </button>
                  {sources.length > 0 && (
                    <button
                      onClick={handleDownloadSources}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors text-xs"
                      title="사용된 출처 목록 다운로드"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      출처
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 미리보기 영역 */}
            <div className="flex flex-col min-h-0 flex-1" style={{ 
              contain: 'layout style paint',
              isolation: 'isolate',
              position: 'relative',
              zIndex: 1,
              overflow: 'hidden'
            }}>
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
                <div className="flex-1 flex flex-col min-h-0" style={{ 
                  contain: 'layout style paint',
                  isolation: 'isolate',
                  position: 'relative',
                  zIndex: 1
                }}>
                  {isEditMode ? (
                    <div className="p-4 flex-1 min-h-0" style={{ 
                      contain: 'layout style paint',
                      isolation: 'isolate',
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden'
                    }}>
                      {/* 편집 도구 바 */}
                      <div className="bg-white rounded-lg p-1.5 border-2 border-purple-300 shadow-md mb-1.5 flex-shrink-0">
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
                      {/* 편집 가능한 미리보기 - 비편집모드 iframe과 완전히 동일한 구조 */}
                      <div 
                        className="w-full border-0 rounded-lg bg-white flex-1"
                        style={{ 
                          contain: 'layout style paint',
                          isolation: 'isolate',
                          position: 'relative',
                          zIndex: 1,
                          width: '100%',
                          minHeight: 0,
                          flex: '1 1 0',
                          overflow: 'auto'
                        }}
                      >
                        <div
                          className="blog-editor bg-white rounded-lg p-6 w-full border-2 border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          contentEditable
                          spellCheck={false}
                          suppressContentEditableWarning={true}
                          ref={(el) => {
                            if (el && isEditMode) {
                              el.focus()
                              // 편집 모드 진입 시 스타일 격리 강제 적용
                              if (el) {
                                el.style.isolation = 'isolate'
                                el.style.contain = 'layout style paint'
                                el.style.position = 'relative'
                                el.style.zIndex = '1'
                                el.style.height = 'auto'
                                el.style.maxHeight = 'none'
                                // 블로그 편집 영역의 스타일이 헤더에 영향을 주지 않도록
                                const style = document.createElement('style')
                                style.textContent = `
                                  .blog-editor * {
                                    box-sizing: border-box !important;
                                  }
                                `
                                if (!document.head.querySelector('style[data-blog-editor-isolation]')) {
                                  style.setAttribute('data-blog-editor-isolation', 'true')
                                  document.head.appendChild(style)
                                }
                              }
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
                            minHeight: 0,
                            height: 'auto',
                            maxHeight: 'none',
                            display: 'block',
                            isolation: 'isolate',
                            contain: 'layout style paint',
                            position: 'relative',
                            zIndex: 1
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 flex-1 min-h-0" style={{ 
                      contain: 'layout style paint',
                      isolation: 'isolate',
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden'
                    }}>
                      <iframe
                        srcDoc={generatedHTML}
                        className="w-full border-0 rounded-lg bg-white flex-1"
                        title="미리보기"
                        style={{ width: '100%', minHeight: 0, flex: '1 1 0', overflow: 'auto' }}
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

        {/* Q&A 생성기 탭 */}
        {activeTab === 'qa' && (
        <div className="qa-generator-wrapper" style={{ 
          contain: 'layout style paint',
          isolation: 'isolate',
          position: 'relative',
          zIndex: 1
        }}>
          <QAGenerator profile={profile} />
        </div>
        )}

        {/* 전문 이미지 분석기 탭 */}
        {activeTab === 'image-analysis' && (
        <div className="max-w-5xl mx-auto">
          <ImageAnalyzer profile={profile} />
        </div>
        )}
      </main>
    </div>
  )
}

// 전문 이미지 분석기 컴포넌트
function ImageAnalyzer({ profile }: { profile: Profile | null }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = () => {
    fileInputRef.current?.click()
  }

  const processImageFile = async (file: File) => {
    // 이미지 파일만 허용
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.')
      return
    }

    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64String = reader.result as string
      setSelectedImage(base64String)
      setAnalysisResult(null)
      setError(null)
      
      // 자동으로 분석 시작
      await handleAnalyze(base64String)
    }
    reader.readAsDataURL(file)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await processImageFile(file)
  }

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      await processImageFile(file)
    }
  }

  const handleAnalyze = async (imageBase64?: string) => {
    const imageToAnalyze = imageBase64 || selectedImage
    if (!imageToAnalyze) {
      alert('이미지를 먼저 업로드해주세요.')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/analyze-medical-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageBase64: imageToAnalyze }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '이미지 분석 중 오류가 발생했습니다.')
      }

      if (data.success) {
        setAnalysisResult(data.data)
      } else {
        throw new Error('분석 결과를 받아오지 못했습니다.')
      }
    } catch (error: any) {
      console.error('이미지 분석 오류:', error)
      setError(error.message || '이미지 분석 중 오류가 발생했습니다.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('복사되었습니다!')
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
        <ImageIcon className="w-7 h-7 text-blue-600" />
        전문 이미지 분석기
      </h2>

      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          의료 영수증(진료비 세부산정내역서) 또는 병리 검사 보고서 이미지를 업로드하면, 
          질병명, 보험금 계산, 고객 설명 가이드를 자동으로 생성해드립니다.
        </p>

        {/* 이미지 업로드 영역 */}
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            isDragging 
              ? 'border-blue-500 bg-blue-50 scale-[1.02]' 
              : 'border-gray-300 hover:border-blue-400 bg-white'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          
          {!selectedImage ? (
            <div>
              <ImageIcon className={`w-16 h-16 mx-auto mb-4 transition-colors ${
                isDragging ? 'text-blue-500' : 'text-gray-400'
              }`} />
              <p className={`mb-2 transition-colors ${
                isDragging ? 'text-blue-700 font-semibold' : 'text-gray-600'
              }`}>
                {isDragging ? '📎 여기에 이미지를 놓아주세요' : '이미지를 드래그 앤 드롭하거나 선택하세요'}
              </p>
              <button
                onClick={handleImageSelect}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
              >
                📁 이미지 선택
              </button>
            </div>
          ) : (
            <div>
              <img
                src={selectedImage}
                alt="업로드된 이미지"
                className="max-w-full max-h-96 mx-auto mb-4 rounded-lg shadow-md"
              />
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleImageSelect}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  🔄 다른 이미지 선택
                </button>
                {!isAnalyzing && (
                  <button
                    onClick={() => handleAnalyze()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    🔍 다시 분석
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 분석 중 */}
      {isAnalyzing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-700 font-semibold">이미지를 분석하고 있습니다...</p>
          <p className="text-blue-600 text-sm mt-2">잠시만 기다려주세요.</p>
        </div>
      )}

      {/* 오류 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 font-semibold">오류 발생</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* 분석 결과 */}
      {analysisResult && !isAnalyzing && (
        <div className="space-y-6">
          {/* 문서 정보 */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              📄 문서 정보
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">문서 종류</p>
                <p className="font-semibold text-gray-800">{analysisResult.documentType || '미확인'}</p>
              </div>
              {analysisResult.patientInfo?.name && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">환자명</p>
                  <p className="font-semibold text-gray-800">{analysisResult.patientInfo.name}</p>
                </div>
              )}
              {analysisResult.medicalInfo?.hospitalName && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">병원명</p>
                  <p className="font-semibold text-gray-800">{analysisResult.medicalInfo.hospitalName}</p>
                </div>
              )}
              {analysisResult.medicalInfo?.diagnosis && analysisResult.medicalInfo.diagnosis.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">진단명</p>
                  <p className="font-semibold text-gray-800">
                    {analysisResult.medicalInfo.diagnosis.join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 진료비 정보 */}
          {analysisResult.expenses && Object.keys(analysisResult.expenses).length > 0 && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                💰 진료비 정보
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                {analysisResult.expenses.totalAmount && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">총 진료비</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {parseInt(analysisResult.expenses.totalAmount).toLocaleString()}원
                    </p>
                  </div>
                )}
                {analysisResult.expenses.patientShare && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">본인부담금</p>
                    <p className="text-2xl font-bold text-red-600">
                      {parseInt(analysisResult.expenses.patientShare).toLocaleString()}원
                    </p>
                  </div>
                )}
                {analysisResult.expenses.coveredAmount && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">급여 총액 (공단 부담)</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {parseInt(analysisResult.expenses.coveredAmount).toLocaleString()}원
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 보험금 분석 */}
          {analysisResult.insuranceAnalysis && Object.keys(analysisResult.insuranceAnalysis).length > 0 && (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                🏥 보험금 분석
              </h3>
              {analysisResult.insuranceAnalysis.applicableInsurance && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">적용 가능한 보험</p>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.insuranceAnalysis.applicableInsurance.map((insurance: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold"
                      >
                        {insurance}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {analysisResult.insuranceAnalysis.estimatedInsuranceAmount && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">예상 보험금</p>
                  <p className="text-3xl font-bold text-purple-700">
                    {typeof analysisResult.insuranceAnalysis.estimatedInsuranceAmount === 'string' 
                      ? analysisResult.insuranceAnalysis.estimatedInsuranceAmount
                      : parseInt(analysisResult.insuranceAnalysis.estimatedInsuranceAmount).toLocaleString() + '원'}
                  </p>
                </div>
              )}
              {analysisResult.insuranceAnalysis.calculationBasis && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">계산 근거</p>
                  <p className="text-gray-800">{analysisResult.insuranceAnalysis.calculationBasis}</p>
                </div>
              )}
              {analysisResult.insuranceAnalysis.notes && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">특이사항</p>
                  <p className="text-gray-800">{analysisResult.insuranceAnalysis.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* 고객 설명 가이드 */}
          {analysisResult.customerGuidance && Object.keys(analysisResult.customerGuidance).length > 0 && (
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                💬 고객 설명 가이드
              </h3>
              {analysisResult.customerGuidance.explanation && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">설명 내용</p>
                  <div className="bg-white rounded-lg p-4 border border-yellow-200">
                    <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {analysisResult.customerGuidance.explanation}
                    </p>
                    <button
                      onClick={() => handleCopy(analysisResult.customerGuidance.explanation)}
                      className="mt-3 px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-sm hover:bg-yellow-200 transition-colors"
                    >
                      📋 복사
                    </button>
                  </div>
                </div>
              )}
              {analysisResult.customerGuidance.nextSteps && analysisResult.customerGuidance.nextSteps.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">다음 단계</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-800">
                    {analysisResult.customerGuidance.nextSteps.map((step: string, idx: number) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
              {analysisResult.customerGuidance.importantNotes && analysisResult.customerGuidance.importantNotes.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">주의사항</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-800">
                    {analysisResult.customerGuidance.importantNotes.map((note: string, idx: number) => (
                      <li key={idx} className="text-orange-700">{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Q&A 생성기 컴포넌트
function QAGenerator({ profile }: { profile: Profile | null }) {
  const [qaFormData, setQAFormData] = useState({
    productName: '',
    targetPersona: '30대 직장인 남성',
    worryPoint: '',
    sellingPoint: '',
    feelingTone: '고민',
    answerTone: 'friendly',
    customerStyle: 'curious', // 고객 스타일: 'friendly' | 'cold' | 'brief' | 'curious'
    designSheetImage: '' as string | null
  })
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generatedQuestion, setGeneratedQuestion] = useState<{ title: string; content: string } | null>(null)
  const [generatedAnswer, setGeneratedAnswer] = useState<string | null>(null)
  const [conversationThread, setConversationThread] = useState<Array<{ role: 'customer' | 'agent'; content: string; step: number }>>([])
  const [conversationMode, setConversationMode] = useState(false)
  const [conversationLength, setConversationLength] = useState(8)
  // ⚠️ 테스트용: 토큰 사용량 추적 (실제 운영 시 제거 필요)
  const [tokenUsage, setTokenUsage] = useState<{ promptTokens: number; candidatesTokens: number; totalTokens: number; breakdown?: Array<{ promptTokens: number; candidatesTokens: number; totalTokens: number }> } | null>(null)
  const [currentStep, setCurrentStep] = useState<'question' | 'answer' | 'complete'>('question')

  const handleQAChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setQAFormData(prev => ({ ...prev, [name]: value }))
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64String = reader.result as string
      setQAFormData(prev => ({ ...prev, designSheetImage: base64String }))
      
      // 설계서 이미지 업로드 시 자동으로 분석 및 Q&A 생성
      setTimeout(async () => {
        await handleAnalyzeAndGenerate(base64String)
      }, 500)
    }
    reader.readAsDataURL(file)
  }

  const handleAnalyzeAndGenerate = async (imageBase64?: string) => {
    const imageToAnalyze = imageBase64 || qaFormData.designSheetImage
    
    if (!imageToAnalyze) {
      alert('설계서 이미지를 먼저 업로드해주세요!')
      return
    }

    setIsAnalyzing(true)
    setIsGenerating(true)
    setProgress(0)
    setCurrentStep('question')

    try {
      // Step 1: 설계서 분석
      const analyzeResponse = await fetch('/api/analyze-design-sheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: imageToAnalyze
        }),
      })

      const analyzeData = await analyzeResponse.json()

      if (!analyzeResponse.ok) {
        throw new Error(analyzeData.error || '분석 오류')
      }

      // 분석 결과로 폼 자동 채우기
      const updatedFormData = {
        ...qaFormData,
        productName: analyzeData.data.productName,
        targetPersona: analyzeData.data.targetPersona,
        worryPoint: analyzeData.data.worryPoint,
        sellingPoint: analyzeData.data.sellingPoint,
        designSheetImage: imageToAnalyze,
        designSheetAnalysis: {
          premium: analyzeData.data.premium || '',
          coverages: analyzeData.data.coverages || [],
          specialClauses: analyzeData.data.specialClauses || []
        }
      }
      
      setQAFormData(updatedFormData)
      setProgress(30)

      // Step 2: Q&A 자동 생성
      const qaResponse = await fetch('/api/generate-qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...updatedFormData,
          conversationMode: conversationMode,
          conversationLength: conversationMode ? conversationLength : undefined
        }),
      })

      const qaData = await qaResponse.json()

      if (!qaResponse.ok) {
        throw new Error(qaData.error || 'Q&A 생성 오류')
      }

      setProgress(100)
      
      setGeneratedQuestion({
        title: qaData.question.title,
        content: qaData.question.content
      })
      setGeneratedAnswer(qaData.answer.content)
      setConversationThread(qaData.conversation || [])
      // ⚠️ 테스트용: 실제 운영 시 제거 필요
      setTokenUsage(qaData.tokenUsage || null)
      setCurrentStep('complete')
      
      alert('설계서 분석 및 Q&A 생성이 완료되었습니다!')
    } catch (error: any) {
      console.error('설계서 분석/생성 오류:', error)
      alert('처리 중 오류가 발생했습니다: ' + error.message)
    } finally {
      setIsAnalyzing(false)
      setIsGenerating(false)
      setProgress(0)
    }
  }

  const handleAnalyzeDesignSheet = async () => {
    // 설계서만 분석하고 Q&A 생성은 하지 않음
    if (!qaFormData.designSheetImage) {
      alert('설계서 이미지를 먼저 업로드해주세요!')
      return
    }

    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/analyze-design-sheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: qaFormData.designSheetImage
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '분석 오류')
      }

      // 분석 결과로 폼 자동 채우기
      setQAFormData(prev => ({
        ...prev,
        productName: data.data.productName,
        targetPersona: data.data.targetPersona,
        worryPoint: data.data.worryPoint,
        sellingPoint: data.data.sellingPoint
      }))

      alert('설계서 분석이 완료되었습니다! 폼이 자동으로 채워졌습니다.')
    } catch (error: any) {
      console.error('설계서 분석 오류:', error)
      alert('설계서 분석 중 오류가 발생했습니다: ' + error.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleRandomGenerate = async () => {
    // 랜덤 프리셋 데이터 (실제 많이 검색되는 보험 상품들)
    const randomPresets = [
      {
        productName: '삼성생명 실손의료비보험',
        targetPersona: '30대 직장인 남성',
        worryPoint: '실손보험료가 매월 부담스러운데, 보장 범위가 충분한지 궁금합니다. 현재 보험료로 적절한 보장을 받을 수 있을까요?',
        sellingPoint: '실손보험료가 합리적이고, 보장 범위가 넓으며, 특약 구성이 탄탄합니다'
      },
      {
        productName: '한화생명 종신보험',
        targetPersona: '40대 직장인 남성',
        worryPoint: '가족을 위한 보장이 필요한데, 종신보험과 정기보험 중 어떤 게 나을지 고민입니다. 보험료도 부담스러워서 망설여집니다.',
        sellingPoint: '종신보험의 안정성과 보장의 완결성을 제공하며, 해지환급금도 있어 장기적으로 유리합니다'
      },
      {
        productName: '교보생명 암보험',
        targetPersona: '30대 직장인 여성',
        worryPoint: '암 진단비와 수술비가 걱정되어 암보험을 고려하고 있습니다. 현재 보험료로 충분한 보장을 받을 수 있을까요?',
        sellingPoint: '암 진단비, 수술비, 입원비를 종합적으로 보장하며, 암 2차 진단비까지 포함되어 있습니다'
      },
      {
        productName: 'DB손해보험 자동차보험',
        targetPersona: '30대 직장인 남성',
        worryPoint: '자동차보험 가입 시 어떤 특약이 필요한지, 현재 보험료가 합리적인지 확인하고 싶습니다.',
        sellingPoint: '자기차량 손해, 대인배상, 대물배상을 모두 보장하며, 보험료 대비 보장 범위가 우수합니다'
      },
      {
        productName: '삼성화재 실손보험',
        targetPersona: '20대 직장인',
        worryPoint: '신입 직장인이라 돈이 없는데 실손보험은 꼭 들어야 하는가요? 저렴하게 가입할 수 있는 방법이 있을까요?',
        sellingPoint: '보험료가 저렴하면서도 입원, 통원, 처방 약제비를 모두 보장하며, 특히 청년층에 맞춘 상품입니다'
      },
      {
        productName: '신한생명 종합건강보험',
        targetPersona: '30대 직장인 여성',
        worryPoint: '실손보험, 암보험, 질병보험을 따로 들어야 할까요? 하나로 합쳐서 들 수 있는 상품이 있을까요?',
        sellingPoint: '실손, 암, 질병보험을 통합한 상품으로 보험료 절감 효과가 있고, 관리도 편리합니다'
      },
      {
        productName: 'KB생명 연금보험',
        targetPersona: '40대 직장인 남성',
        worryPoint: '노후 준비를 위해 연금보험을 고려하고 있는데, 확정형과 변액형 중 어떤 게 나을까요? 현재 보험료로 충분한 연금을 받을 수 있을까요?',
        sellingPoint: '확정형 연금으로 안정적인 노후 자금을 보장하며, 해지환급금도 있어 유연한 운영이 가능합니다'
      },
      {
        productName: '현대해상 화재보험',
        targetPersona: '30대 신혼부부',
        worryPoint: '아파트 구매 후 화재보험을 들어야 하는데, 어떤 보장이 필요한지 모르겠어요. 기본 상품으로 충분한가요?',
        sellingPoint: '화재, 자연재해, 배관누수 등을 종합적으로 보장하며, 가전제품 파손까지 포함되어 있습니다'
      },
      {
        productName: '메리츠화재 치아보험',
        targetPersona: '30대 직장인',
        worryPoint: '임플란트나 보철치료 비용이 너무 비싸서 치아보험을 고려 중입니다. 실제로 보장받을 수 있는 금액이 궁금해요.',
        sellingPoint: '임플란트, 보철치료를 충분히 보장하며, 정기 검진비까지 포함되어 치과 치료비 부담을 크게 줄여줍니다'
      },
      {
        productName: '미래에셋생명 어린이보험',
        targetPersona: '30대 부모',
        worryPoint: '아이가 태어났는데 자녀보험을 언제 들여야 할까요? 보험료가 부담스러운데 꼭 필요한가요?',
        sellingPoint: '어린이 질병, 상해사고를 보장하며, 교육비 확보까지 가능한 상품으로 자녀의 미래를 준비할 수 있습니다'
      },
      {
        productName: '교보생명 간병인보험',
        targetPersona: '50대 직장인',
        worryPoint: '부모님 연세가 많아져서 간병비가 걱정됩니다. 간병인보험이 실제로 도움이 될까요? 보험료가 부담스러워서 고민입니다.',
        sellingPoint: '간병인 비용, 요양보호사 비용을 보장하며, 장기요양 등급에 따라 추가 보험금을 지급하여 부담을 줄여줍니다'
      },
      {
        productName: '삼성생명 중대질병보험',
        targetPersona: '40대 직장인 남성',
        worryPoint: '뇌졸중, 심근경색 같은 중대질병이 걱정되는데, 암보험만으로는 부족할까요? 중대질병보험을 따로 들어야 하나요?',
        sellingPoint: '뇌졸중, 심근경색, 관상동맥우회술 등 중대질병을 보장하며, 진단비는 물론 수술비, 입원비까지 종합 보장합니다'
      },
      {
        productName: '한화생명 실비보험',
        targetPersona: '20대 직장인',
        worryPoint: '병원비가 부담스러워서 실비보험을 알아보고 있어요. 실손보험과 실비보험의 차이가 뭔가요?',
        sellingPoint: '입원, 통원, 처방 약제비를 실제 발생한 금액만큼 보장하며, 특히 비급여 항목까지 보장하여 부담을 줄여줍니다'
      },
      {
        productName: 'DB손해보험 상해보험',
        targetPersona: '20대 대학생',
        worryPoint: '교통사고나 각종 사고에 대한 보장이 필요한데, 가격도 저렴한지 궁금합니다. 알뜰하게 가입하고 싶어요.',
        sellingPoint: '상해 사망/후유장해를 보장하며, 보험료가 저렴하면서도 실질적인 보장을 제공합니다'
      },
      {
        productName: '현대해상 여행자보험',
        targetPersona: '30대 직장인',
        worryPoint: '해외여행을 가는데 여행자보험이 필수인가요? 어떤 보장이 필요할까요?',
        sellingPoint: '해외 질병, 상해 사고를 보장하며, 여행 취소/지연, 휴대품 분실까지 보장하여 안심하고 여행할 수 있습니다'
      }
    ]

    const randomPreset = randomPresets[Math.floor(Math.random() * randomPresets.length)]
    
    setQAFormData(prev => ({
      ...prev,
      ...randomPreset,
      feelingTone: ['고민', '급함', '궁금', '불안'][Math.floor(Math.random() * 4)],
      answerTone: ['friendly', 'expert', 'comparative', 'persuasive'][Math.floor(Math.random() * 4)]
    }))

    // 생성된 결과 초기화
    setGeneratedQuestion(null)
    setGeneratedAnswer(null)
  }

  const handleGenerateQA = async () => {
    if (!qaFormData.productName || !qaFormData.worryPoint || !qaFormData.sellingPoint) {
      alert('필수 입력 항목을 모두 입력해주세요!')
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setGeneratedQuestion(null)
    setGeneratedAnswer(null)
    setConversationThread([])
    // ⚠️ 테스트용: 실제 운영 시 제거 필요
    setTokenUsage(null)
    setCurrentStep('question')

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
      const response = await fetch('/api/generate-qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...qaFormData,
          conversationMode: conversationMode,
          conversationLength: conversationMode ? conversationLength : undefined
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'API 오류')
      }

      clearInterval(progressInterval)
      setProgress(100)
      
      setGeneratedQuestion({
        title: data.question.title,
        content: data.question.content
      })
      setGeneratedAnswer(data.answer.content)
      setConversationThread(data.conversation || [])
      // ⚠️ 테스트용: 실제 운영 시 제거 필요
      setTokenUsage(data.tokenUsage || null)
      setCurrentStep('complete')
    } catch (error: any) {
      console.error('Q&A 생성 오류:', error)
      alert('Q&A 생성 중 오류가 발생했습니다: ' + error.message)
    } finally {
      setIsGenerating(false)
      setProgress(0)
    }
  }

  const handleCopyQuestion = () => {
    if (!generatedQuestion) return
    const text = `${generatedQuestion.title}\n\n${generatedQuestion.content}`
    navigator.clipboard.writeText(text)
    alert('질문이 클립보드에 복사되었습니다!')
  }

  const handleCopyAnswer = () => {
    if (!generatedAnswer) return
    navigator.clipboard.writeText(generatedAnswer)
    alert('답변이 클립보드에 복사되었습니다!')
  }

  const handleRegenerateQuestion = async () => {
    if (!qaFormData.productName || !qaFormData.worryPoint || !qaFormData.sellingPoint) return
    
    setIsGenerating(true)
    setProgress(0)
    // ⚠️ 테스트용: 실제 운영 시 제거 필요
    setTokenUsage(null)
    setCurrentStep('question')

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 45) {
          clearInterval(progressInterval)
          return 45
        }
        return prev + 10
      })
    }, 200)

    try {
      const response = await fetch('/api/generate-qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...qaFormData,
          conversationMode: conversationMode,
          conversationLength: conversationMode ? conversationLength : undefined
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'API 오류')
      }

      clearInterval(progressInterval)
      setProgress(100)
      
      setGeneratedQuestion({
        title: data.question.title,
        content: data.question.content
      })
      
      // 답변도 함께 업데이트
      setGeneratedAnswer(data.answer.content)
      setConversationThread(data.conversation || [])
      // ⚠️ 테스트용: 실제 운영 시 제거 필요
      setTokenUsage(data.tokenUsage || null)
      setCurrentStep('complete')
    } catch (error: any) {
      console.error('질문 재생성 오류:', error)
      alert('질문 재생성 중 오류가 발생했습니다: ' + error.message)
    } finally {
      setIsGenerating(false)
      setProgress(0)
    }
  }

  const handleRegenerateAnswer = async () => {
    if (!generatedQuestion) return
    
    setIsGenerating(true)
    setProgress(50)
    // ⚠️ 테스트용: 실제 운영 시 제거 필요
    setTokenUsage(null)
    setCurrentStep('answer')

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 10
      })
    }, 200)

    try {
      // Step 2만 재생성 (질문 내용 포함)
      const response = await fetch('/api/generate-qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...qaFormData,
          questionTitle: generatedQuestion.title,
          questionContent: generatedQuestion.content,
          conversationMode: conversationMode,
          conversationLength: conversationMode ? conversationLength : undefined
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'API 오류')
      }

      clearInterval(progressInterval)
      setProgress(100)
      
      setGeneratedAnswer(data.answer.content)
      setConversationThread(data.conversation || [])
      // ⚠️ 테스트용: 실제 운영 시 제거 필요
      setTokenUsage(data.tokenUsage || null)
      setCurrentStep('complete')
    } catch (error: any) {
      console.error('답변 재생성 오류:', error)
      alert('답변 재생성 중 오류가 발생했습니다: ' + error.message)
    } finally {
      setIsGenerating(false)
      setProgress(0)
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-blue-600" />
          💬 보험카페 Q&A 생성기
        </h2>

        {/* 입력 폼 */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                상품명 *
              </label>
              <input
                type="text"
                name="productName"
                value={qaFormData.productName}
                onChange={handleQAChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 삼성생명 실손보험"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                타겟 고객 *
              </label>
              <select
                name="targetPersona"
                value={qaFormData.targetPersona}
                onChange={handleQAChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="30대 직장인 남성">30대 직장인 남성</option>
                <option value="30대 직장인 여성">30대 직장인 여성</option>
                <option value="40대 직장인 남성">40대 직장인 남성</option>
                <option value="40대 주부">40대 주부</option>
                <option value="신혼부부">신혼부부</option>
                <option value="50대 직장인">50대 직장인</option>
                <option value="자녀 있는 가족">자녀 있는 가족</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                핵심 고민 *
              </label>
              <textarea
                name="worryPoint"
                value={qaFormData.worryPoint}
                onChange={handleQAChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="예: 보험료가 적당한지, 보장 범위가 충분한지 궁금합니다"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                답변 강조 포인트 *
              </label>
              <textarea
                name="sellingPoint"
                value={qaFormData.sellingPoint}
                onChange={handleQAChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="예: 보장 범위가 넓고, 보험료 대비 합리적이며, 특약 구성이 탄탄함"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                질문 감정 톤
              </label>
              <select
                name="feelingTone"
                value={qaFormData.feelingTone}
                onChange={handleQAChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="고민">고민</option>
                <option value="급함">급함</option>
                <option value="궁금">궁금</option>
                <option value="불안">불안</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                답변 톤
              </label>
              <select
                name="answerTone"
                value={qaFormData.answerTone}
                onChange={handleQAChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="friendly">친절한</option>
                <option value="expert">전문적인</option>
                <option value="comparative">비교형</option>
                <option value="persuasive">설득형</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                고객 스타일
              </label>
              <select
                name="customerStyle"
                value={qaFormData.customerStyle}
                onChange={handleQAChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="curious">궁금해서 물어보는 (추천)</option>
                <option value="cold">차갑고 거리감 있는</option>
                <option value="brief">간결하고 직설적인</option>
                <option value="friendly">정중하지만 거리감 있는</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {qaFormData.customerStyle === 'curious' && '정말 모르는 게 있어서 궁금해서 물어보는 자연스러운 톤'}
                {qaFormData.customerStyle === 'cold' && '설계사에게 거리감을 두고 차갑게 질문하는 톤'}
                {qaFormData.customerStyle === 'brief' && '불필요한 말 없이 핵심만 간결하게 물어보는 톤'}
                {qaFormData.customerStyle === 'friendly' && '정중하지만 친근하지 않고 거리감을 두는 톤'}
              </p>
            </div>

            {/* 대화형 모드 옵션 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="conversationMode"
                  checked={conversationMode}
                  onChange={(e) => setConversationMode(e.target.checked)}
                  disabled={isGenerating || isAnalyzing}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="conversationMode" className="text-sm font-semibold text-gray-700 cursor-pointer">
                  💬 대화형 Q&A 생성 (댓글 형식)
                </label>
              </div>
              {conversationMode && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-2">
                    대화 횟수: {conversationLength}개
                  </label>
                  <div className="flex gap-2">
                    {[6, 8, 10, 12].map((length) => (
                      <button
                        key={length}
                        type="button"
                        onClick={() => setConversationLength(length)}
                        disabled={isGenerating || isAnalyzing}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                          conversationLength === length
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {length}개
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    첫 답변 이후 {conversationLength - 2}개의 추가 댓글이 생성됩니다 (고객 질문 + 설계사 답변). 항상 설계사가 마무리합니다.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                설계서 이미지 (선택)
              </label>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isAnalyzing || isGenerating}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                {qaFormData.designSheetImage && (
                  <button
                    onClick={handleAnalyzeDesignSheet}
                    disabled={isAnalyzing || isGenerating}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-semibold whitespace-nowrap"
                  >
                    {isAnalyzing ? (
                      <>
                        <Clock className="w-4 h-4 inline mr-1 animate-spin" />
                        분석중...
                      </>
                    ) : (
                      '📄 분석만'
                    )}
                  </button>
                )}
              </div>
              {qaFormData.designSheetImage && !isAnalyzing && !isGenerating && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ 이미지가 첨부되었습니다. 이미지 업로드 시 자동으로 분석 및 Q&A가 생성됩니다.
                </p>
              )}
              {(isAnalyzing || isGenerating) && (
                <p className="text-xs text-blue-600 mt-1">
                  🔄 설계서 분석 및 Q&A 생성 중...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 생성 버튼들 */}
        <div className="flex gap-3">
          <button
            onClick={handleGenerateQA}
            disabled={isGenerating || !qaFormData.productName || !qaFormData.worryPoint || !qaFormData.sellingPoint}
            className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
          >
            {isGenerating ? (
              <>
                <Clock className="w-5 h-5 animate-spin" />
                {currentStep === 'question' ? '질문 생성 중...' : currentStep === 'answer' ? '답변 생성 중...' : '생성 중...'} ({progress}%)
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                💬 Q&A 생성하기
              </>
            )}
          </button>
          <button
            onClick={handleRandomGenerate}
            disabled={isGenerating || isAnalyzing}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl whitespace-nowrap"
          >
            <Sparkles className="w-5 h-5" />
            🎲 정말 귀찮다
          </button>
        </div>
      </div>

      {/* 결과 미리보기 */}
      {(generatedQuestion || generatedAnswer) && (
        <div className="space-y-6">
          {/* ⚠️ 테스트용: 토큰 사용량 표시 (실제 운영 시 이 전체 블록 제거 필요) */}
          {tokenUsage && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📊</span>
                  <h3 className="text-sm font-bold text-gray-800">토큰 사용량</h3>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {tokenUsage.totalTokens.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600">총 토큰</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-blue-200">
                <div>
                  <div className="text-xs text-gray-600 mb-1">입력 토큰</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {tokenUsage.promptTokens.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">출력 토큰</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {tokenUsage.candidatesTokens.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">총 토큰</div>
                  <div className="text-lg font-semibold text-blue-600">
                    {tokenUsage.totalTokens.toLocaleString()}
                  </div>
                </div>
              </div>
              {tokenUsage.breakdown && tokenUsage.breakdown.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                    단계별 상세 보기 ({tokenUsage.breakdown.length}단계)
                  </summary>
                  <div className="mt-2 space-y-2">
                    {tokenUsage.breakdown.map((usage, idx) => (
                      <div key={idx} className="text-xs bg-white rounded p-2 border border-gray-200">
                        <div className="flex justify-between">
                          <span className="text-gray-600">단계 {idx + 1}:</span>
                          <span className="font-semibold text-gray-800">
                            {usage.totalTokens.toLocaleString()} 토큰
                          </span>
                        </div>
                        <div className="flex justify-between text-gray-500 mt-1">
                          <span>입력: {usage.promptTokens.toLocaleString()}</span>
                          <span>출력: {usage.candidatesTokens.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
          
          <div className="qa-generator-container grid md:grid-cols-2 gap-6" style={{ 
            contain: 'layout style paint',
            isolation: 'isolate',
            position: 'relative',
            zIndex: 1
          }}>
          {/* 질문 영역 */}
          <div className="qa-question-container bg-gray-50 rounded-xl shadow-lg p-6" style={{ 
            contain: 'layout style paint',
            isolation: 'isolate',
            position: 'relative',
            zIndex: 1
          }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                질문글
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleRegenerateQuestion}
                  className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-700 transition-colors"
                >
                  🔄 재생성
                </button>
                <button
                  onClick={handleCopyQuestion}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  복사
                </button>
              </div>
            </div>
            {generatedQuestion ? (
              <div className="space-y-3">
                <h4 className="font-bold text-gray-900 text-lg border-b pb-2">
                  {generatedQuestion.title}
                </h4>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {generatedQuestion.content}
                </p>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                질문 생성 중...
              </div>
            )}
          </div>

          {/* 답변 영역 */}
          <div className="qa-answer-container bg-white rounded-xl shadow-lg p-6" style={{ 
            contain: 'layout style paint',
            isolation: 'isolate',
            position: 'relative',
            zIndex: 1
          }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                전문가 답변
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleRegenerateAnswer}
                  disabled={!generatedQuestion}
                  className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔄 재생성
                </button>
                <button
                  onClick={handleCopyAnswer}
                  disabled={!generatedAnswer}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Copy className="w-3 h-3" />
                  복사
                </button>
              </div>
            </div>
            {generatedAnswer ? (
              <div className="text-gray-800">
                {generatedAnswer.split(/\n\n+/).filter(p => p.trim()).map((paragraph, idx) => (
                  <p
                    key={idx}
                    className="mb-5 last:mb-0"
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      lineHeight: '1.95',
                      fontSize: '15px',
                      color: '#374151',
                      maxWidth: '100%',
                      letterSpacing: '0.01em',
                      paddingBottom: '0'
                    }}
                  >
                    {paragraph.trim()}
                  </p>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                {generatedQuestion ? '답변 생성 중...' : '질문을 먼저 생성해주세요'}
              </div>
            )}
          </div>
        </div>

        {/* 대화형 스레드 (댓글 형식) */}
        {conversationThread.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-600" />
                💬 대화형 댓글 스레드 ({conversationThread.length}개)
              </h3>
              <button
                onClick={() => {
                  const allThreads = conversationThread.map(msg => 
                    `${msg.role === 'customer' ? '👤 고객' : '👨‍💼 설계사'}: ${msg.content}`
                  ).join('\n\n')
                  navigator.clipboard.writeText(allThreads)
                  alert('전체 대화가 클립보드에 복사되었습니다!')
                }}
                className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-md hover:bg-purple-700 transition-colors flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                전체 복사
              </button>
            </div>
            
            <div className="space-y-4">
              {conversationThread.map((message, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg ${
                    message.role === 'customer'
                      ? 'bg-blue-50 border-l-4 border-blue-500'
                      : 'bg-indigo-50 border-l-4 border-indigo-500'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      message.role === 'customer'
                        ? 'bg-blue-500 text-white'
                        : 'bg-indigo-500 text-white'
                    }`}>
                      {message.role === 'customer' ? '👤' : '👨‍💼'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-800">
                          {message.role === 'customer' ? '고객' : '설계사'}
                        </span>
                        <span className="text-xs text-gray-500">
                          댓글 #{Math.ceil((message.step + 1) / 2)}
                        </span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(message.content)
                          alert('댓글이 클립보드에 복사되었습니다!')
                        }}
                        className="mt-2 text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        복사
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}

// 심의필 생성 컴포넌트
function ApprovalGenerator({ profile }: { profile: Profile | null }) {
  // 사용자별 localStorage 키 생성
  const getStorageKey = (key: string): string => {
    if (!profile?.id) return key
    return `${key}_${profile.id}`
  }

  // 로컬스토리지에서 저장된 등록번호 불러오기 (사용자별)
  const getStoredRegistrationNumber = (): string => {
    if (typeof window !== 'undefined' && profile?.id) {
      return localStorage.getItem(getStorageKey('insurance_registration_number')) || ''
    }
    return ''
  }

  // 로컬스토리지에서 저장된 지점명 불러오기 (사용자별)
  const getStoredBranchName = (): string => {
    if (typeof window !== 'undefined' && profile?.id) {
      return localStorage.getItem(getStorageKey('insurance_branch_name')) || ''
    }
    return ''
  }

  const [formData, setFormData] = useState({
    companyName: '프라임에셋', // 고정
    branchName: '',
    designerName: profile?.full_name || '',
    registrationNumber: '',
    approvalNumber: '',
    approvalStartDate: '2026.00.00',
    approvalEndDate: '2027.00.00',
    includeWarning: true,
  })

  // 사용자 변경 시 또는 초기 로드 시 저장된 데이터 불러오기
  useEffect(() => {
    if (profile?.id) {
      const storedBranchName = getStoredBranchName()
      const storedRegistrationNumber = getStoredRegistrationNumber()
      
      setFormData(prev => ({
        ...prev,
        branchName: storedBranchName,
        designerName: profile.full_name || '',
        registrationNumber: storedRegistrationNumber,
        // 처음 들어올 때는 초기값으로 설정 (저장된 값이 없으면 빈 값)
        approvalNumber: '',
        approvalStartDate: '2026.00.00',
        approvalEndDate: '2027.00.00',
      }))
    } else {
      // 프로필이 없으면 초기화
      setFormData(prev => ({
        ...prev,
        branchName: '',
        designerName: '',
        registrationNumber: '',
        approvalNumber: '',
        approvalStartDate: '2026.00.00',
        approvalEndDate: '2027.00.00',
      }))
    }
  }, [profile?.id, profile?.full_name])

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
      
      // 등록번호가 변경되면 로컬스토리지에 저장 (사용자별)
      if (field === 'registrationNumber' && typeof window !== 'undefined' && profile?.id) {
        localStorage.setItem(getStorageKey('insurance_registration_number'), value as string)
      }
      
      // 지점명이 변경되면 로컬스토리지에 저장 (사용자별)
      if (field === 'branchName' && typeof window !== 'undefined' && profile?.id) {
        localStorage.setItem(getStorageKey('insurance_branch_name'), value as string)
      }
      
      return newData
    })
    generatePreview()
  }

  const handleSaveRegistrationNumber = () => {
    if (typeof window !== 'undefined' && profile?.id) {
      localStorage.setItem(getStorageKey('insurance_registration_number'), formData.registrationNumber)
      setIsEditingRegistration(false)
      alert('협회등록번호가 저장되었습니다.')
    }
  }

  const handleEditRegistrationNumber = () => {
    setIsEditingRegistration(true)
  }

  const handleSaveBranchName = () => {
    if (typeof window !== 'undefined' && profile?.id) {
      localStorage.setItem(getStorageKey('insurance_branch_name'), formData.branchName)
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
    
    // 텍스트 (그림자 없이, 박스 없이)
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
    
    // localStorage에 심의필 이미지 저장 (사용자별)
    if (typeof window !== 'undefined' && profile?.id) {
      localStorage.setItem(getStorageKey('approval_certificate_image'), imageData)
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
                      placeholder="예: 광진2지점"
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

