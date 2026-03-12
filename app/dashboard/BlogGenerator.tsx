'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, LogOut, Sparkles, Copy, Send, FileDown, Clock, BookOpen, TrendingUp, ArrowLeft, UserCheck, History, BarChart3, FileText, Save, MessageSquare, Image as ImageIcon, Link as LinkIcon, Crown, Building2, MapPin, Users, User, RefreshCw, Wand2, Smartphone, Monitor, Lock, ClipboardCheck } from 'lucide-react'
import Link from 'next/link'
import MembershipStatusBanner from './MembershipStatusBanner'
import { createClient } from '@/lib/supabase/client'
import type { BlogPost } from '@/types/blog.types'
import { TEMPLATE_TOPICS } from '@/lib/template-topics'
import { addWarningToHTML } from '@/lib/insurance-warnings'
import { getRoleLabel, ROLES } from '@/lib/constants/roles'

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

// 저장할 때는 다시 원래대로 복구하는 함수
const unscopeHTMLForSave = (html: string) => {
  if (!html) return ''

  // 서버 사이드거나 DOMParser가 없으면 정규식 사용 (최후의 수단)
  if (typeof window === 'undefined' || !window.DOMParser) {
    let unscoped = html
    // 이미지 래퍼 제거
    unscoped = unscoped.replace(
      /<div[^>]*class="editable-image-wrapper"[^>]*>[\s\S]*?<img([^>]*)>[\s\S]*?<\/div>/gi,
      '<img$1>'
    )
    // 편집용 요소 제거
    unscoped = unscoped.replace(/<div[^>]*class="image-selection-border"[^>]*>[\s\S]*?<\/div>/gi, '')
    unscoped = unscoped.replace(/<div[^>]*class="image-resize-handle"[^>]*>[\s\S]*?<\/div>/gi, '')
    // CSS에서 .blog-editor 접두사 제거
    unscoped = unscoped.replace(/\.blog-editor\s+/g, '')
    // 태그 복원
    unscoped = unscoped.replace(/<div[^>]*class="blog-content"[^>]*>/gi, '<main>')
    unscoped = unscoped.replace(/<\/div>\s*<!-- blog-content -->/gi, '</main>')
    unscoped = unscoped.replace(/<div[^>]*class="blog-body"[^>]*>/gi, '<body>')
    unscoped = unscoped.replace(/<\/div>\s*<!-- blog-body -->/gi, '</body>')
    unscoped = unscoped.replace(/<div[^>]*class="blog-header"[^>]*>/gi, '<header>')
    unscoped = unscoped.replace(/<\/div>\s*<!-- blog-header -->/gi, '</header>')
    // blog-editor 래퍼 제거
    unscoped = unscoped.replace(/<div[^>]*class="blog-editor"[^>]*>/gi, '')
    unscoped = unscoped.replace(/<\/div>$/, '') // 마지막 닫는 div 제거 (대략적)
    return unscoped
  }

  try {
    const parser = new DOMParser()
    // 전체를 감싸는 body로 파싱
    const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html')
    const body = doc.body

    // 1. 편집용 요소들 제거 (선택 테두리, 리사이즈 핸들, 래퍼)
    const borders = body.querySelectorAll('.image-selection-border')
    borders.forEach(border => border.remove())
    const handles = body.querySelectorAll('.image-resize-handle')
    handles.forEach(handle => handle.remove())
    
    // 2. 모든 editable-image-wrapper를 찾아서 내부의 img로 교체
    const wrappers = body.querySelectorAll('.editable-image-wrapper')
    wrappers.forEach(wrapper => {
      const img = wrapper.querySelector('img')
      if (img && img.src) {
        // 이미지의 모든 속성과 스타일 보존
        const cleanImg = document.createElement('img')
        cleanImg.src = img.src
        if (img.alt) cleanImg.alt = img.alt
        
        // 이미지의 모든 속성 복사
        Array.from(img.attributes).forEach(attr => {
          if (attr.name !== 'draggable') {
            try {
              cleanImg.setAttribute(attr.name, attr.value)
            } catch (e) {
              // 속성 설정 실패 시 무시
            }
          }
        })
        
        // 래퍼를 이미지로 교체
        wrapper.replaceWith(cleanImg)
      } else {
        // 이미지가 없으면 래퍼 삭제
        wrapper.remove()
      }
    })

    // 3. CSS 스타일에서 .blog-editor 접두사 제거 및 태그 복원
    const styleTags = body.querySelectorAll('style')
    styleTags.forEach(styleTag => {
      if (styleTag.textContent) {
        let cssContent = styleTag.textContent
        
        // @media 쿼리 내부도 처리하기 위해 재귀적으로 처리
        // 먼저 @media 쿼리를 찾아서 내부를 처리
        cssContent = cssContent.replace(/@media[^{]*\{([\s\S]*?)\}/g, (mediaMatch, mediaContent) => {
          let processedMedia = mediaContent
          
          // .blog-editor 접두사 제거
          processedMedia = processedMedia.replace(/\.blog-editor\s+([a-zA-Z0-9_-]+)/g, '$1')
          processedMedia = processedMedia.replace(/\.blog-editor\s+\.([a-zA-Z0-9_-]+)/g, '.$1')
          processedMedia = processedMedia.replace(/\.blog-editor\s+#([a-zA-Z0-9_-]+)/g, '#$1')
          processedMedia = processedMedia.replace(/\.blog-editor\s+\[([^\]]+)\]/g, '[$1]')
          processedMedia = processedMedia.replace(/\.blog-editor\s+(::?[a-zA-Z-]+)/g, '$1')
          processedMedia = processedMedia.replace(/\.blog-editor\s*>\s*/g, '> ')
          processedMedia = processedMedia.replace(/\.blog-editor\s*\+\s*/g, '+ ')
          processedMedia = processedMedia.replace(/\.blog-editor\s*~\s*/g, '~ ')
          processedMedia = processedMedia.replace(/\.blog-editor\s*,/g, ',')
          processedMedia = processedMedia.replace(/\.blog-editor\s*\{/g, '{')
          
          // 태그 복원
          processedMedia = processedMedia.replace(/\.blog-content\s+/g, 'main ')
          processedMedia = processedMedia.replace(/\.blog-body\s+/g, 'body ')
          processedMedia = processedMedia.replace(/\.blog-header\s+/g, 'header ')
          
          return mediaMatch.replace(mediaContent, processedMedia)
        })
        
        // .blog-editor 접두사 제거 (다양한 패턴 처리)
        // 패턴 1: .blog-editor 태그명
        cssContent = cssContent.replace(/\.blog-editor\s+([a-zA-Z0-9_-]+)/g, '$1')
        // 패턴 2: .blog-editor .클래스명
        cssContent = cssContent.replace(/\.blog-editor\s+\.([a-zA-Z0-9_-]+)/g, '.$1')
        // 패턴 3: .blog-editor #아이디
        cssContent = cssContent.replace(/\.blog-editor\s+#([a-zA-Z0-9_-]+)/g, '#$1')
        // 패턴 4: .blog-editor [속성]
        cssContent = cssContent.replace(/\.blog-editor\s+\[([^\]]+)\]/g, '[$1]')
        // 패턴 5: .blog-editor::가상요소
        cssContent = cssContent.replace(/\.blog-editor\s+(::?[a-zA-Z-]+)/g, '$1')
        // 패턴 6: .blog-editor > (자식 선택자)
        cssContent = cssContent.replace(/\.blog-editor\s*>\s*/g, '> ')
        // 패턴 7: .blog-editor + (인접 형제 선택자)
        cssContent = cssContent.replace(/\.blog-editor\s*\+\s*/g, '+ ')
        // 패턴 8: .blog-editor ~ (일반 형제 선택자)
        cssContent = cssContent.replace(/\.blog-editor\s*~\s*/g, '~ ')
        // 패턴 9: .blog-editor, (그룹 선택자)
        cssContent = cssContent.replace(/\.blog-editor\s*,/g, ',')
        // 패턴 10: .blog-editor { (단독 선택자)
        cssContent = cssContent.replace(/\.blog-editor\s*\{/g, '{')
        
        // .blog-content → main
        cssContent = cssContent.replace(/\.blog-content\s+/g, 'main ')
        cssContent = cssContent.replace(/\.blog-content\s*\{/g, 'main {')
        cssContent = cssContent.replace(/\.blog-content\s*>/g, 'main >')
        cssContent = cssContent.replace(/\.blog-content\s*\+/g, 'main +')
        cssContent = cssContent.replace(/\.blog-content\s*~/g, 'main ~')
        cssContent = cssContent.replace(/\.blog-content\s*,/g, 'main,')
        
        // .blog-body → body
        cssContent = cssContent.replace(/\.blog-body\s+/g, 'body ')
        cssContent = cssContent.replace(/\.blog-body\s*\{/g, 'body {')
        cssContent = cssContent.replace(/\.blog-body\s*>/g, 'body >')
        cssContent = cssContent.replace(/\.blog-body\s*\+/g, 'body +')
        cssContent = cssContent.replace(/\.blog-body\s*~/g, 'body ~')
        cssContent = cssContent.replace(/\.blog-body\s*,/g, 'body,')
        
        // .blog-header → header
        cssContent = cssContent.replace(/\.blog-header\s+/g, 'header ')
        cssContent = cssContent.replace(/\.blog-header\s*\{/g, 'header {')
        cssContent = cssContent.replace(/\.blog-header\s*>/g, 'header >')
        cssContent = cssContent.replace(/\.blog-header\s*\+/g, 'header +')
        cssContent = cssContent.replace(/\.blog-header\s*~/g, 'header ~')
        cssContent = cssContent.replace(/\.blog-header\s*,/g, 'header,')
        
        // scoped 속성 제거
        styleTag.removeAttribute('scoped')
        
        styleTag.textContent = cssContent
      }
    })

    // 4. 태그 복원: div class="blog-content" → main
    const blogContentDivs = body.querySelectorAll('.blog-content')
    blogContentDivs.forEach(div => {
      const main = doc.createElement('main')
      main.innerHTML = div.innerHTML
      // div의 모든 속성 복사 (class 제외)
      Array.from(div.attributes).forEach(attr => {
        if (attr.name !== 'class') {
          main.setAttribute(attr.name, attr.value)
        }
      })
      div.parentNode?.replaceChild(main, div)
    })

    // 5. 태그 복원: div class="blog-body" → body
    const blogBodyDivs = body.querySelectorAll('.blog-body')
    blogBodyDivs.forEach(div => {
      const bodyEl = doc.createElement('body')
      bodyEl.innerHTML = div.innerHTML
      // div의 모든 속성 복사 (class 제외)
      Array.from(div.attributes).forEach(attr => {
        if (attr.name !== 'class') {
          bodyEl.setAttribute(attr.name, attr.value)
        }
      })
      div.parentNode?.replaceChild(bodyEl, div)
    })

    // 6. 태그 복원: div class="blog-header" → header
    const blogHeaderDivs = body.querySelectorAll('.blog-header')
    blogHeaderDivs.forEach(div => {
      const header = doc.createElement('header')
      header.innerHTML = div.innerHTML
      // div의 모든 속성 복사 (class 제외)
      Array.from(div.attributes).forEach(attr => {
        if (attr.name !== 'class') {
          header.setAttribute(attr.name, attr.value)
        }
      })
      div.parentNode?.replaceChild(header, div)
    })

    // 7. blog-editor 클래스 제거 및 내부 내용만 추출
    const editor = body.querySelector('.blog-editor')
    if (editor) {
      // editor의 모든 자식 요소를 그대로 반환 (스타일과 속성 모두 보존)
      return editor.innerHTML
    }

    // blog-editor가 없으면 body의 내용 반환
    return body.innerHTML
  } catch (error) {
    console.error('unscopeHTMLForSave 오류:', error)
    return html
  }
}

interface Profile {
  id: string
  username: string
  full_name: string
  email: string
  phone: string
  role?: string
  membership_status?: 'active' | 'pending' | 'suspended' | 'deleted' | null
  paid_until?: string | null
  grace_period_until?: string | null
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

// 역할별 스타일 및 아이콘
const getRoleStyles = (role: string | null | undefined) => {
  if (!role) role = ROLES.FC
  
  switch (role) {
    case ROLES.ADMIN:
    case ROLES.DEPARTMENT_HEAD:
      return {
        bgColor: 'bg-amber-100',
        textColor: 'text-amber-800',
        icon: Crown,
        iconColor: 'text-amber-600',
        label: getRoleLabel(role)
      }
    case ROLES.BRANCH_HEAD:
      return {
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        icon: MapPin,
        iconColor: 'text-green-600',
        label: getRoleLabel(role)
      }
    case ROLES.TEAM_LEADER:
      return {
        bgColor: 'bg-purple-100',
        textColor: 'text-purple-800',
        icon: Users,
        iconColor: 'text-purple-600',
        label: getRoleLabel(role)
      }
    case ROLES.FC:
    default:
      return {
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        icon: User,
        iconColor: 'text-orange-600',
        label: getRoleLabel(role)
      }
  }
}

export default function BlogGenerator({ profile: initialProfile }: { profile: Profile | null }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<'write' | 'history' | 'stats' | 'approval' | 'qa' | 'qa-history' | 'image-analysis' | 'kakao-link'>('write')
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
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [isDraggingOverDesignSheet, setIsDraggingOverDesignSheet] = useState(false)

  // 이미지 편집 기능을 위한 유틸리티 함수 (이벤트 리스너 없이 구조만 생성)

  // 이미지 드래그 앤 드롭 핸들러
  const handleEditorDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(true)
  }

  const handleEditorDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
  }

  const handleEditorDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)

    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))

    if (imageFiles.length === 0) {
      alert('이미지 파일만 업로드할 수 있습니다.')
      return
    }

    // 편집 영역 찾기 (이벤트가 발생한 요소가 .blog-editor일 수도 있고, 부모일 수도 있음)
    let editor: HTMLElement | null = null
    
    // 현재 타겟이 .blog-editor인지 확인
    if (e.currentTarget.classList.contains('blog-editor')) {
      editor = e.currentTarget as HTMLElement
    } else {
      // 부모 요소에서 .blog-editor 찾기
      editor = e.currentTarget.querySelector('.blog-editor') as HTMLElement
    }
    
    // 그래도 없으면 document에서 찾기
    if (!editor) {
      editor = document.querySelector('.blog-editor') as HTMLElement
    }
    
    if (!editor) {
      console.error('편집 영역을 찾을 수 없습니다.')
      alert('편집 영역을 찾을 수 없습니다. 편집 모드를 활성화해주세요.')
      return
    }

    // 드롭 위치에 맞는 커서 위치 찾기
    const dropX = e.clientX
    const dropY = e.clientY
    const editorRect = editor.getBoundingClientRect()
    
    // 드롭 위치를 기준으로 가장 가까운 텍스트 노드 찾기
    let range: Range | null = null
    const selection = window.getSelection()
    
    // 브라우저 API 사용 시도
    if (document.caretRangeFromPoint) {
      // Chrome, Safari
      try {
        range = document.caretRangeFromPoint(dropX, dropY)
        // range가 editor 외부에 있으면 null로 설정
        if (range && !editor.contains(range.commonAncestorContainer)) {
          range = null
        }
      } catch (err) {
        // 에러 발생 시 무시
      }
    } else if ((document as any).caretPositionFromPoint) {
      // Firefox
      try {
        const caretPos = (document as any).caretPositionFromPoint(dropX, dropY)
        if (caretPos && editor.contains(caretPos.offsetNode)) {
          range = document.createRange()
          range.setStart(caretPos.offsetNode, caretPos.offset)
          range.collapse(true)
        }
      } catch (err) {
        // 에러 발생 시 무시
      }
    }
    
    // range를 찾지 못한 경우 수동으로 찾기
    if (!range) {
      // 에디터 내부의 모든 요소를 찾아서 가장 가까운 위치 찾기
      const allElements = editor.querySelectorAll('*')
      let closestElement: Element | null = null
      let closestDistance = Infinity
      
      allElements.forEach((el) => {
        const rect = el.getBoundingClientRect()
        if (rect) {
          // 드롭 위치와 요소의 중심점 사이의 거리 계산
          const centerY = rect.top + rect.height / 2
          const centerX = rect.left + rect.width / 2
          const distance = Math.sqrt(
            Math.pow(centerX - dropX, 2) + Math.pow(centerY - dropY, 2)
          )
          
          // 드롭 위치가 요소 위에 있고, 더 가까운 경우
          if (dropY >= rect.top && dropY <= rect.bottom && distance < closestDistance) {
            closestDistance = distance
            closestElement = el
          }
        }
      })
      
      if (closestElement) {
        range = document.createRange()
        // 요소 앞에 삽입
        range.setStartBefore(closestElement)
        range.collapse(true)
      } else {
        // 그래도 없으면 드롭 Y 위치를 기준으로 찾기
        const textNodes: Node[] = []
        const walker = document.createTreeWalker(
          editor,
          NodeFilter.SHOW_TEXT,
          null
        )
        
        let node: Node | null
        while (node = walker.nextNode()) {
          const rect = node.parentElement?.getBoundingClientRect()
          if (rect && dropY >= rect.top && dropY <= rect.bottom) {
            textNodes.push(node)
          }
        }
        
        if (textNodes.length > 0) {
          // 가장 가까운 텍스트 노드 찾기
          let closestTextNode = textNodes[0]
          let minDistance = Infinity
          
          textNodes.forEach((textNode) => {
            const rect = textNode.parentElement?.getBoundingClientRect()
            if (rect) {
              const distance = Math.abs(rect.top + rect.height / 2 - dropY)
              if (distance < minDistance) {
                minDistance = distance
                closestTextNode = textNode
              }
            }
          })
          
          range = document.createRange()
          range.setStart(closestTextNode, 0)
          range.collapse(true)
        } else {
          // 그래도 없으면 끝에 추가
          range = document.createRange()
          range.selectNodeContents(editor)
          range.collapse(false)
        }
      }
    }

    for (const file of imageFiles) {
      const reader = new FileReader()
      
      reader.onload = (event) => {
        const base64String = event.target?.result as string
        
        // 이미지 요소 생성
        const img = document.createElement('img')
        img.src = base64String
        img.style.maxWidth = '100%'
        img.style.height = 'auto'
        img.style.display = 'block'
        img.style.margin = '16px auto'
        img.style.borderRadius = '8px'
        img.alt = file.name

        // 커서 위치에 이미지 삽입
        try {
          if (range) {
            range.deleteContents()
            range.insertNode(img)
            // 줄바꿈 추가
            const br = document.createElement('br')
            range.setStartAfter(img)
            range.insertNode(br)
            // 커서를 줄바꿈 뒤로 이동
            range.setStartAfter(br)
            range.collapse(true)
            if (selection) {
              selection.removeAllRanges()
              selection.addRange(range)
            }
          } else {
            // 커서가 없으면 끝에 추가
            editor.appendChild(img)
            const br = document.createElement('br')
            editor.appendChild(br)
          }
        } catch (error) {
          // 에러 발생 시 끝에 추가
          console.error('이미지 삽입 오류:', error)
          editor.appendChild(img)
          const br = document.createElement('br')
          editor.appendChild(br)
        }

        // HTML 업데이트
        const newHTML = editor.innerHTML
        setEditableHTML(newHTML)
        // 편집 모드에서는 generatedHTML도 업데이트하지 않음 (편집 완료 시에만 업데이트)
      }

      reader.onerror = () => {
        alert('이미지 파일을 읽는 중 오류가 발생했습니다.')
      }

      reader.readAsDataURL(file)
    }
  }

  // 이미지 첨부 버튼 핸들러
  const handleImageAttach = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files
      if (!files || files.length === 0) return

      const editor = document.querySelector('.blog-editor') as HTMLElement
      if (!editor) {
        alert('편집 영역을 찾을 수 없습니다. 편집 모드를 활성화해주세요.')
        return
      }

      const selection = window.getSelection()
      let range: Range | null = null
      
      if (selection && selection.rangeCount > 0) {
        range = selection.getRangeAt(0).cloneRange()
      } else {
        range = document.createRange()
        range.selectNodeContents(editor)
        range.collapse(false)
      }

      Array.from(files).forEach((file) => {
        if (!file.type.startsWith('image/')) return

        const reader = new FileReader()
        
        reader.onload = (event) => {
          const base64String = event.target?.result as string
          
          const img = document.createElement('img')
          img.src = base64String
          img.style.maxWidth = '100%'
          img.style.height = 'auto'
          img.style.display = 'block'
          img.style.margin = '16px auto'
          img.style.borderRadius = '8px'
          img.alt = file.name

          try {
            if (range) {
              range.deleteContents()
              range.insertNode(img)
              const br = document.createElement('br')
              range.setStartAfter(img)
              range.insertNode(br)
              range.setStartAfter(br)
              range.collapse(true)
              selection?.removeAllRanges()
              selection?.addRange(range)
            } else {
              editor.appendChild(img)
              const br = document.createElement('br')
              editor.appendChild(br)
            }
          } catch (error) {
            console.error('이미지 삽입 오류:', error)
            editor.appendChild(img)
            const br = document.createElement('br')
            editor.appendChild(br)
          }

          const newHTML = editor.innerHTML
          setEditableHTML(newHTML)
          setGeneratedHTML(newHTML)
        }

        reader.readAsDataURL(file)
      })
    }
    
    input.click()
  }

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
      // 서버 사이드 API 사용 (RLS 우회)
      const response = await fetch('/api/blog-posts')
      const result = await response.json()

      if (!response.ok) {
        console.error('글 목록 로딩 오류:', result)
        throw new Error(result.error || '블로그 글을 불러올 수 없습니다')
      }

      setBlogPosts(result.posts || [])
    } catch (error: any) {
      console.error('글 목록 로딩 오류:', {
        error,
        message: error?.message,
        profileId: profile?.id
      })
      // 에러가 있어도 빈 배열로 설정하여 UI가 깨지지 않도록 함
      setBlogPosts([])
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

        const resText = await response.text()
        let data: { success?: boolean; data?: Record<string, unknown> }
        try {
          data = JSON.parse(resText)
        } catch {
          console.error('[설계서 분석] 응답 파싱 실패:', resText?.slice(0, 80))
          alert(
            response.status === 413 || /Request Entity|Payload|too large/i.test(resText)
              ? '이미지 크기가 너무 큽니다. 더 작은 이미지로 시도해 주세요.'
              : '서버 응답 형식 오류입니다. 잠시 후 다시 시도해 주세요.'
          )
          return
        }
        if (data.success && data.data) {
          // 제안서 분석 결과를 바탕으로 주제와 키워드 자동 생성
          type DesignSheetAnalysis = {
            productName: string
            targetPersona: string
            worryPoint: string
            sellingPoint: string
          }
          const analysis = data.data as DesignSheetAnalysis
          const productName: string =
            (typeof analysis.productName === 'string' && analysis.productName.trim().length > 0)
              ? analysis.productName
              : '보험'
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
    // 편집 모드에서 저장할 때는 현재 편집 중인 HTML 사용
    let htmlToSave = isEditMode && editableHTML ? editableHTML : generatedHTML
    
    if (!htmlToSave || !profile?.id) {
      alert('저장할 콘텐츠가 없습니다')
      return
    }

    try {
      // 편집 모드에서 저장할 때는 스코핑 제거 (원본으로 복구)
      if (isEditMode) {
        htmlToSave = unscopeHTMLForSave(htmlToSave)
      }

      const supabase = createClient()
      
      // 제목 추출 (HTML에서)
      const titleMatch = htmlToSave.match(/<title>(.*?)<\/title>/)
      const title = titleMatch ? titleMatch[1] : formData.topic

      // 텍스트 추출 (대략적)
      const plainText = htmlToSave.replace(/<[^>]*>/g, '').slice(0, 500)
      const wordCount = plainText.length

      const { error } = await supabase.from('blog_posts').insert({
        user_id: profile.id,
        topic: formData.topic,
        keywords: formData.keywords,
        product: formData.product,
        tone: formData.tone,
        template: formData.template,
        html_content: htmlToSave, // 스코핑 제거된 원본 HTML 저장
        plain_text: plainText,
        title: title,
        word_count: wordCount,
        status: 'draft',
      })

      if (error) throw error

      // 저장 후 편집 모드 종료 및 HTML 업데이트
      setGeneratedHTML(htmlToSave)
      setEditableHTML('')
      setIsEditMode(false)

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
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
                  <span className="inline-flex items-center gap-2">
                    <span>{profile?.full_name}님 환영합니다</span>
                    {profile?.role && (() => {
                      const roleStyles = getRoleStyles(profile.role)
                      const RoleIcon = roleStyles.icon
                      return (
                        <span 
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border-2"
                          style={{
                            background: 'linear-gradient(90deg, #fcd34d, #fb923c, #fbbf24, #fb923c, #fcd34d)',
                            backgroundSize: '200% auto',
                            borderColor: 'rgba(251, 191, 36, 0.5)',
                            boxShadow: '0 2px 8px rgba(251, 191, 36, 0.3)',
                            animation: 'shimmer 3s ease-in-out infinite',
                            ...(isEditMode ? {
                              fontSize: '0.625rem',
                              padding: '0.125rem 0.375rem',
                              margin: '0',
                              lineHeight: '1.2',
                              height: 'auto',
                              minHeight: 'auto',
                              maxHeight: 'none',
                              boxSizing: 'border-box'
                            } : {})
                          }}
                        >
                          <RoleIcon 
                            className="w-3 h-3" 
                            style={{
                              color: '#92400e',
                              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
                            }}
                          />
                          <span
                            style={{
                              background: 'linear-gradient(90deg, #92400e, #78350f, #92400e)',
                              backgroundSize: '200% auto',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              backgroundClip: 'text',
                              animation: 'shimmer 3s ease-in-out infinite',
                              fontWeight: 700
                            }}
                          >
                            {roleStyles.label}
                          </span>
                        </span>
                      )
                    })()}
                  </span>
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
              <div className="flex items-center gap-2">
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
                <button
                  onClick={() => router.push('/admin/stats')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500 text-white text-sm font-semibold rounded-md hover:bg-amber-600 transition-colors"
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
                  <BarChart3 className="w-3.5 h-3.5" />
                  통계
                </button>
                <button
                  onClick={() => router.push('/admin/quality')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-md hover:bg-emerald-700 transition-colors"
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
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  품질
                </button>
              </div>
            )}
            {profile?.role === 'team_leader' && (
              <button
                onClick={() => router.push('/team/stats')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500 text-white text-sm font-semibold rounded-md hover:bg-blue-600 transition-colors"
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
                <BarChart3 className="w-3.5 h-3.5" style={isEditMode ? { width: '0.875rem', height: '0.875rem', margin: 0, padding: 0 } : {}} />
                팀 통계
              </button>
            )}
            {(profile?.role === 'department_head' || profile?.role === 'branch_head') && (
              <button
                onClick={() => router.push('/department/stats')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-500 text-white text-sm font-semibold rounded-md hover:bg-purple-600 transition-colors"
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
                <BarChart3 className="w-3.5 h-3.5" style={isEditMode ? { width: '0.875rem', height: '0.875rem', margin: 0, padding: 0 } : {}} />
                본부 통계
              </button>
            )}
            {/* 비밀번호 변경 */}
            <Link
              href="/dashboard/change-password"
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 backdrop-blur-sm text-white text-sm font-semibold rounded-md hover:bg-white/20 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              비밀번호 변경
            </Link>
            {/* 로그아웃 버튼 (오른쪽 끝) */}
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

      {/* 회원 상태 배너 (관리자/슈퍼계정 제외) */}
      {profile && profile.role !== 'admin' && profile.username !== 'amazing' && (
        <div className="container mx-auto px-4 py-2">
          <MembershipStatusBanner
            status={profile.membership_status ?? null}
            paidUntil={profile.paid_until ?? null}
            gracePeriodUntil={profile.grace_period_until ?? null}
          />
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-2">
        {/* 탭 네비게이션 */}
        <div className="max-w-7xl mx-auto mb-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-1.5 flex gap-1.5">
            <button
              onClick={() => setActiveTab('write')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'write'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              ✨ 블로그 쓰기
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
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
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              💬 Q&A 생성기
            </button>
            <button
              onClick={() => setActiveTab('qa-history')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'qa-history'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              <History className="w-4 h-4" />
              📝 저장된 Q&A
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'stats'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
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
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
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
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              🏥 전문 이미지 분석기
            </button>
            <button
              onClick={() => setActiveTab('kakao-link')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'kakao-link'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              🔗 카톡 유입 추적 링크
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
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4">
              <h3 className="text-base font-bold text-[#1e293b] dark:text-white mb-3 flex items-center gap-2">
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
                    <div className="text-[10px] font-semibold text-gray-700 dark:text-gray-200 text-center leading-tight break-words px-0.5">{template.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 입력 폼 */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-[#1e293b] dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                글 생성 조건
              </h3>

              <div className="space-y-4">
                {/* 주제 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    주제 (Topic) *
                  </label>
                  <input
                    type="text"
                    name="topic"
                    value={formData.topic}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
                    placeholder="예: 40세 뇌혈관 진단비 비교"
                  />
                </div>

                {/* 키워드 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    핵심 키워드
                  </label>
                  <input
                    type="text"
                    name="keywords"
                    value={formData.keywords}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
                    placeholder="예: 비갱신형, 100세만기, 무해지환급형"
                  />
                </div>

                {/* 상품 선택 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    강조할 상품
                  </label>
                  <select
                    name="product"
                    value={formData.product}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  >
                    <option value="auto">자동 추천 (AI)</option>
                    <option value="a">A사 (가성비)</option>
                    <option value="b">B사 (보장중심)</option>
                    <option value="c">C사 (수술비특화)</option>
                  </select>
                </div>

                {/* 톤 선택 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    글의 톤
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 border-2 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition bg-white dark:bg-slate-700">
                      <input
                        type="radio"
                        name="tone"
                        value="friendly"
                        checked={formData.tone === 'friendly'}
                        onChange={handleChange}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">😊 친절한 상담사 톤</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 border-2 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition bg-white dark:bg-slate-700">
                      <input
                        type="radio"
                        name="tone"
                        value="expert"
                        checked={formData.tone === 'expert'}
                        onChange={handleChange}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">👨‍💼 냉철한 전문가 톤</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 border-2 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition bg-white dark:bg-slate-700">
                      <input
                        type="radio"
                        name="tone"
                        value="warning"
                        checked={formData.tone === 'warning'}
                        onChange={handleChange}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">⚠️ 경각심 주는 톤</span>
                    </label>
                  </div>
                </div>

                {/* 제안서 이미지 업로드 (선택) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    제안서 이미지 (선택)
                  </label>
                  
                  {/* 드래그 앤 드롭 영역 */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (!isGenerating && !isAnalyzingDesignSheet) {
                        setIsDraggingOverDesignSheet(true)
                      }
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setIsDraggingOverDesignSheet(false)
                    }}
                    onDrop={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setIsDraggingOverDesignSheet(false)
                      
                      if (isGenerating || isAnalyzingDesignSheet) return
                      
                      const files = Array.from(e.dataTransfer.files)
                      const imageFiles = files.filter(file => file.type.startsWith('image/'))
                      
                      if (imageFiles.length === 0) {
                        alert('이미지 파일만 업로드할 수 있습니다.')
                        return
                      }
                      
                      // 첫 번째 이미지 파일 처리
                      const file = imageFiles[0]
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

                          const resText = await response.text()
                          let data: { success?: boolean; data?: Record<string, unknown> }
                          try {
                            data = JSON.parse(resText)
                          } catch {
                            console.error('[설계서 분석] 응답 파싱 실패:', resText?.slice(0, 80))
                            alert(
                              response.status === 413 || /Request Entity|Payload|too large/i.test(resText)
                                ? '이미지 크기가 너무 큽니다. 더 작은 이미지로 시도해 주세요.'
                                : '서버 응답 형식 오류입니다. 잠시 후 다시 시도해 주세요.'
                            )
                            return
                          }
                          if (data.success && data.data) {
                            // 제안서 분석 결과를 바탕으로 주제와 키워드 자동 생성
                            type DesignSheetAnalysis = {
                              productName: string
                              targetPersona: string
                              worryPoint: string
                              sellingPoint: string
                            }
                            const analysis = data.data as DesignSheetAnalysis
                            const productName: string =
                              (typeof analysis.productName === 'string' && analysis.productName.trim().length > 0)
                                ? analysis.productName
                                : '보험'
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
                    }}
                    className={`border-2 border-dashed rounded-lg p-4 transition-all ${
                      isDraggingOverDesignSheet
                        ? 'border-blue-500 bg-blue-50'
                        : formData.designSheetImage
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                    } ${isGenerating || isAnalyzingDesignSheet ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleDesignSheetUpload}
                      disabled={isGenerating || isAnalyzingDesignSheet}
                      className="hidden"
                    />
                    <div
                      onClick={() => !isGenerating && !isAnalyzingDesignSheet && fileInputRef.current?.click()}
                      className="text-center"
                    >
                      {formData.designSheetImage ? (
                        <div className="space-y-2">
                          <div className="text-green-600 font-semibold">✓ 제안서 이미지 첨부됨</div>
                          <img 
                            src={formData.designSheetImage} 
                            alt="제안서 미리보기" 
                            className="max-w-full max-h-32 mx-auto rounded border border-gray-300"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-4xl">📎</div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            {isDraggingOverDesignSheet 
                              ? '여기에 놓으세요' 
                              : '파일을 드래그하거나 클릭하여 업로드'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            이미지 파일만 업로드 가능
                          </div>
                        </div>
                      )}
                    </div>
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
          <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-xl shadow-lg flex flex-col" style={{ 
            contain: 'layout style paint',
            isolation: 'isolate',
            position: 'relative',
            zIndex: 1,
            minHeight: 0,
            maxHeight: '100%'
          }}>
            {/* 액션 버튼 바 */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-slate-700 dark:to-slate-600 px-4 py-2 border-b dark:border-gray-600 flex justify-between items-center flex-shrink-0">
              <h3 className="text-base font-bold text-gray-800 dark:text-white">결과 미리보기</h3>
              {generatedHTML && (
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => {
                      if (isEditMode) {
                        // 편집 모드 종료 시: 스코핑 제거하여 원본 HTML로 복구
                        const editor = document.querySelector('.blog-editor') as HTMLElement
                        if (editor) {
                          const currentHTML = editor.innerHTML
                          const unscopedHTML = unscopeHTMLForSave(currentHTML)
                          // HTML이 비어있지 않은 경우에만 업데이트
                          if (unscopedHTML && unscopedHTML.trim().length > 0) {
                            setGeneratedHTML(unscopedHTML)
                            setEditableHTML('')
                          } else {
                            // HTML이 비어있으면 경고
                            alert('편집 내용이 비어있습니다. 편집을 계속하시겠습니까?')
                            return
                          }
                        }
                      } else {
                        // 편집 모드 시작 시: 스코핑 적용
                        if (generatedHTML) {
                          setEditableHTML(scopeHTMLForEditor(generatedHTML))
                        }
                      }
                      setIsEditMode(!isEditMode)
                    }}
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
                    <span>⚡ 평균 2분</span>
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
                            <div className="w-px h-4 bg-gray-300 mx-0.5"></div>
                            <button
                              onClick={handleImageAttach}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 flex items-center gap-1"
                              title="이미지 첨부"
                            >
                              <ImageIcon className="w-3 h-3" />
                              이미지
                            </button>
                          </div>
                        </div>
                      </div>
                      {/* 편집 가능한 미리보기 - 비편집모드 iframe과 완전히 동일한 구조 */}
                      <div 
                        className="w-full border-0 rounded-lg bg-white flex-1"
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setIsDraggingOver(true)
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          // 자식 요소로 이동한 경우는 제외
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setIsDraggingOver(false)
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setIsDraggingOver(false)
                          // 외부 div에서도 드롭 처리 (blog-editor로 전달)
                          handleEditorDrop(e as any)
                        }}
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
                          className={`blog-editor bg-white rounded-lg p-6 w-full border-2 ${
                            isDraggingOver 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-purple-300'
                          } focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors`}
                          contentEditable
                          spellCheck={false}
                          suppressContentEditableWarning={true}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsDraggingOver(true)
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                              setIsDraggingOver(false)
                            }
                          }}
                          onDrop={handleEditorDrop}
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
                          onBlur={(e: React.FocusEvent<HTMLDivElement>) => {
                            const editor = e.currentTarget
                            const newHTML = editor.innerHTML
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
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                  <History className="w-7 h-7 text-blue-600" />
                  내가 작성한 글
                </h2>
                <button
                  onClick={loadBlogPosts}
                  className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors text-sm"
                >
                  🔄 새로고침
                </button>
              </div>

              {isLoadingPosts ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">로딩 중...</p>
                </div>
              ) : blogPosts.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {blogPosts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-gradient-to-br from-white to-gray-50 dark:from-slate-700 dark:to-slate-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:shadow-xl transition-all hover:scale-[1.02]"
                    >
                      {/* 아이콘 */}
                      <div className="text-4xl mb-3">
                        {TEMPLATES.find((t) => t.id === post.template)?.icon || '📝'}
                      </div>

                      {/* 제목 */}
                      <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2 line-clamp-2">
                        {post.title || post.topic}
                      </h3>

                      {/* 메타 정보 */}
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-4">
                        <span>{new Date(post.created_at).toLocaleDateString('ko-KR')}</span>
                        <span>•</span>
                        <span>{post.word_count || 0}자</span>
                        {post.status === 'published' && (
                          <>
                            <span>•</span>
                            <span className="text-green-600 dark:text-green-400 font-semibold">발행됨</span>
                          </>
                        )}
                      </div>

                      {/* 미리보기 텍스트 */}
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
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
                          className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-xs font-semibold"
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
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                    아직 작성한 글이 없습니다
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    [✨ 블로그 쓰기] 탭에서 첫 번째 블로그를 만들어보세요!
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
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-8 flex items-center gap-3">
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

              <div className="mt-8 bg-gray-50 dark:bg-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">최근 활동</h3>
                {blogPosts.slice(0, 5).map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-600 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                      <div>
                        <div className="font-medium text-gray-800 dark:text-white">{post.title || post.topic}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(post.created_at).toLocaleDateString('ko-KR')}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewPost(post)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-semibold"
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
          <QAGenerator profile={profile} showListOnly={false} onTabChange={setActiveTab} />
        </div>
        )}

        {/* 저장된 Q&A 목록 탭 */}
        {activeTab === 'qa-history' && (
        <div className="qa-generator-wrapper" style={{ 
          contain: 'layout style paint',
          isolation: 'isolate',
          position: 'relative',
          zIndex: 1
        }}>
          <QAGenerator profile={profile} showListOnly={true} onTabChange={setActiveTab} />
        </div>
        )}

        {/* 전문 이미지 분석기 탭 */}
        {activeTab === 'image-analysis' && (
        <div className="max-w-5xl mx-auto">
          <ImageAnalyzer profile={profile} />
        </div>
        )}

        {/* 카톡 유입 추적 링크 생성기 탭 */}
        {activeTab === 'kakao-link' && (
        <div className="max-w-5xl mx-auto">
          <KakaoLinkGenerator profile={profile} />
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

      const text = await response.text()
      let data: { success?: boolean; data?: unknown; error?: string }
      try {
        data = JSON.parse(text)
      } catch {
        console.error('이미지 분석 응답 파싱 실패 (JSON 아님):', text?.slice(0, 80))
        throw new Error(
          response.status === 413 || text.includes('Request Entity') || text.includes('Payload')
            ? '이미지 크기가 너무 큽니다. 더 작은 이미지로 시도해 주세요.'
            : '서버 응답 형식 오류입니다. 잠시 후 다시 시도해 주세요.'
        )
      }

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
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-3">
        <ImageIcon className="w-7 h-7 text-blue-600" />
        전문 이미지 분석기
      </h2>

      <div className="mb-6">
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          의료 영수증(진료비 세부산정내역서) 또는 병리 검사 보고서 이미지를 업로드하면, 
          질병명, 보험금 계산, 고객 설명 가이드를 자동으로 생성해드립니다.
        </p>

        {/* 이미지 업로드 영역 */}
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            isDragging 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 scale-[1.02]' 
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-slate-700'
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
                isDragging ? 'text-blue-700 dark:text-blue-300 font-semibold' : 'text-gray-600 dark:text-gray-300'
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
                  className="px-4 py-2 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors"
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
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-700 dark:text-blue-300 font-semibold">이미지를 분석하고 있습니다...</p>
          <p className="text-blue-600 dark:text-blue-400 text-sm mt-2">잠시만 기다려주세요.</p>
        </div>
      )}

      {/* 오류 메시지 */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-700 dark:text-red-300 font-semibold">오류 발생</p>
          <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* 분석 결과 */}
      {analysisResult && !isAnalyzing && (
        <div className="space-y-6">
          {/* 문서 정보 */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              📄 문서 정보
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">문서 종류</p>
                <p className="font-semibold text-gray-800 dark:text-white">{analysisResult.documentType || '미확인'}</p>
              </div>
              {analysisResult.patientInfo?.name && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">환자명</p>
                  <p className="font-semibold text-gray-800 dark:text-white">{analysisResult.patientInfo.name}</p>
                </div>
              )}
              {analysisResult.medicalInfo?.hospitalName && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">병원명</p>
                  <p className="font-semibold text-gray-800 dark:text-white">{analysisResult.medicalInfo.hospitalName}</p>
                </div>
              )}
              {analysisResult.medicalInfo?.diagnosis && analysisResult.medicalInfo.diagnosis.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">진단명</p>
                  <p className="font-semibold text-gray-800 dark:text-white">
                    {analysisResult.medicalInfo.diagnosis.map((diag: any, idx: number) => {
                      // 객체인 경우 mainDiagnosis 사용, 문자열인 경우 그대로 사용
                      if (typeof diag === 'object' && diag !== null) {
                        const mainDiag = diag.mainDiagnosis || diag.mainDiagnosisEnglish || ''
                        const subDiags = diag.subDiagnosis || []
                        const allDiags = [mainDiag, ...subDiags].filter(Boolean)
                        return allDiags.join(', ')
                      }
                      return diag
                    }).join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 진료비 정보 */}
          {analysisResult.expenses && Object.keys(analysisResult.expenses).length > 0 && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                💰 진료비 정보
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                {analysisResult.expenses.totalAmount && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">총 진료비</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">
                      {parseInt(analysisResult.expenses.totalAmount).toLocaleString()}원
                    </p>
                  </div>
                )}
                {analysisResult.expenses.patientShare && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">본인부담금</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {parseInt(analysisResult.expenses.patientShare).toLocaleString()}원
                    </p>
                  </div>
                )}
                {analysisResult.expenses.coveredAmount && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">급여 총액 (공단 부담)</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {parseInt(analysisResult.expenses.coveredAmount).toLocaleString()}원
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 보험금 분석 */}
          {analysisResult.insuranceAnalysis && Object.keys(analysisResult.insuranceAnalysis).length > 0 && (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                🏥 보험금 분석
              </h3>
              {analysisResult.insuranceAnalysis.applicableInsurance && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">적용 가능한 보험</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(analysisResult.insuranceAnalysis.applicableInsurance) 
                      ? analysisResult.insuranceAnalysis.applicableInsurance.map((insurance: any, idx: number) => {
                          // 객체인 경우 type 속성 사용, 문자열인 경우 그대로 사용
                          const insuranceText = typeof insurance === 'object' && insurance !== null
                            ? insurance.type || insurance.reason || JSON.stringify(insurance)
                            : insurance
                          return (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full text-sm font-semibold"
                            >
                              {insuranceText}
                            </span>
                          )
                        })
                      : null}
                  </div>
                </div>
              )}
              {analysisResult.insuranceAnalysis.estimatedInsuranceAmount && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">예상 보험금</p>
                  <p className="text-3xl font-bold text-purple-700 dark:text-purple-400">
                    {typeof analysisResult.insuranceAnalysis.estimatedInsuranceAmount === 'string' 
                      ? analysisResult.insuranceAnalysis.estimatedInsuranceAmount
                      : parseInt(analysisResult.insuranceAnalysis.estimatedInsuranceAmount).toLocaleString() + '원'}
                  </p>
                </div>
              )}
              {analysisResult.insuranceAnalysis.calculationBasis && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">계산 근거</p>
                  <p className="text-gray-800 dark:text-white">{analysisResult.insuranceAnalysis.calculationBasis}</p>
                </div>
              )}
              {analysisResult.insuranceAnalysis.notes && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">특이사항</p>
                  <p className="text-gray-800 dark:text-white">{analysisResult.insuranceAnalysis.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* 고객 설명 가이드 */}
          {analysisResult.customerGuidance && Object.keys(analysisResult.customerGuidance).length > 0 && (
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                💬 고객 설명 가이드
              </h3>
              {analysisResult.customerGuidance.explanation && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">설명 내용</p>
                  <div className="bg-white dark:bg-slate-700 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                    <p className="text-gray-800 dark:text-white whitespace-pre-wrap leading-relaxed">
                      {analysisResult.customerGuidance.explanation}
                    </p>
                    <button
                      onClick={() => handleCopy(analysisResult.customerGuidance.explanation)}
                      className="mt-3 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded text-sm hover:bg-yellow-200 dark:hover:bg-yellow-900/70 transition-colors"
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
function QAGenerator({ 
  profile, 
  showListOnly = false,
  onTabChange
}: { 
  profile: Profile | null
  showListOnly?: boolean
  onTabChange?: (tab: 'write' | 'history' | 'stats' | 'approval' | 'qa' | 'qa-history' | 'image-analysis' | 'kakao-link') => void
}) {
  const [qaFormData, setQAFormData] = useState<{
    productName: string
    targetPersona: string
    worryPoint: string
    sellingPoint: string
    answerTone: string
    answerLength: 'default'
    designSheetImage: string | null
    designSheetImageUrl?: string | null // 원본 이미지 URL (다운로드용)
    designSheetImageTitle?: string | null // 이미지 제목 (다운로드용)
    designSheetAnalysis?: {
      premium?: string
      coverages?: string[]
      specialClauses?: string[]
    } | null
  }>({
    productName: '',
    targetPersona: '',
    worryPoint: '',
    sellingPoint: '',
    answerTone: 'expert',
    answerLength: 'default',
    designSheetImage: null,
    designSheetImageUrl: null,
    designSheetImageTitle: null,
    designSheetAnalysis: null
  })
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isDraggingOverDesignSheet, setIsDraggingOverDesignSheet] = useState(false)
  const [isGeneratingField, setIsGeneratingField] = useState<{ field: string | null; mode: string | null }>({ field: null, mode: null })
  const [isGeneratingSellingPoint, setIsGeneratingSellingPoint] = useState(false)
  const [isParsingPDF, setIsParsingPDF] = useState(false)
  
  // 연락처 정보 상태
  const [contactInfo, setContactInfo] = useState<{
    enabled: boolean
    emoji: string
    greeting: string
    greeting2: string
    kakaoOpenChat: string
    kakao1on1: string
    youtubeChannel: string
    phone: string
  }>({
    enabled: false,
    emoji: '🐾',
    greeting: '상담요청은 언제나 환영합니다',
    greeting2: '편하게 문의 주세요~~',
    kakaoOpenChat: '',
    kakao1on1: '',
    youtubeChannel: '',
    phone: ''
  })
  const [isSavingContactInfo, setIsSavingContactInfo] = useState(false)
  const [showContactInfoSettings, setShowContactInfoSettings] = useState(false)
  // PDF 선택 기능 - 내일 개별 PDF 준비되면 활성화 예정
  // const [availablePDFs, setAvailablePDFs] = useState<Array<{ name: string; publicUrl: string; category: string }>>([])
  // const [selectedPDF, setSelectedPDF] = useState<string>('')
  const [isGeneratingQuestionFromProduct, setIsGeneratingQuestionFromProduct] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generatedQuestion, setGeneratedQuestion] = useState<{ title: string; content: string } | null>(null)
  const [qaSearchKeywords, setQaSearchKeywords] = useState<string[]>([])
  const [generatedAnswer, setGeneratedAnswer] = useState<string | null>(null)
  const [conversationThread, setConversationThread] = useState<Array<{ role: 'customer' | 'agent'; content: string; step: number }>>([])
  const conversationMode = true // 항상 대화형 모드 활성화
  const DEFAULT_CONVERSATION_LENGTH = 6 // 대화 횟수 고정값 (대댓글 4개)
  const [reviewCount, setReviewCount] = useState<0 | 1 | 2>(0) // 후기성 댓글 개수 (0, 1, 2)
  // Q&A 3개 세트 기능 제거 - 단일 Q&A만 생성
  // const [qaCount, setQaCount] = useState<1 | 3>(3) // 제거됨
  // const [generatedQAs, setGeneratedQAs] = useState<Array<...>>([]) // 제거됨
  // const [selectedQANumber, setSelectedQANumber] = useState<1 | 2 | 3>(1) // 제거됨
  // ⚠️ 테스트용: 토큰 사용량 추적 (실제 운영 시 제거 필요)
  const [tokenUsage, setTokenUsage] = useState<{ promptTokens: number; candidatesTokens: number; totalTokens: number; breakdown?: Array<{ promptTokens: number; candidatesTokens: number; totalTokens: number }> } | null>(null)
  const [currentStep, setCurrentStep] = useState<'question' | 'answer' | 'conversation' | 'complete'>('question')
  
  // Q&A 세트 타입 정의
  type QASet = {
    id: string
    createdAt: string
    title: string
    productName: string
    qas: Array<{
      question: { title: string; content: string }
      answer: string
      conversation?: Array<{ role: 'customer' | 'agent'; content: string; step: number }>
      tokenUsage?: { promptTokens: number; candidatesTokens: number; totalTokens: number }
    }>
    formData: typeof qaFormData
  }
  
  const [qaSets, setQaSets] = useState<QASet[]>([])
  const [selectedQASetId, setSelectedQASetId] = useState<string | null>(null)
  const [showQAList, setShowQAList] = useState(false)
  
  // 사용자별 localStorage 키 생성
  const getQAStorageKey = (): string => {
    if (!profile?.id) {
      console.error('getQAStorageKey: profile.id가 없습니다. profile:', profile)
      throw new Error('프로필 정보가 없습니다')
    }
    return `qa_sets_${profile.id}`
  }
  
  // 로컬스토리지에서 Q&A 세트 불러오기 (사용자별)
  const loadQASets = () => {
    if (typeof window === 'undefined') return
    
    if (!profile?.id) {
      console.warn('Q&A 세트 불러오기 실패: 프로필 정보가 없습니다')
      setQaSets([])
      return
    }
    
    try {
      const storageKey = getQAStorageKey()
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const sets = JSON.parse(stored) as QASet[]
        setQaSets(sets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
        console.log('Q&A 세트 불러오기 완료:', sets.length, '개', 'storageKey:', storageKey, 'profile.id:', profile.id)
      } else {
        setQaSets([])
        console.log('Q&A 세트 없음, storageKey:', storageKey)
      }
    } catch (e) {
      console.error('Q&A 세트 불러오기 오류:', e)
      setQaSets([])
    }
  }
  
  // Q&A 세트 저장 (사용자별 - localStorage + 서버 저장)
  const saveQASet = async (qas: Array<{
    question: { title: string; content: string }
    answer: string
    conversation?: Array<{ role: 'customer' | 'agent'; content: string; step: number }>
    tokenUsage?: { promptTokens: number; candidatesTokens: number; totalTokens: number }
  }>) => {
    if (qas.length === 0) {
      console.warn('Q&A 저장 실패: qas 배열이 비어있습니다')
      return
    }
    
    if (!profile?.id) {
      console.error('Q&A 저장 실패: 프로필 정보가 없습니다. profile:', profile)
      alert('Q&A 저장 실패: 사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.')
      return
    }
    
    if (typeof window === 'undefined') {
      console.warn('Q&A 저장 실패: window가 정의되지 않았습니다')
      return
    }
    
    const title = `${qaFormData.productName || 'Q&A'} - ${new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    const productName = qaFormData.productName || ''
    
    const newSet: QASet = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      title,
      productName,
      qas: qas,
      formData: { ...qaFormData }
    }
    
    // 토큰 사용량 합계 계산
    const tokenTotal = qas.reduce((sum, qa) => {
      return sum + (qa.tokenUsage?.totalTokens || 0)
    }, 0)
    
    // 1. localStorage 저장 (항상 수행)
    try {
      const storageKey = getQAStorageKey()
      const existing = localStorage.getItem(storageKey)
      const sets: QASet[] = existing ? JSON.parse(existing) : []
      sets.unshift(newSet) // 최신 것을 앞에 추가
      
      // 최대 50개까지만 저장
      const limitedSets = sets.slice(0, 50)
      localStorage.setItem(storageKey, JSON.stringify(limitedSets))
      
      console.log('Q&A localStorage 저장 완료:', newSet.title, '저장된 세트 수:', limitedSets.length)
    } catch (error) {
      console.error('Q&A localStorage 저장 오류:', error)
      // localStorage 저장 실패는 경고만 하고 계속 진행
    }
    
    // 2. 서버 저장 (비동기, 실패해도 localStorage는 유지)
    try {
      const response = await fetch('/api/qa/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          productName,
          tokenTotal,
          data: {
            qas: qas,
            formData: qaFormData
          }
        })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || '서버 저장 실패')
      }
      
      console.log('Q&A 서버 저장 완료:', result.id)
      
      // 서버에서 받은 ID를 localStorage에도 반영 (선택사항)
      // 나중에 서버에서 불러올 때 동기화에 사용 가능
    } catch (error) {
      console.error('Q&A 서버 저장 오류:', error)
      // 서버 저장 실패는 로그만 남기고 사용자에게는 알리지 않음
      // localStorage에 이미 저장되어 있으므로 문제없음
    }
    
    // Q&A 목록 새로고침
    loadQASets()
  }
  
  // Q&A 세트 삭제 (사용자별)
  const deleteQASet = (id: string) => {
    if (typeof window !== 'undefined' && profile?.id) {
      const storageKey = getQAStorageKey()
      const existing = localStorage.getItem(storageKey)
      if (existing) {
        const sets: QASet[] = JSON.parse(existing)
        const filtered = sets.filter(s => s.id !== id)
        localStorage.setItem(storageKey, JSON.stringify(filtered))
        loadQASets()
        if (selectedQASetId === id) {
          setSelectedQASetId(null)
          setGeneratedQuestion(null)
          setGeneratedAnswer(null)
          setConversationThread([])
        }
      }
    }
  }
  
  // Q&A 세트 선택 (단일 Q&A만 사용)
  const selectQASet = (set: QASet) => {
    setSelectedQASetId(set.id)
    setShowQAList(false)
    // 첫 번째 Q&A를 표시 (하위 호환성: 저장된 Q&A 세트는 배열 형태)
    if (set.qas.length > 0) {
      const firstQA = set.qas[0]
      setGeneratedQuestion(firstQA.question)
      setGeneratedAnswer(firstQA.answer)
      setConversationThread(firstQA.conversation || [])
      setTokenUsage(firstQA.tokenUsage || null)
    }
    // localStorage에 선택된 Q&A 세트 ID 저장 (다른 탭에서도 접근 가능하도록)
    if (typeof window !== 'undefined' && profile?.id) {
      const storageKey = getQAStorageKey()
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        try {
          const qaSets: QASet[] = JSON.parse(stored)
          const selectedSet = qaSets.find(s => s.id === set.id)
          if (selectedSet) {
            localStorage.setItem(`${storageKey}_selected`, JSON.stringify(selectedSet))
          }
        } catch (e) {
          console.error('Q&A 세트 저장 오류:', e)
        }
      }
    }
  }
  
  // 연락처 정보 불러오기
  const loadContactInfo = async () => {
    if (!profile?.id) {
      console.warn('[연락처 정보] 프로필 ID가 없어서 불러올 수 없습니다')
      return
    }
    
    try {
      const response = await fetch('/api/profile/contact-info')
      
      // response.json()은 한 번만 호출해야 함
      let data
      try {
        data = await response.json()
      } catch (parseError) {
        console.error('[연락처 정보] JSON 파싱 오류:', parseError)
        // JSON 파싱 실패해도 기존 상태 유지
        return
      }
      
      console.log('[연락처 정보] 로드 응답:', { ok: response.ok, status: response.status, data })
      
      // response.ok를 먼저 체크
      if (!response.ok) {
        console.error('[연락처 정보] 로드 실패 (HTTP 에러):', {
          status: response.status,
          statusText: response.statusText,
          error: data.error || '알 수 없는 오류',
          details: data.details,
          code: data.code
        })
        // 에러가 발생해도 기존 상태 유지 (초기화하지 않음)
        return
      }
      
      // response.ok가 true인 경우에만 success 체크
      if (data.success) {
        if (data.contactInfo) {
          // 저장된 정보가 있으면 로드
          setContactInfo({
            enabled: data.contactInfo.enabled || false,
            emoji: data.contactInfo.emoji || '🐾',
            greeting: data.contactInfo.greeting || '상담요청은 언제나 환영합니다',
            greeting2: data.contactInfo.greeting2 || '편하게 문의 주세요~~',
            kakaoOpenChat: data.contactInfo.kakaoOpenChat || '',
            kakao1on1: data.contactInfo.kakao1on1 || '',
            youtubeChannel: data.contactInfo.youtubeChannel || '',
            phone: data.contactInfo.phone || ''
          })
          console.log('[연락처 정보] ✅ 저장된 정보 로드 완료:', data.contactInfo)
        } else {
          // 저장된 정보가 없으면 기본값 유지 (초기화하지 않음)
          console.log('[연락처 정보] 저장된 정보 없음 (null), 기본값 유지')
        }
      } else {
        // success: false인 경우 (예상치 못한 응답 형식)
        console.error('[연락처 정보] 로드 실패 (success: false):', data.error || '알 수 없는 오류')
        // 에러가 발생해도 기존 상태 유지 (초기화하지 않음)
      }
    } catch (error: any) {
      console.error('[연락처 정보] 불러오기 오류 (네트워크/파싱 에러):', error.message || error)
      // 네트워크 오류 등으로 인해 실패해도 기존 상태 유지 (초기화하지 않음)
    }
  }
  
  // 전화번호 포맷팅 함수 (010-XXXX-XXXX 형식)
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

  // 연락처 정보 저장
  const saveContactInfo = async () => {
    if (!profile?.id) {
      alert('로그인이 필요합니다')
      return
    }
    
    setIsSavingContactInfo(true)
    try {
      const response = await fetch('/api/profile/contact-info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactInfo })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        console.error('[연락처 정보 저장 실패]', {
          status: response.status,
          statusText: response.statusText,
          data
        })
        throw new Error(data.error || `저장 실패 (${response.status})`)
      }
      
      if (data.success) {
        // 저장 성공 후 자동으로 다시 로드해서 상태 동기화
        await loadContactInfo()
        alert('연락처 정보가 저장되었습니다!')
        // 저장 후에도 섹션은 열어두기 (사용자가 확인 가능하도록)
        // setShowContactInfoSettings(false) // 제거: 저장 후에도 섹션 열어두기
      } else {
        throw new Error(data.error || '저장 실패')
      }
    } catch (error: any) {
      console.error('연락처 정보 저장 오류:', error)
      alert('연락처 정보 저장 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'))
    } finally {
      setIsSavingContactInfo(false)
    }
  }

  // 컴포넌트 마운트 시 및 프로필 변경 시 저장된 세트 불러오기
  useEffect(() => {
    if (profile?.id) {
      loadQASets()
      loadContactInfo() // 연락처 정보도 함께 불러오기
      // 선택된 Q&A 세트가 있으면 로드 (다른 탭에서 선택한 경우)
      const storageKey = getQAStorageKey()
      const selectedSetStr = localStorage.getItem(`${storageKey}_selected`)
      if (selectedSetStr) {
        try {
          const selectedSet: QASet = JSON.parse(selectedSetStr)
          setSelectedQASetId(selectedSet.id)
          if (selectedSet.qas.length > 0) {
            const firstQA = selectedSet.qas[0]
            setGeneratedQuestion(firstQA.question)
            setGeneratedAnswer(firstQA.answer)
            setConversationThread(firstQA.conversation || [])
            setTokenUsage(firstQA.tokenUsage || null)
          }
          // 사용 후 삭제 (한 번만 로드)
          localStorage.removeItem(`${storageKey}_selected`)
        } catch (e) {
          console.error('선택된 Q&A 세트 로드 오류:', e)
        }
      }
    }
  }, [profile?.id])

  // 제거됨: generatedQAs 관련 useEffect 제거 (단일 Q&A만 사용)

  const handleQAChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setQAFormData(prev => ({ ...prev, [name]: value }))
  }

  // 제목과 본문을 자동으로 분리하는 함수 (클라이언트 측 후처리)
  const parseTitleAndContent = (title: string, content: string, productName?: string): { title: string; content: string } => {
    let parsedTitle = title.trim()
    let parsedContent = content.trim()
    
    // 1. 제목이 너무 길면 (50자 이상) 자동 분리 시도
    if (parsedTitle.length > 50) {
      // 구두점(?, !, .) 기준으로 제목 자르기
      const punctuationMatch = parsedTitle.match(/^(.{0,45}[?!.])/g)
      if (punctuationMatch) {
        // 구두점으로 끝나는 부분까지 제목으로
        parsedTitle = punctuationMatch[0].trim()
        // 나머지는 본문으로
        const remaining = title.substring(punctuationMatch[0].length).trim()
        if (remaining) {
          parsedContent = remaining + (parsedContent ? '\n\n' + parsedContent : '')
        }
      } else {
        // 구두점이 없으면 40자로 자르기
        parsedTitle = parsedTitle.substring(0, 40).trim()
        // 나머지는 본문으로
        const remaining = title.substring(40).trim()
        if (remaining) {
          parsedContent = remaining + (parsedContent ? '\n\n' + parsedContent : '')
        }
      }
    }
    
    // 2. 제목과 본문이 합쳐져 있는 경우 처리 (제목에 본문 내용이 포함된 경우)
    // 제목이 본문의 첫 부분을 포함하고 있으면 제거
    if (parsedContent) {
      const titleLower = parsedTitle.toLowerCase()
      const contentStart = parsedContent.substring(0, Math.min(100, parsedContent.length)).toLowerCase()
      
      // 제목의 마지막 20자 이상이 본문 시작 부분에 포함되어 있으면
      if (parsedTitle.length > 20) {
        const titleEnd = parsedTitle.substring(parsedTitle.length - 20).toLowerCase()
        if (contentStart.includes(titleEnd) || contentStart.startsWith(titleEnd)) {
          // 본문에서 제목의 마지막 부분 제거
          const titleEndIndex = contentStart.indexOf(titleEnd)
          if (titleEndIndex >= 0) {
            parsedContent = parsedContent.substring(titleEndIndex + titleEnd.length).trim()
          }
        }
      }
      
      // 제목과 본문의 첫 문장이 완전히 같거나 매우 유사하면 제거
      const contentFirstSentence = parsedContent.split(/[.!?]\s+/)[0].trim()
      if (contentFirstSentence && contentFirstSentence.length > 10) {
        const similarity = contentFirstSentence.toLowerCase().includes(titleLower.substring(0, 30).toLowerCase()) ||
                          titleLower.includes(contentFirstSentence.substring(0, 30).toLowerCase())
        if (similarity) {
          // 첫 문장 제거
          parsedContent = parsedContent.substring(contentFirstSentence.length).trim()
          // 다음 문장 시작 부분 정리
          parsedContent = parsedContent.replace(/^[.!?]\s*/, '').trim()
        }
      }
    }
    
    // 3. 제목이 본문에 완전히 포함되어 있는 경우 (제목이 본문의 첫 부분)
    if (parsedContent && parsedContent.toLowerCase().startsWith(parsedTitle.toLowerCase())) {
      parsedContent = parsedContent.substring(parsedTitle.length).trim()
      // 본문 시작 부분 정리
      parsedContent = parsedContent.replace(/^[.!?]\s*/, '').trim()
    }
    
    // 4. 최종 검증: 제목이 너무 길면 다시 자르기
    if (parsedTitle.length > 50) {
      // 구두점 기준으로 다시 자르기
      const punctMatch = parsedTitle.match(/^(.{0,45}[?!.])/)
      if (punctMatch) {
        parsedTitle = punctMatch[0].trim()
      } else {
        parsedTitle = parsedTitle.substring(0, 45).trim()
      }
    }
    
    // 5. 제목과 본문이 비어있지 않은지 확인
    if (!parsedTitle || parsedTitle.length < 5) {
      // 제목이 너무 짧으면 기본값 사용
      parsedTitle = `${productName || '보험'} 가입 고민 있어요`
    }
    
    if (!parsedContent || parsedContent.length < 10) {
      // 본문이 너무 짧으면 기본값 사용
      parsedContent = '설계서를 받아봤는데 몇 가지 궁금한 점이 있어서 문의드립니다'
    }
    
    return {
      title: parsedTitle,
      content: parsedContent
    }
  }

  // 상품명 기반 질문글 자동 생성 (정말 귀찮다 버튼)
  const handleAutoGenerateQuestionFromProduct = async () => {
    if (!qaFormData.productName || !qaFormData.productName.trim()) {
      alert('상품명을 먼저 입력해주세요!')
      return
    }

    setIsGeneratingQuestionFromProduct(true)
    setProgress(0)

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
      const response = await fetch('/api/generate-question-from-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productName: qaFormData.productName.trim()
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '질문글 생성 오류')
      }

      clearInterval(progressInterval)
      setProgress(100)

      if (data.success && data.question) {
        // 클라이언트 측 후처리: 제목과 본문을 자동으로 분리
        const parsed = parseTitleAndContent(data.question.title, data.question.content, qaFormData.productName)
        
        console.log('[상품명 기반 질문글 생성] 원본 제목:', data.question.title)
        console.log('[상품명 기반 질문글 생성] 원본 본문:', data.question.content)
        console.log('[상품명 기반 질문글 생성] 후처리 제목:', parsed.title)
        console.log('[상품명 기반 질문글 생성] 후처리 본문:', parsed.content)
        
        // 생성된 질문글을 핵심 고민 필드에 자동 입력
        // 제목과 본문을 합쳐서 worryPoint에 입력
        const questionText = `${parsed.title}\n\n${parsed.content}`
        
        setQAFormData(prev => ({
          ...prev,
          worryPoint: questionText,
          sellingPoint: data.sellingPoint || prev.sellingPoint, // 답변 강조 포인트 자동 입력
          designSheetImage: data.designSheetImage || prev.designSheetImage, // 설계서 이미지 (base64)
          // 설계서 이미지 URL과 제목도 저장 (다운로드용)
          ...(data.designSheetImageUrl && { designSheetImageUrl: data.designSheetImageUrl }),
          ...(data.designSheetImageTitle && { designSheetImageTitle: data.designSheetImageTitle })
        }))

        // 생성된 질문을 generatedQuestion에도 저장 (표시용) - 후처리된 제목과 본문 사용
        setGeneratedQuestion({
          title: parsed.title,
          content: parsed.content
        })

        // 설계서 이미지가 있으면 자동으로 분석도 실행 (비동기, 실패해도 계속 진행)
        if (data.designSheetImage) {
          console.log('[상품명 기반 질문글 생성] 설계서 이미지 발견, 자동 분석 시작...')
          setTimeout(async () => {
            try {
              await handleAnalyzeDesignSheetOnly(data.designSheetImage, true) // silent 모드
              console.log('[상품명 기반 질문글 생성] 설계서 자동 분석 완료')
            } catch (analyzeError: any) {
              console.error('[상품명 기반 질문글 생성] 설계서 자동 분석 오류:', analyzeError)
            }
          }, 500)
        }

        // 메시지 구성 (설계서 이미지와 답변 강조 포인트 포함 여부에 따라)
        let message = ''
        if (data.designSheetImage) {
          message = `질문글, 답변 강조 포인트, 설계서 이미지가 자동으로 생성되어 입력되었습니다!\n상품명: ${qaFormData.productName}\n\n설계서 이미지가 포함되어 있으며, 자동 분석이 진행 중입니다.`
        } else if (data.sellingPoint) {
          message = `질문글과 답변 강조 포인트가 자동으로 생성되어 입력되었습니다!\n상품명: ${qaFormData.productName}`
        } else {
          message = `질문글이 자동으로 생성되어 핵심 고민 필드에 입력되었습니다!\n상품명: ${qaFormData.productName}`
        }
        
        alert(message)
      } else {
        throw new Error('질문글 생성 실패')
      }
    } catch (error: any) {
      console.error('상품명 기반 질문글 생성 오류:', error)
      alert('질문글 생성 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'))
    } finally {
      clearInterval(progressInterval)
      setIsGeneratingQuestionFromProduct(false)
      setProgress(0)
      setTimeout(() => {
        setProgress(0)
      }, 500)
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const processDesignSheetImage = async (file: File) => {
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64String = reader.result as string
      setQAFormData(prev => ({ ...prev, designSheetImage: base64String }))
      
      // 설계서 이미지 업로드 시 자동으로 분석만 수행 (Q&A 생성은 하지 않음)
      setTimeout(async () => {
        await handleAnalyzeDesignSheetOnly(base64String)
      }, 500)
    }
    reader.readAsDataURL(file)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await processDesignSheetImage(file)
  }

  // 설계서 이미지 업로드 시 자동으로 분석만 수행하는 함수
  const handleAnalyzeDesignSheetOnly = async (imageBase64?: string, silent: boolean = false) => {
    const imageToAnalyze = imageBase64 || qaFormData.designSheetImage
    
    if (!imageToAnalyze) {
      if (!silent) {
        alert('설계서 이미지를 먼저 업로드해주세요!')
      }
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
          imageBase64: imageToAnalyze
        }),
      })

      const text = await response.text()
      let data: { success?: boolean; data?: Record<string, unknown>; error?: string }
      try {
        data = JSON.parse(text)
      } catch {
        console.error('[설계서 분석] 응답 파싱 실패 (JSON 아님):', text?.slice(0, 80))
        const msg =
          response.status === 413 || /Request Entity|Payload|too large/i.test(text)
            ? '이미지 크기가 너무 큽니다. 더 작은 이미지로 시도해 주세요.'
            : '서버 응답 형식 오류입니다. 잠시 후 다시 시도해 주세요.'
        if (silent) {
          console.error('[설계서 분석] 오류 (silent):', msg)
          return
        }
        throw new Error(msg)
      }

      if (!response.ok) {
        const errorMessage = data.error || '분석 오류'
        // silent 모드일 때는 오류를 throw하지 않고 조용히 처리
        if (silent) {
          console.error('[설계서 분석] 오류 (silent 모드):', errorMessage)
          return // 조용히 종료
        }
        throw new Error(errorMessage)
      }

      // API에서 반환된 targetPersona를 옵션과 매칭
      const targetPersonaOptions = [
        '20대 직장인 남성', '30대 직장인 남성', '40대 직장인 남성', '50대 직장인 남성', '60대 직장인 남성',
        '30대 자영업자 남성', '40대 자영업자 남성', '50대 자영업자 남성',
        '40대 법인대표 남성', '50대 법인대표 남성', '60대 법인대표 남성',
        '20대 직장인 여성', '30대 직장인 여성', '40대 직장인 여성', '50대 직장인 여성', '60대 직장인 여성',
        '30대 주부', '40대 주부', '50대 주부',
        '30대 자영업자 여성', '40대 자영업자 여성',
        '30대 신혼부부', '40대 신혼부부',
        '30대 자녀 있는 가족', '40대 자녀 있는 가족', '50대 자녀 있는 가족'
      ]
      
      const apiTargetPersona = typeof data.data?.targetPersona === 'string'
        ? data.data.targetPersona as string
        : undefined
      let matchedTargetPersona = apiTargetPersona || qaFormData.targetPersona
      if (apiTargetPersona) {
        // 정확히 일치하는 옵션이 있는지 확인
        const exactMatch = targetPersonaOptions.find(opt => opt === apiTargetPersona)
        if (exactMatch) {
          matchedTargetPersona = exactMatch
        } else {
          // 부분 일치로 찾기
          const apiValue = apiTargetPersona.toLowerCase()
          const partialMatch = targetPersonaOptions.find(opt => {
            const optValue = opt.toLowerCase()
            // 나이대와 성별/직업이 일치하는지 확인
            const hasAge = optValue.includes(apiValue.split('대')[0] + '대') || apiValue.includes(optValue.split('대')[0] + '대')
            const hasGender = (optValue.includes('남성') && (apiValue.includes('남') || !apiValue.includes('여'))) || 
                             (optValue.includes('여성') && apiValue.includes('여')) ||
                             (optValue.includes('주부') && apiValue.includes('주부'))
            const hasJob = optValue.includes('직장인') && (apiValue.includes('직장') || !apiValue.includes('자영') && !apiValue.includes('법인')) ||
                          optValue.includes('자영업자') && apiValue.includes('자영') ||
                          optValue.includes('법인대표') && apiValue.includes('법인') ||
                          optValue.includes('신혼부부') && apiValue.includes('신혼') ||
                          optValue.includes('자녀 있는 가족') && (apiValue.includes('자녀') || apiValue.includes('가족'))
            return hasAge && (hasGender || hasJob)
          })
          matchedTargetPersona = partialMatch || apiTargetPersona
        }
      }

      // 분석 결과로 폼 자동 채우기
      const apiProductName: string | undefined =
        typeof data.data?.productName === 'string' ? (data.data.productName as string) : undefined
      const apiWorryPoint: string | undefined =
        typeof data.data?.worryPoint === 'string' ? (data.data.worryPoint as string) : undefined
      const apiSellingPoint: string | undefined =
        typeof data.data?.sellingPoint === 'string' ? (data.data.sellingPoint as string) : undefined
      const apiPremium: string =
        typeof data.data?.premium === 'string' ? (data.data.premium as string) : ''
      const apiCoverages: string[] =
        Array.isArray(data.data?.coverages) ? (data.data.coverages as string[]) : []
      const apiSpecialClauses: string[] =
        Array.isArray(data.data?.specialClauses) ? (data.data.specialClauses as string[]) : []

      setQAFormData(prev => ({
        ...prev,
        productName: apiProductName || prev.productName,
        targetPersona: matchedTargetPersona,
        worryPoint: apiWorryPoint || prev.worryPoint,
        sellingPoint: apiSellingPoint || prev.sellingPoint,
        designSheetImage: imageToAnalyze,
        designSheetAnalysis: {
          premium: apiPremium,
          coverages: apiCoverages,
          specialClauses: apiSpecialClauses
        }
      }))
      
      console.log('타겟고객 매칭:', { 
        원본: apiTargetPersona, 
        매칭결과: matchedTargetPersona 
      })

      if (!silent) {
        alert('설계서 분석이 완료되었습니다! 폼이 자동으로 채워졌습니다. 필요시 수정 후 "Q&A 생성하기" 버튼을 눌러주세요.')
      }
    } catch (error: any) {
      console.error('설계서 분석 오류:', error)
      // silent 모드가 아닐 때만 사용자에게 오류 표시
      if (!silent) {
        alert('설계서 분석 중 오류가 발생했습니다: ' + error.message)
      }
      // silent 모드일 때는 오류를 다시 throw하지 않음 (자동 분석 실패를 조용히 처리)
      if (!silent) {
        throw error
      }
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAnalyzeDesignSheet = async () => {
    // 설계서만 분석하고 Q&A 생성은 하지 않음
    if (!qaFormData.designSheetImage) {
      alert('설계서 이미지를 먼저 업로드해주세요!')
      return
    }

    await handleAnalyzeDesignSheetOnly()
  }

  // 필드 재생성/완성 핸들러
  const handleGenerateField = async (field: 'worryPoint' | 'sellingPoint', mode: 'regenerate' | 'complete') => {
    if (!qaFormData.productName || !qaFormData.targetPersona) {
      alert('상품명과 타겟 고객을 먼저 입력해주세요')
      return
    }

    setIsGeneratingField({ field, mode })

    try {
      // 핵심 고민 생성 시 답변 강조 포인트도 함께 생성할지 결정
      const shouldAlsoGenerateSellingPoint = field === 'worryPoint'
      const hasExistingSellingPoint = qaFormData.sellingPoint && qaFormData.sellingPoint.trim().length > 0
      
      // 답변 강조 포인트가 있으면 확인 팝업
      let alsoGenerate = false
      if (shouldAlsoGenerateSellingPoint) {
        if (!hasExistingSellingPoint) {
          // 비어있으면 자동 생성 (확인 없음)
          alsoGenerate = true
          setIsGeneratingSellingPoint(true) // 답변강조포인트도 로딩 상태로
        } else {
          // 있으면 확인 팝업
          alsoGenerate = confirm('답변 강조 포인트도 핵심 고민에 맞춰 업데이트할까요?')
          if (alsoGenerate) {
            setIsGeneratingSellingPoint(true) // 확인 누르면 답변강조포인트도 로딩 상태로
          }
        }
      }

      const response = await fetch('/api/generate-qa-field', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          field,
          mode,
          productName: qaFormData.productName,
          targetPersona: qaFormData.targetPersona,
          currentValue: qaFormData[field],
          designSheetImage: qaFormData.designSheetImage,
          designSheetAnalysis: qaFormData.designSheetAnalysis,
          alsoGenerateSellingPoint: alsoGenerate,
          worryPointValue: field === 'worryPoint' ? (mode === 'complete' ? qaFormData.worryPoint : null) : null
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '필드 생성에 실패했습니다')
      }

      if (data.success && data.value) {
        const updates: any = {
          [field]: data.value
        }

        // 답변 강조 포인트도 함께 생성된 경우
        if (data.sellingPoint) {
          updates.sellingPoint = data.sellingPoint
        }

        setQAFormData(prev => ({
          ...prev,
          ...updates
        }))
      }
    } catch (error: any) {
      console.error('필드 생성 오류:', error)
      alert('필드 생성 중 오류가 발생했습니다: ' + error.message)
    } finally {
      setIsGeneratingField({ field: null, mode: null })
      setIsGeneratingSellingPoint(false) // 답변강조포인트 로딩 상태 해제
    }
  }

  // 드래그 앤 드롭 핸들러
  const handleDesignSheetDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isGenerating && !isAnalyzing) {
      setIsDraggingOverDesignSheet(true)
    }
  }

  const handleDesignSheetDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOverDesignSheet(false)
  }

  const handleDesignSheetDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOverDesignSheet(false)
    
    if (isGenerating || isAnalyzing) return
    
    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    if (imageFiles.length === 0) {
      alert('이미지 파일만 업로드할 수 있습니다.')
      return
    }
    
    // 첫 번째 이미지 파일 처리
    const file = imageFiles[0]
    await processDesignSheetImage(file)
  }

  const handleRandomGenerate = async () => {
    // 정말 귀찮다 버튼: 매번 랜덤 상품명 선택 (기존 상품명 무시하고 항상 새로 선택)
    const randomProductNames = [
      '한화생명 종신보험',
      '교보생명 암보험',
      'DB손해보험 자동차보험',
      '신한생명 종합건강보험',
      'KB생명 연금보험',
      '현대해상 화재보험',
      '메리츠화재 치아보험',
      '미래에셋생명 어린이보험',
      '교보생명 간병인보험',
      '삼성생명 중대질병보험',
      'DB손해보험 상해보험',
      '현대해상 여행자보험',
      '삼성생명 유사암보험',
      '한화생명 질병보험',
      '교보생명 상해보험',
      'NH농협손해보험 장기요양보험',
      'KB손해보험 배상책임보험',
      '메리츠화재 재물보험',
      'DB생명 교육보험',
      '신한화재 해상보험',
      '현대생명 변액연금보험',
      '삼성생명 정기보험',
      '한화화재 공제보험',
      '교보생명 어린이암보험',
      'KB생명 갱신형보험',
      'NH농협생명 종신보험',
      '현대해상 자동차보험',
      '메리츠생명 암보험',
      '신한생명 종신보험',
      'KB손해보험 화재보험',
      '삼성생명 연금보험',
      '한화생명 치아보험',
      'DB생명 간병인보험',
      '현대생명 중대질병보험',
      '메리츠화재 상해보험',
      '삼성화재 운전자보험',
      '현대해상 운전자보험',
      'DB손해보험 운전자보험',
      'NH농협손해보험 운전자보험',
      'KB손해보험 운전자보험',
      '한화화재 운전자보험',
      '신한화재 운전자보험',
      '메리츠화재 운전자보험',
      '삼성화재 실손의료비보험',
      '현대해상 실손의료비보험',
      'DB손해보험 실손의료비보험',
      '삼성생명 실손의료비보험',
      '한화생명 실손의료비보험',
      '교보생명 실손의료비보험',
      'KB생명 실손의료비보험',
      '신한생명 실손의료비보험'
    ]
    
    // 이전에 선택한 상품명 제외하고 랜덤 선택 (다양성 확보)
    const previousProductName = qaFormData.productName?.trim() || ''
    const availableProducts = previousProductName 
      ? randomProductNames.filter(name => name !== previousProductName)
      : randomProductNames
    
    // 사용 가능한 상품이 있으면 그 중에서 선택, 없으면 전체에서 선택
    const productPool = availableProducts.length > 0 ? availableProducts : randomProductNames
    const randomIndex = Math.floor(Math.random() * productPool.length)
    const randomProductName = productPool[randomIndex]
    
    // 선택된 상품명을 폼에 입력 (상품명만)
    setQAFormData(prev => ({
      ...prev,
      productName: randomProductName
    }))
    
    const productNameToSearch = randomProductName

    // 상품명 기반 질문글 자동 생성 실행 (웹 검색 + AI 생성)
    setIsGeneratingQuestionFromProduct(true)
    setProgress(0)

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
      const response = await fetch('/api/generate-question-from-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productName: productNameToSearch
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '질문글 생성 오류')
      }

      clearInterval(progressInterval)
      setProgress(100)

      if (data.success && data.question) {
        // 클라이언트 측 후처리: 제목과 본문을 자동으로 분리
        const parsed = parseTitleAndContent(data.question.title, data.question.content, productNameToSearch)
        
        console.log('[정말 귀찮다] 원본 제목:', data.question.title)
        console.log('[정말 귀찮다] 원본 본문:', data.question.content)
        console.log('[정말 귀찮다] 후처리 제목:', parsed.title)
        console.log('[정말 귀찮다] 후처리 본문:', parsed.content)
        
        // 생성된 질문글을 핵심 고민 필드에 자동 입력
        // 제목과 본문을 합쳐서 worryPoint에 입력
        const questionText = `${parsed.title}\n\n${parsed.content}`
        
        // 설계서 이미지가 있으면 함께 설정 (이미지와 원본 URL 모두 저장)
        // 답변 강조 포인트도 함께 설정 (API에서 생성된 경우)
        setQAFormData(prev => ({
          ...prev,
          worryPoint: questionText,
          sellingPoint: data.sellingPoint || prev.sellingPoint, // 답변 강조 포인트 자동 입력
          designSheetImage: data.designSheetImage || prev.designSheetImage, // 설계서 이미지 (base64)
          // 설계서 이미지 URL과 제목도 저장 (다운로드용)
          ...(data.designSheetImageUrl && { designSheetImageUrl: data.designSheetImageUrl }),
          ...(data.designSheetImageTitle && { designSheetImageTitle: data.designSheetImageTitle })
        }))

        // 생성된 질문을 generatedQuestion에도 저장 (표시용) - 후처리된 제목과 본문 사용
        setGeneratedQuestion({
          title: parsed.title,
          content: parsed.content
        })

        // 설계서 이미지가 있으면 자동으로 분석도 실행 (비동기, 실패해도 계속 진행)
        if (data.designSheetImage) {
          console.log('[상품명 기반 질문글 생성] 설계서 이미지 발견, 자동 분석 시작...')
          // 약간의 지연 후 설계서 분석 실행 (이미지가 설정된 후)
          // 분석은 백그라운드에서 실행하고, 실패해도 질문글 생성은 성공으로 처리
          setTimeout(async () => {
            try {
              // 자동 분석 시에는 오류 발생 시 사용자에게 alert를 표시하지 않도록 처리
              // handleAnalyzeDesignSheetOnly 내부의 alert를 억제하기 위해 플래그 전달
              await handleAnalyzeDesignSheetOnly(data.designSheetImage, true) // silent 모드
              console.log('[상품명 기반 질문글 생성] 설계서 자동 분석 완료')
            } catch (analyzeError: any) {
              console.error('[상품명 기반 질문글 생성] 설계서 자동 분석 오류:', analyzeError)
              // 분석 실패해도 질문글 생성은 성공한 것으로 처리
              // 사용자에게는 조용히 넘어가고, 설계서 이미지는 이미 설정되어 있음
            }
          }, 500)
        }

        // 메시지 구성 (설계서 이미지와 답변 강조 포인트 포함 여부에 따라)
        let message = ''
        if (data.designSheetImage) {
          message = `질문글, 답변 강조 포인트, 설계서 이미지가 자동으로 생성되어 입력되었습니다!\n상품명: ${productNameToSearch}\n\n설계서 이미지가 포함되어 있으며, 자동 분석이 진행 중입니다.`
        } else if (data.sellingPoint) {
          message = `질문글과 답변 강조 포인트가 자동으로 생성되어 입력되었습니다!\n상품명: ${productNameToSearch}`
        } else {
          message = `질문글이 자동으로 생성되어 핵심 고민 필드에 입력되었습니다!\n상품명: ${productNameToSearch}`
        }
        
        alert(message)
      } else {
        throw new Error('질문글 생성 실패')
      }
    } catch (error: any) {
      console.error('상품명 기반 질문글 생성 오류:', error)
      alert('질문글 생성 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'))
    } finally {
      clearInterval(progressInterval)
      setIsGeneratingQuestionFromProduct(false)
      setProgress(0)
      setTimeout(() => {
        setProgress(0)
      }, 500)
    }
  }

  // 제거됨: Q&A 3개 세트 기능 제거로 인해 handleGenerateQAByNumber 함수 제거

  // 단일 Q&A 생성 (3개 세트 기능 제거)
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
    setTokenUsage(null)
    setCurrentStep('question')

    // 타겟고객 검증
    const trimmedTargetPersona = qaFormData.targetPersona?.trim() || ''
    if (!trimmedTargetPersona) {
      alert('타겟 고객을 입력해주세요')
      return
    }
    if (trimmedTargetPersona.length < 3) {
      alert('타겟 고객을 더 구체적으로 입력해주세요 (최소 3자 이상)')
      return
    }

    try {
      setProgress(30)
      setCurrentStep('question')

      const response = await fetch('/api/generate-qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...qaFormData,
          conversationMode: conversationMode,
          conversationLength: conversationMode ? DEFAULT_CONVERSATION_LENGTH : undefined,
          reviewCount: conversationMode ? reviewCount : undefined, // 후기성 댓글 개수
          generateStep: 'all' // 전체 생성 (질문+답변+대화스레드)
        }),
      })

      // 응답 본문 읽기 시도 (JSON 파싱 실패 처리)
      let data: any = {}
      try {
        const text = await response.text()
        if (text) {
          try {
            data = JSON.parse(text)
          } catch (parseError) {
            console.error('JSON 파싱 오류:', parseError, '응답 본문:', text.substring(0, 500))
            data = { error: `서버 응답 파싱 오류: ${text.substring(0, 200)}` }
          }
        }
      } catch (readError) {
        console.error('응답 읽기 오류:', readError)
        data = { error: '서버 응답을 읽을 수 없습니다' }
      }

      if (!response.ok) {
        const errorMessage = data?.error || data?.message || `Q&A 생성 오류 (${response.status})`
        console.error('Q&A 생성 API 오류:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          details: data?.details,
          fullData: data,
          responseBody: data
        })
        throw new Error(errorMessage)
      }

      // 단일 Q&A 결과 저장
      setGeneratedQuestion({
        title: data.question.title,
        content: data.question.content
      })
      setGeneratedAnswer(data.answer.content)
      setConversationThread(data.conversation || [])
      setTokenUsage(data.tokenUsage || null)

      // 검색 기반 연관 키워드 (최대 5개) 저장
      try {
        const rawKeywords = data.metadata?.searchKeywords
        let parsed: string[] = []
        if (Array.isArray(rawKeywords)) {
          parsed = rawKeywords
        } else if (typeof rawKeywords === 'string') {
          parsed = rawKeywords
            .split(/[,|\n]/)
            .map((k: string) => k.trim())
            .filter((k: string) => k.length > 0)
        }
        setQaSearchKeywords(Array.from(new Set(parsed)).slice(0, 5))
      } catch (e) {
        console.error('검색 키워드 파싱 중 오류:', e)
        setQaSearchKeywords([])
      }

      setProgress(100)
      setCurrentStep('complete')
      
      // 저장된 Q&A 목록에 추가 (하위 호환성: 배열 형태로 저장)
      const qaResult = [{
        question: {
          title: data.question.title,
          content: data.question.content
        },
        answer: data.answer.content,
        conversation: data.conversation || [],
        tokenUsage: data.tokenUsage || undefined
      }]
      
      // Q&A 자동 저장 (localStorage + 서버)
      try {
        await saveQASet(qaResult)
        console.log('Q&A 자동 저장 완료')
      } catch (saveError) {
        console.error('Q&A 자동 저장 오류:', saveError)
        // 저장 실패해도 생성은 완료되었으므로 계속 진행
      }
      
      alert('Q&A 생성이 완료되었습니다!')
    } catch (error: any) {
      console.error('Q&A 생성 오류:', error)
      const errorMessage = error?.message || error?.toString() || '알 수 없는 오류가 발생했습니다'
      console.error('에러 상세:', {
        message: errorMessage,
        error: error,
        stack: error?.stack
      })
      alert('Q&A 생성 중 오류가 발생했습니다: ' + errorMessage)
    } finally {
      setIsGenerating(false)
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

  // 전체 복사 (답변 + 연락처 정보)
  const handleCopyFullAnswer = () => {
    if (!generatedAnswer) return
    
    let fullText = generatedAnswer
    
    // 연락처 정보가 활성화되어 있고 정보가 있으면 추가
    if (contactInfo.enabled && (contactInfo.phone || contactInfo.kakao1on1 || contactInfo.kakaoOpenChat || contactInfo.youtubeChannel)) {
      fullText += '\n\n'
      
      if (contactInfo.greeting) {
        fullText += `${contactInfo.greeting} ${contactInfo.emoji || ''}\n`
      }
      if (contactInfo.greeting2) {
        fullText += `${contactInfo.greeting2}\n`
      }
      
      if (contactInfo.kakao1on1) {
        fullText += `\n💬 카카오톡 1:1 상담 바로가기\n${contactInfo.kakao1on1}\n`
      }
      
      if (contactInfo.kakaoOpenChat) {
        fullText += `\n💬 카카오톡 오픈채팅 바로가기\n${contactInfo.kakaoOpenChat}\n`
      }
      
      if (contactInfo.youtubeChannel) {
        fullText += `\n📺 유튜브 채널 바로가기\n${contactInfo.youtubeChannel}\n`
      }
      
      if (contactInfo.phone) {
        fullText += `\n📞 연락처: ${contactInfo.phone}`
      }
    }
    
    navigator.clipboard.writeText(fullText)
    alert('답변과 연락처 정보가 클립보드에 복사되었습니다!')
  }

  // 연락처 정보 텍스트 생성 (표시용)
  const getContactInfoText = () => {
    if (!contactInfo.enabled || (!contactInfo.phone && !contactInfo.kakao1on1 && !contactInfo.kakaoOpenChat && !contactInfo.youtubeChannel)) {
      return null
    }
    
    return {
      greeting: contactInfo.greeting ? `${contactInfo.greeting} ${contactInfo.emoji || ''}` : '',
      greeting2: contactInfo.greeting2 || '',
      kakao1on1: contactInfo.kakao1on1 || '',
      kakaoOpenChat: contactInfo.kakaoOpenChat || '',
      youtubeChannel: contactInfo.youtubeChannel || '',
      phone: contactInfo.phone || ''
    }
  }

  const handleRegenerateQuestion = async () => {
    if (!qaFormData.productName || !qaFormData.worryPoint || !qaFormData.sellingPoint) return
    
    setIsGenerating(true)
    setProgress(0)
    // 타겟고객 검증
    const trimmedTargetPersona = qaFormData.targetPersona?.trim() || ''
    if (!trimmedTargetPersona) {
      alert('타겟 고객을 입력해주세요')
      return
    }
    if (trimmedTargetPersona.length < 3) {
      alert('타겟 고객을 더 구체적으로 입력해주세요 (최소 3자 이상)')
      return
    }

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
          conversationLength: conversationMode ? DEFAULT_CONVERSATION_LENGTH : undefined,
          reviewCount: conversationMode ? reviewCount : undefined // 후기성 댓글 개수
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

    // 타겟고객 검증
    const trimmedTargetPersona = qaFormData.targetPersona?.trim() || ''
    if (!trimmedTargetPersona) {
      alert('타겟 고객을 입력해주세요')
      return
    }
    if (trimmedTargetPersona.length < 3) {
      alert('타겟 고객을 더 구체적으로 입력해주세요 (최소 3자 이상)')
      return
    }

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
          conversationLength: conversationMode ? DEFAULT_CONVERSATION_LENGTH : undefined
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

  // 목록만 보기 모드
  if (showListOnly) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <History className="w-6 h-6 text-indigo-600" />
              📝 저장된 Q&A 목록 ({qaSets.length})
            </h2>
            <button
              onClick={() => {
                onTabChange?.('qa')
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
            >
              <MessageSquare className="w-4 h-4" />
              새 Q&A 생성
            </button>
          </div>
          
          <div className="overflow-y-auto">
            {qaSets.length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">저장된 Q&A가 없습니다.</p>
                <p className="text-sm">Q&A를 생성하면 자동으로 저장됩니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {qaSets.map((set) => (
                  <div
                    key={set.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedQASetId === set.id
                        ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 shadow-md'
                        : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                    onClick={() => {
                      selectQASet(set)
                      // Q&A 생성기 탭으로 이동하여 선택된 Q&A 표시
                      // 약간의 지연을 두어 state 업데이트가 완료된 후 탭 전환
                      setTimeout(() => {
                        onTabChange?.('qa')
                      }, 100)
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-800 dark:text-white mb-1 truncate">{set.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 truncate">{set.productName}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('이 Q&A 세트를 삭제하시겠습니까?')) {
                            deleteQASet(set.id)
                          }
                        }}
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 ml-2 p-1 flex-shrink-0"
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(set.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {set.qas.length}개
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-600" />
            💬 보험카페 Q&A 생성기
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onTabChange?.('qa-history')
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold"
            >
              <History className="w-4 h-4" />
              저장된 Q&A 목록 ({qaSets.length})
            </button>
          </div>
        </div>
        
        {/* Q&A 목록 모달 - 상단에 고정 (기존 기능 유지) */}
        {showQAList && (
          <div className="fixed top-0 left-0 right-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700 shadow-lg z-50 max-h-[60vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b bg-indigo-50 dark:bg-indigo-900/30">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                저장된 Q&A 목록 ({qaSets.length})
              </h3>
              <button
                onClick={() => setShowQAList(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl font-bold px-2"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto p-4 flex-1 bg-white dark:bg-slate-800">
              {qaSets.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                  <History className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>저장된 Q&A가 없습니다.</p>
                  <p className="text-sm mt-1">Q&A를 생성하면 자동으로 저장됩니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {qaSets.map((set) => (
                    <div
                      key={set.id}
                      className={`border rounded-lg p-3 cursor-pointer transition-all ${
                        selectedQASetId === set.id
                          ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 shadow-md'
                          : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                      onClick={() => selectQASet(set)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-800 dark:text-white mb-1 truncate">{set.title}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 truncate">{set.productName}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(set.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {set.qas.length}개
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('이 Q&A 세트를 삭제하시겠습니까?')) {
                              deleteQASet(set.id)
                            }
                          }}
                          className="text-red-500 hover:text-red-700 ml-2 p-1 flex-shrink-0"
                          title="삭제"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 입력 폼 */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* 왼쪽 컬럼: 질문 입력 (모바일용) */}
          <div className="space-y-4 border-l-4 border-blue-500 dark:border-blue-400 bg-blue-50/30 dark:bg-blue-900/20 rounded-r-lg p-4">
            {/* 모바일용 안내 */}
            <div className="mb-4 flex items-center gap-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
              <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-bold text-blue-800 dark:text-blue-200">
                  📱 모바일용 - 고객 질문
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">
                  고객 질문은 모바일(핸드폰)에서 올려주세요
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                  상품명 *
                </label>
              </div>
              {/* PDF 선택 기능 - 내일 개별 PDF 준비되면 활성화 예정 */}
              {/* <div className="mb-2">
                <select
                  value={selectedPDF}
                  onChange={(e) => {
                    const pdfUrl = e.target.value
                    setSelectedPDF(pdfUrl)
                    if (pdfUrl) {
                      const selectedPDFInfo = availablePDFs.find(pdf => pdf.publicUrl === pdfUrl)
                      if (selectedPDFInfo) {
                        handlePDFSelect(pdfUrl, selectedPDFInfo.category)
                      }
                    }
                  }}
                  disabled={isParsingPDF}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-black dark:text-white disabled:opacity-50"
                >
                  <option value="">📄 소식지 PDF 선택 (선택사항)</option>
                  {availablePDFs.filter(pdf => pdf.category === 'damage').length > 0 && (
                    <optgroup label="손해보험 소식지">
                      {availablePDFs
                        .filter(pdf => pdf.category === 'damage')
                        .map((pdf) => (
                          <option key={pdf.publicUrl} value={pdf.publicUrl}>
                            {pdf.name}
                          </option>
                        ))}
                    </optgroup>
                  )}
                  {availablePDFs.filter(pdf => pdf.category === 'life').length > 0 && (
                    <optgroup label="생명보험 소식지">
                      {availablePDFs
                        .filter(pdf => pdf.category === 'life')
                        .map((pdf) => (
                          <option key={pdf.publicUrl} value={pdf.publicUrl}>
                            {pdf.name}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
                {isParsingPDF && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    ⏳ PDF 파싱 중... 잠시만 기다려주세요.
                  </p>
                )}
              </div> */}
              <input
                type="text"
                name="productName"
                value={qaFormData.productName}
                onChange={handleQAChange}
                disabled={isGeneratingQuestionFromProduct}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="예: KB손해보험 금쪽같은자녀보험 Plus"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                💡 검색 정확도를 위해 상품명, 상품명칭, 버전을 모두 포함해주세요 (예: KB손해보험 금쪽같은자녀보험 Plus)
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                타겟 고객 *
              </label>
              <input
                type="text"
                name="targetPersona"
                value={qaFormData.targetPersona}
                onChange={handleQAChange}
                disabled={isGeneratingQuestionFromProduct}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="예: 30대 직장인 남성"
              />
              {qaFormData.targetPersona && qaFormData.targetPersona.trim().length < 5 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  ⚠️ 타겟 고객을 더 구체적으로 입력해주세요 (최소 5자 이상 권장)
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                  핵심 고민 *
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleGenerateField('worryPoint', 'regenerate')}
                    disabled={isGenerating || isAnalyzing || isGeneratingField.field === 'worryPoint'}
                    className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    title="기존 내용을 완전히 새로 생성"
                  >
                    {isGeneratingField.field === 'worryPoint' && isGeneratingField.mode === 'regenerate' ? (
                      <>
                        <Clock className="w-3 h-3 animate-spin" />
                        생성 중...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        재생성
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateField('worryPoint', 'complete')}
                    disabled={isGenerating || isAnalyzing || isGeneratingField.field === 'worryPoint' || !qaFormData.worryPoint?.trim()}
                    className="px-2 py-1 text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    title="현재 입력을 기반으로 확장/완성"
                  >
                    {isGeneratingField.field === 'worryPoint' && isGeneratingField.mode === 'complete' ? (
                      <>
                        <Clock className="w-3 h-3 animate-spin" />
                        완성 중...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3 h-3" />
                        AI 완성
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="relative">
                <textarea
                  name="worryPoint"
                  value={qaFormData.worryPoint}
                  onChange={handleQAChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all ${
                    isGeneratingField.field === 'worryPoint' 
                      ? 'border-blue-400 dark:border-blue-500 bg-blue-50/30 dark:bg-blue-900/20' 
                      : 'border-gray-300 dark:border-gray-600'
                  } ${isGeneratingQuestionFromProduct ? 'opacity-50 cursor-not-allowed' : ''}`}
                  rows={3}
                  placeholder="예: 보험료가 적당한지, 보장 범위가 충분한지 궁금합니다"
                  disabled={isGeneratingField.field === 'worryPoint' || isGeneratingQuestionFromProduct}
                />
                {isGeneratingField.field === 'worryPoint' && (
                  <div className="absolute inset-0 bg-blue-50/50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <Clock className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-semibold">
                        {isGeneratingField.mode === 'regenerate' ? '재생성 중...' : 'AI 완성 중...'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 설계서 이미지 (선택) - 왼쪽 컬럼에 배치 */}
            <div className="md:block hidden">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                설계서 이미지 (선택)
              </label>
              
              {/* 드래그 앤 드롭 영역 */}
              <div
                onDragOver={handleDesignSheetDragOver}
                onDragLeave={handleDesignSheetDragLeave}
                onDrop={handleDesignSheetDrop}
                className={`border-2 border-dashed rounded-lg p-4 transition-all ${
                  isDraggingOverDesignSheet
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : qaFormData.designSheetImage
                    ? 'border-green-300 bg-green-50 dark:bg-green-900/30'
                    : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
                } ${isGenerating || isAnalyzing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isGenerating || isAnalyzing}
                  className="hidden"
                />
                <div
                  onClick={() => !isGenerating && !isAnalyzing && fileInputRef.current?.click()}
                  className="text-center"
                >
                  {qaFormData.designSheetImage ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-green-600 dark:text-green-400 font-semibold">✓ 설계서 이미지 첨부됨</div>
                        {qaFormData.designSheetImageUrl && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!qaFormData.designSheetImageUrl) return
                              
                              // 이미지 다운로드
                              const link = document.createElement('a')
                              link.href = qaFormData.designSheetImageUrl
                              const url = qaFormData.designSheetImageUrl
                              const fileExtension = url.endsWith('.pdf') ? '.pdf' : url.match(/\.(jpg|jpeg|png|gif|webp)$/i)?.[0] || '.jpg'
                              link.download = qaFormData.designSheetImageTitle || `설계서_${qaFormData.productName || '이미지'}_${new Date().getTime()}${fileExtension}`
                              link.target = '_blank'
                              document.body.appendChild(link)
                              link.click()
                              document.body.removeChild(link)
                            }}
                            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors dark:bg-blue-600 dark:hover:bg-blue-700"
                            title="원본 이미지 다운로드"
                          >
                            📥 다운로드
                          </button>
                        )}
                      </div>
                      <img 
                        src={qaFormData.designSheetImage} 
                        alt="설계서 미리보기" 
                        className="max-w-full max-h-32 mx-auto rounded border border-gray-300 dark:border-gray-600"
                      />
                      {qaFormData.designSheetImageTitle && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={qaFormData.designSheetImageTitle}>
                          {qaFormData.designSheetImageTitle}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-4xl">📎</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {isDraggingOverDesignSheet 
                          ? '여기에 놓으세요' 
                          : '파일을 드래그하거나 클릭하여 업로드'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        이미지 파일만 업로드 가능
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {isAnalyzing && (
                <p className="text-base font-semibold text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-2">
                  <Clock className="w-5 h-5 animate-spin" />
                  설계서 분석 중...
                </p>
              )}
              {qaFormData.designSheetImage && !isAnalyzing && !isGenerating && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ✓ 이미지가 첨부되었습니다. 이미지 업로드 시 자동으로 분석됩니다.
                </p>
              )}
            </div>
          </div>

          {/* 오른쪽 컬럼: 답변 생성 (PC용) */}
          <div className="space-y-4 border-l-4 border-purple-500 dark:border-purple-400 bg-purple-50/30 dark:bg-purple-900/20 rounded-r-lg p-4">
            {/* PC용 안내 */}
            <div className="mb-4 flex items-center gap-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
              <Monitor className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-bold text-purple-800 dark:text-purple-200">
                  💻 PC용 - 설계사 답변
                </div>
                <div className="text-xs text-purple-600 dark:text-purple-300 mt-0.5">
                  설계사 답변은 PC에서 작성해주세요
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                  답변 강조 포인트 *
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleGenerateField('sellingPoint', 'regenerate')}
                    disabled={isGenerating || isAnalyzing || isGeneratingField.field === 'sellingPoint' || isGeneratingSellingPoint}
                    className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    title="기존 내용을 완전히 새로 생성"
                  >
                    {(isGeneratingField.field === 'sellingPoint' && isGeneratingField.mode === 'regenerate') || isGeneratingSellingPoint ? (
                      <>
                        <Clock className="w-3 h-3 animate-spin" />
                        생성 중...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        재생성
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateField('sellingPoint', 'complete')}
                    disabled={isGenerating || isAnalyzing || isGeneratingField.field === 'sellingPoint' || isGeneratingSellingPoint || !qaFormData.sellingPoint?.trim()}
                    className="px-2 py-1 text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    title="현재 입력을 기반으로 확장/완성"
                  >
                    {(isGeneratingField.field === 'sellingPoint' && isGeneratingField.mode === 'complete') || isGeneratingSellingPoint ? (
                      <>
                        <Clock className="w-3 h-3 animate-spin" />
                        완성 중...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3 h-3" />
                        AI 완성
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="relative">
                <textarea
                  name="sellingPoint"
                  value={qaFormData.sellingPoint}
                  onChange={handleQAChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all ${
                    (isGeneratingField.field === 'sellingPoint' || isGeneratingSellingPoint)
                      ? 'border-purple-400 dark:border-purple-500 bg-purple-50/30 dark:bg-purple-900/20' 
                      : 'border-gray-300 dark:border-gray-600'
                  } ${isGeneratingQuestionFromProduct ? 'opacity-50 cursor-not-allowed' : ''}`}
                  rows={3}
                  placeholder="예: 보장 범위가 넓고, 보험료 대비 합리적이며, 특약 구성이 탄탄함"
                  disabled={isGeneratingField.field === 'sellingPoint' || isGeneratingSellingPoint || isGeneratingQuestionFromProduct}
                />
                {(isGeneratingField.field === 'sellingPoint' || isGeneratingSellingPoint) && (
                  <div className="absolute inset-0 bg-purple-50/50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                      <Clock className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-semibold">
                        {isGeneratingSellingPoint ? '재생성 중...' : (isGeneratingField.mode === 'regenerate' ? '재생성 중...' : 'AI 완성 중...')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                답변 톤
              </label>
              <select
                name="answerTone"
                value={qaFormData.answerTone}
                onChange={handleQAChange}
                disabled={isGeneratingQuestionFromProduct}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="friendly">친절한</option>
                <option value="expert">전문적인</option>
                <option value="comparative">비교형</option>
                <option value="persuasive">설득형</option>
              </select>
            </div>


            {/* 후기성 댓글 옵션 (컴팩트) */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                후기성 댓글:
              </label>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setReviewCount(count as 0 | 1 | 2)}
                    disabled={isGenerating || isAnalyzing}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      reviewCount === count
                        ? 'bg-purple-600 text-white font-semibold'
                        : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {count}개
                  </button>
                ))}
              </div>
            </div>

            {/* 설계서 이미지 (선택) - 작은 화면에서만 오른쪽에 표시 */}
            <div className="md:hidden">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                설계서 이미지 (선택)
              </label>
              
              {/* 드래그 앤 드롭 영역 */}
              <div
                onDragOver={handleDesignSheetDragOver}
                onDragLeave={handleDesignSheetDragLeave}
                onDrop={handleDesignSheetDrop}
                className={`border-2 border-dashed rounded-lg p-4 transition-all ${
                  isDraggingOverDesignSheet
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : qaFormData.designSheetImage
                    ? 'border-green-300 bg-green-50 dark:bg-green-900/30'
                    : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
                } ${isGenerating || isAnalyzing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isGenerating || isAnalyzing}
                  className="hidden"
                />
                <div
                  onClick={() => !isGenerating && !isAnalyzing && fileInputRef.current?.click()}
                  className="text-center"
                >
                  {qaFormData.designSheetImage ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-green-600 dark:text-green-400 font-semibold">✓ 설계서 이미지 첨부됨</div>
                        {qaFormData.designSheetImageUrl && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!qaFormData.designSheetImageUrl) return
                              
                              // 이미지 다운로드
                              const link = document.createElement('a')
                              link.href = qaFormData.designSheetImageUrl
                              const url = qaFormData.designSheetImageUrl
                              const fileExtension = url.endsWith('.pdf') ? '.pdf' : url.match(/\.(jpg|jpeg|png|gif|webp)$/i)?.[0] || '.jpg'
                              link.download = qaFormData.designSheetImageTitle || `설계서_${qaFormData.productName || '이미지'}_${new Date().getTime()}${fileExtension}`
                              link.target = '_blank'
                              document.body.appendChild(link)
                              link.click()
                              document.body.removeChild(link)
                            }}
                            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors dark:bg-blue-600 dark:hover:bg-blue-700"
                            title="원본 이미지 다운로드"
                          >
                            📥 다운로드
                          </button>
                        )}
                      </div>
                      <img 
                        src={qaFormData.designSheetImage} 
                        alt="설계서 미리보기" 
                        className="max-w-full max-h-32 mx-auto rounded border border-gray-300 dark:border-gray-600"
                      />
                      {qaFormData.designSheetImageTitle && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={qaFormData.designSheetImageTitle}>
                          {qaFormData.designSheetImageTitle}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-4xl">📎</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {isDraggingOverDesignSheet 
                          ? '여기에 놓으세요' 
                          : '파일을 드래그하거나 클릭하여 업로드'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        이미지 파일만 업로드 가능
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {isAnalyzing && (
                <p className="text-base font-semibold text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-2">
                  <Clock className="w-5 h-5 animate-spin" />
                  설계서 분석 중...
                </p>
              )}
              {qaFormData.designSheetImage && !isAnalyzing && !isGenerating && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ✓ 이미지가 첨부되었습니다. 이미지 업로드 시 자동으로 분석됩니다.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Q&A 생성 모드 선택 제거됨 - 단일 Q&A만 생성 */}

        {/* 연락처 정보 설정 섹션 */}
        <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowContactInfoSettings(!showContactInfoSettings)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span className="font-semibold text-gray-800 dark:text-white">
                연락처 정보 설정 (답변 하단에 표시)
              </span>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {showContactInfoSettings ? '접기 ▲' : '펼치기 ▼'}
            </span>
          </button>
          
          {showContactInfoSettings && (
            <div className="p-4 bg-white dark:bg-slate-800 space-y-4 border-t border-gray-200 dark:border-gray-700">
              {/* 체크박스만 먼저 표시 */}
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <input
                  type="checkbox"
                  id="contactInfoEnabled"
                  checked={contactInfo.enabled}
                  onChange={(e) => setContactInfo(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="contactInfoEnabled" className="text-sm font-semibold text-gray-700 dark:text-gray-200 cursor-pointer">
                  답변 하단에 연락처 정보 추가
                </label>
              </div>
              
              {/* 입력 필드들은 항상 표시 (체크박스와 독립적으로) */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    이모티콘
                  </label>
                  <input
                    type="text"
                    value={contactInfo.emoji}
                    onChange={(e) => setContactInfo(prev => ({ ...prev, emoji: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-black dark:text-white"
                    placeholder="🐾"
                    maxLength={5}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    전화번호
                  </label>
                  <input
                    type="text"
                    value={contactInfo.phone}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value)
                      setContactInfo(prev => ({ ...prev, phone: formatted }))
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-black dark:text-white"
                    placeholder="010-xxxx-xxxx"
                    maxLength={13}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    안내 문구 1
                  </label>
                  <input
                    type="text"
                    value={contactInfo.greeting}
                    onChange={(e) => setContactInfo(prev => ({ ...prev, greeting: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-black dark:text-white"
                    placeholder="상담요청은 언제나 환영합니다"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    안내 문구 2
                  </label>
                  <input
                    type="text"
                    value={contactInfo.greeting2}
                    onChange={(e) => setContactInfo(prev => ({ ...prev, greeting2: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-black dark:text-white"
                    placeholder="편하게 문의 주세요~~"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    카카오톡 오픈채팅 링크
                  </label>
                  <input
                    type="text"
                    value={contactInfo.kakaoOpenChat}
                    onChange={(e) => setContactInfo(prev => ({ ...prev, kakaoOpenChat: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-black dark:text-white"
                    placeholder="https://open.kakao.com/o/..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    카카오톡 1:1 상담 링크
                  </label>
                  <input
                    type="text"
                    value={contactInfo.kakao1on1}
                    onChange={(e) => setContactInfo(prev => ({ ...prev, kakao1on1: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-black dark:text-white"
                    placeholder="https://open.kakao.com/o/..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    유튜브 채널 링크
                  </label>
                  <input
                    type="text"
                    value={contactInfo.youtubeChannel}
                    onChange={(e) => setContactInfo(prev => ({ ...prev, youtubeChannel: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-black dark:text-white"
                    placeholder="https://www.youtube.com/@..."
                  />
                </div>
              </div>
              
              {/* 저장 버튼은 항상 표시 (체크박스만 체크하고 저장도 가능) */}
              <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={saveContactInfo}
                  disabled={isSavingContactInfo}
                  className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isSavingContactInfo ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      저장
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    // 초기화: 저장된 정보 다시 로드
                    loadContactInfo()
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  저장된 정보 불러오기
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 전체 생성 버튼 (하위 호환성) */}
        <div className="flex gap-3">
            <button
              onClick={handleGenerateQA}
              disabled={isGenerating || !qaFormData.productName || !qaFormData.worryPoint || !qaFormData.sellingPoint}
              className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-purple-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm"
            >
              {isGenerating ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  생성 중... ({progress}%)
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Q&A 생성하기
                </>
              )}
            </button>
            <button
              onClick={handleRandomGenerate}
              disabled={isGenerating || isAnalyzing || isGeneratingQuestionFromProduct}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 whitespace-nowrap text-sm relative"
            >
              {isGeneratingQuestionFromProduct ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  생성 중... ({progress}%)
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  🎲 정말 귀찮다
                </>
              )}
            </button>
        </div>
      </div>

      {/* 로딩 오버레이 (정말 귀찮다 버튼 클릭 시) */}
      {isGeneratingQuestionFromProduct && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            {/* 큰 로딩 스피너 */}
            <div className="flex flex-col items-center justify-center space-y-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 border-4 border-purple-200 dark:border-purple-800 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-transparent border-t-purple-600 dark:border-t-purple-400 rounded-full animate-spin"></div>
              </div>
              
              {/* 진행률 표시 */}
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <span>질문 생성 중입니다...</span>
                  <span className="text-purple-600 dark:text-purple-400">{progress}%</span>
                </div>
                {/* 프로그레스 바 */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
              
              {/* 진행 단계 표시 */}
              <div className="text-center space-y-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {progress < 30 ? '상품 검색 중...' : progress < 70 ? '질문 생성 중...' : '답변 포인트 생성 중...'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  잠시만 기다려주세요
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 결과 미리보기 */}
      {(generatedQuestion || generatedAnswer) && (
        <div className="space-y-6">
          {/* 토큰 사용량 표시 (관리자만 볼 수 있음) */}
          {tokenUsage && profile?.role === 'admin' && (
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
          
          {/* 단일 Q&A 표시 */}
          {generatedQuestion && generatedAnswer && (
            <div className="qa-generator-container grid md:grid-cols-2 gap-6" style={{ 
              contain: 'layout style paint',
              isolation: 'isolate',
              position: 'relative',
              zIndex: 1
            }}>
              {/* 질문 영역 - 모바일용 */}
              <div className="qa-question-container bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border-l-4 border-blue-500 dark:border-blue-400 bg-blue-50/20 dark:bg-blue-900/10" style={{ 
                contain: 'layout style paint',
                isolation: 'isolate',
                position: 'relative',
                zIndex: 1
              }}>
                <div className="flex items-center gap-2 mb-3 bg-blue-100 dark:bg-blue-900/40 rounded-lg p-2 border border-blue-200 dark:border-blue-700">
                  <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    📱 모바일용 - 고객 질문글
                  </span>
                </div>
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                    질문글
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRegenerateQuestion}
                      disabled={isGeneratingQuestionFromProduct}
                      className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      🔄 재생성
                    </button>
                    <button
                      onClick={handleCopyQuestion}
                      disabled={isGeneratingQuestionFromProduct}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Copy className="w-3 h-3" />
                      복사
                    </button>
                  </div>
                </div>
                {isGeneratingQuestionFromProduct ? (
                  // 스켈레톤 로딩 UI
                  <div className="space-y-4 animate-pulse">
                    {/* 제목 스켈레톤 */}
                    <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    {/* 구분선 */}
                    <div className="h-px bg-gray-200 dark:bg-gray-700"></div>
                    {/* 본문 스켈레톤 */}
                    <div className="space-y-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    </div>
                  </div>
                ) : generatedQuestion ? (
                  <div className="text-gray-800 dark:text-gray-200">
                    {/* 제목 */}
                    <h4 className="font-bold text-gray-900 dark:text-white text-xl mb-4">
                      {generatedQuestion.title}
                    </h4>
                    {/* 핵심 키워드 (검색 API 기반) */}
                    {qaSearchKeywords.length > 0 && (
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                          🔍 핵심 키워드
                        </span>
                        {qaSearchKeywords.map((kw) => (
                          <span
                            key={kw}
                            className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 text-xs text-blue-700 dark:text-blue-300"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* 제목과 본문 구분선 */}
                    <div className="mb-6 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
                    {/* 본문 - 문단별로 깔끔하게 표시 (제목과 중복되는 첫 부분 제거) */}
                    <div className="space-y-5">
                      {(() => {
                        // 본문에서 "제목:" 접두사 제거
                        let content = generatedQuestion.content
                          .replace(/^제목[:\s]*/i, '')
                          .trim()
                        
                        // 본문을 문단으로 분리
                        const paragraphs = content.split(/\n\n+/).filter(p => p.trim())
                        
                        // 제목과 본문의 중복 제거 (더 강화된 로직)
                        let filteredParagraphs = paragraphs
                        if (paragraphs.length > 0) {
                          const firstParagraph = paragraphs[0].trim()
                          const titleTrimmed = generatedQuestion.title.trim()
                          
                          // 제목에서 핵심 키워드 추출 (상품명, 질문 내용 등)
                          const titleWords = titleTrimmed
                            .replace(/[?~!]/g, '')
                            .split(/\s+/)
                            .filter(w => w.length > 2) // 2자 이상인 단어만
                          
                          // 첫 문단이 제목과 중복되는지 확인
                          const isDuplicate = titleTrimmed && (
                              // 완전히 동일하거나
                              firstParagraph === titleTrimmed ||
                              // 제목으로 시작하거나
                              firstParagraph.startsWith(titleTrimmed) ||
                              // 제목의 첫 30자 이상이 본문 첫 부분과 일치하거나
                              (titleTrimmed.length > 30 && firstParagraph.startsWith(titleTrimmed.substring(0, 30))) ||
                              // 제목의 마지막 부분이 본문 첫 부분에 포함되거나 (예: 제목이 "...이거 괜찮나요?제가 나이가"로 끝나고 본문이 "제가 나이가..."로 시작)
                              (titleTrimmed.length > 20 && firstParagraph.includes(titleTrimmed.substring(Math.max(0, titleTrimmed.length - 20)))) ||
                              // 제목의 핵심 키워드들이 본문 첫 문장에 순서대로 많이 나타나거나
                              (titleWords.length > 0 && titleWords.filter(word => firstParagraph.includes(word)).length >= Math.min(3, titleWords.length))
                          )
                          
                          if (isDuplicate) {
                            // 중복되는 부분 제거 시도
                            // 제목의 마지막 부분(마지막 20자)을 본문에서 찾아 제거
                            if (titleTrimmed.length > 20) {
                              const titleEnd = titleTrimmed.substring(Math.max(0, titleTrimmed.length - 20))
                              if (firstParagraph.startsWith(titleEnd)) {
                                const cleaned = firstParagraph.substring(titleEnd.length).trim()
                                if (cleaned.length > 10) { // 충분히 남아있으면
                                  filteredParagraphs = [cleaned, ...paragraphs.slice(1)]
                                } else {
                                  filteredParagraphs = paragraphs.slice(1) // 너무 짧으면 그냥 제거
                                }
                              } else {
                                filteredParagraphs = paragraphs.slice(1)
                              }
                            } else {
                              filteredParagraphs = paragraphs.slice(1)
                            }
                          }
                        }
                        
                        // 필터링 후에도 문단이 없으면 원본 본문 사용 (단, 제목 부분은 제거)
                        if (filteredParagraphs.length === 0 && content.trim().length > 0) {
                          const titleTrimmed = generatedQuestion.title.trim()
                          // 제목의 마지막 부분부터 제거 시도
                          if (titleTrimmed.length > 20) {
                            const titleEnd = titleTrimmed.substring(Math.max(0, titleTrimmed.length - 20))
                            if (content.startsWith(titleEnd)) {
                              content = content.substring(titleEnd.length).trim()
                            } else if (content.startsWith(titleTrimmed)) {
                              content = content.substring(titleTrimmed.length).trim()
                            }
                          } else if (content.startsWith(titleTrimmed)) {
                            content = content.substring(titleTrimmed.length).trim()
                          }
                          content = content.replace(/^[\s\n]+/, '').trim()
                          filteredParagraphs = content.split(/\n\n+/).filter(p => p.trim())
                        }
                        
                        return filteredParagraphs.map((paragraph, idx) => (
                          <p
                            key={idx}
                            className="mb-5 last:mb-0 text-gray-800 dark:text-gray-200"
                            style={{
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                              lineHeight: '1.95',
                              fontSize: '15px',
                              maxWidth: '100%',
                              letterSpacing: '0.01em',
                              paddingBottom: '0'
                            }}
                          >
                            {paragraph.trim()}
                          </p>
                        ))
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                    질문 생성 중...
                  </div>
                )}
              </div>

              {/* 답변 영역 - PC용 */}
              <div className="qa-answer-container bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border-l-4 border-purple-500 dark:border-purple-400 bg-purple-50/20 dark:bg-purple-900/10" style={{ 
                contain: 'layout style paint',
                isolation: 'isolate',
                position: 'relative',
                zIndex: 1
              }}>
                <div className="flex items-center gap-2 mb-3 bg-purple-100 dark:bg-purple-900/40 rounded-lg p-2 border border-purple-200 dark:border-purple-700">
                  <Monitor className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                    💻 PC용 - 설계사 답변
                  </span>
                </div>
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
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
                      title="답변만 복사"
                    >
                      <Copy className="w-3 h-3" />
                      답변만
                    </button>
                    <button
                      onClick={handleCopyFullAnswer}
                      disabled={!generatedAnswer}
                      className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-md hover:bg-purple-700 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="답변 + 연락처 정보 전체 복사"
                    >
                      <Copy className="w-3 h-3" />
                      전체 복사
                    </button>
                  </div>
                </div>
                {generatedAnswer ? (
                  <>
                    <div className="text-gray-800 dark:text-gray-200">
                      {generatedAnswer.split(/\n\n+/).filter(p => p.trim()).map((paragraph, idx) => (
                        <p
                          key={idx}
                          className="mb-5 last:mb-0 text-gray-800 dark:text-gray-200"
                          style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            lineHeight: '1.95',
                            fontSize: '15px',
                            maxWidth: '100%',
                            letterSpacing: '0.01em',
                            paddingBottom: '0'
                          }}
                        >
                          {paragraph.trim()}
                        </p>
                      ))}
                    </div>
                    
                    {/* 연락처 정보 (활성화되어 있고 정보가 있을 때만 표시) */}
                    {(() => {
                      const contactInfoText = getContactInfoText()
                      if (!contactInfoText) return null
                      
                      return (
                        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                          {contactInfoText.greeting && (
                            <p className="text-gray-700 dark:text-gray-300 mb-2 text-base font-medium">
                              {contactInfoText.greeting}
                            </p>
                          )}
                          {contactInfoText.greeting2 && (
                            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                              {contactInfoText.greeting2}
                            </p>
                          )}
                          
                          {contactInfoText.kakao1on1 && (
                            <div className="mb-3">
                              <p className="text-gray-700 dark:text-gray-300 text-sm font-medium mb-1">
                                💬 카카오톡 1:1 상담 바로가기
                              </p>
                              <a 
                                href={contactInfoText.kakao1on1} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-purple-600 dark:text-purple-400 hover:underline text-sm break-all"
                              >
                                {contactInfoText.kakao1on1}
                              </a>
                            </div>
                          )}
                          
                          {contactInfoText.kakaoOpenChat && (
                            <div className="mb-3">
                              <p className="text-gray-700 dark:text-gray-300 text-sm font-medium mb-1">
                                💬 카카오톡 오픈채팅 바로가기
                              </p>
                              <a 
                                href={contactInfoText.kakaoOpenChat} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-purple-600 dark:text-purple-400 hover:underline text-sm break-all"
                              >
                                {contactInfoText.kakaoOpenChat}
                              </a>
                            </div>
                          )}
                          
                          {contactInfoText.youtubeChannel && (
                            <div className="mb-3">
                              <p className="text-gray-700 dark:text-gray-300 text-sm font-medium mb-1">
                                📺 유튜브 채널 바로가기
                              </p>
                              <a 
                                href={contactInfoText.youtubeChannel} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-purple-600 dark:text-purple-400 hover:underline text-sm break-all"
                              >
                                {contactInfoText.youtubeChannel}
                              </a>
                            </div>
                          )}
                          
                          {contactInfoText.phone && (
                            <div>
                              <p className="text-gray-700 dark:text-gray-300 text-sm font-medium mb-1">
                                📞 연락처
                              </p>
                              <p className="text-gray-800 dark:text-gray-200 text-sm">
                                {contactInfoText.phone}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                    {generatedQuestion ? '답변 생성 중...' : '질문을 먼저 생성해주세요'}
                  </div>
                )}
              </div>
            </div>
          )}

        
        {/* 대화형 스레드 (카카오톡/슬랙 스타일) */}
        {conversationThread.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 mt-6 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-600" />
                💬 대화형 댓글 스레드 ({conversationThread.length}개)
              </h3>
              <button
                onClick={() => {
                  const allThreads = conversationThread.map(msg => {
                    if (msg.role === 'customer') {
                      const isReviewComment = msg.step >= 1999
                      const customerName = isReviewComment ? '타회원' : '질문자'
                      return `👤 ${customerName}: ${msg.content}`
                    }
                    return `👨‍💼 설계사: ${msg.content}`
                  }).join('\n\n')
                  navigator.clipboard.writeText(allThreads)
                  alert('전체 대화가 클립보드에 복사되었습니다!')
                }}
                className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-md hover:bg-purple-700 transition-colors flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                전체 복사
              </button>
            </div>
            
            {/* 카카오톡/슬랙 스타일 채팅 컨테이너 (시각적 구분 강화) */}
            <div className="bg-gradient-to-b from-gray-50 to-gray-100 dark:from-slate-700 dark:to-slate-800 rounded-lg p-6 max-h-[700px] overflow-y-auto">
              <div className="space-y-4">
                {conversationThread.map((message, idx) => {
                  const isCustomer = message.role === 'customer'
                  const prevMessage = idx > 0 ? conversationThread[idx - 1] : null
                  const nextMessage = idx < conversationThread.length - 1 ? conversationThread[idx + 1] : null
                  const showAvatar = !prevMessage || prevMessage.role !== message.role || idx === 0
                  const isGrouped = nextMessage && nextMessage.role === message.role
                  
                  // 고객 이름 결정: 후기성 댓글(step >= 1999)은 "타회원", 그 외 고객 댓글은 "질문자"
                  const isReviewComment = isCustomer && message.step >= 1999
                  const customerName = isReviewComment ? '타회원' : '질문자'
                  
                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 ${isCustomer ? 'justify-start' : 'justify-end'} ${
                        showAvatar ? 'mt-2' : 'mt-1'
                      }`}
                    >
                      {/* 왼쪽: 고객 아바타 (왼쪽에만) - 모바일용 */}
                      {isCustomer && (
                        <div className={`flex-shrink-0 ${showAvatar ? 'block' : 'invisible'}`}>
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-base font-bold shadow-lg ring-2 ring-blue-200 ring-offset-2" title="📱 모바일용 - 고객 질문">
                              👤
                            </div>
                            {showAvatar && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white shadow-sm"></div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* 중앙: 메시지 버블 */}
                      <div className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'} max-w-[70%] ${isCustomer ? 'ml-0' : 'mr-0'}`}>
                        {/* 이름 표시 (같은 역할이 연속될 때는 첫 메시지에만) */}
                        {showAvatar && (
                          <div className={`mb-2 ${isCustomer ? 'ml-1' : 'mr-1'}`}>
                            <div className={`text-sm font-bold flex items-center gap-1 ${
                              isCustomer ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'
                            }`}>
                              {isCustomer ? (
                                <>
                                  <Smartphone className="w-3 h-3" />
                                  <span>{customerName}</span>
                                  <span className="text-xs font-normal text-blue-500 dark:text-blue-400">(모바일)</span>
                                </>
                              ) : (
                                <>
                                  <Monitor className="w-3 h-3" />
                                  <span>설계사</span>
                                  <span className="text-xs font-normal text-purple-500 dark:text-purple-400">(PC)</span>
                                </>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              댓글 #{Math.ceil((message.step + 1) / 2)}
                            </div>
                          </div>
                        )}
                        
                        {/* 말풍선 */}
                        <div className="group relative">
                          <div
                            className={`rounded-2xl px-5 py-3 shadow-lg hover:shadow-xl transition-all duration-200 ${
                              isCustomer
                                ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-bl-sm'
                                : 'bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-br-sm dark:from-purple-600 dark:to-purple-700'
                            } ${isGrouped ? (isCustomer ? 'rounded-tl-sm' : 'rounded-tr-sm') : ''}`}
                            style={{
                              wordBreak: 'break-word',
                              boxShadow: isCustomer 
                                ? '0 4px 12px rgba(59, 130, 246, 0.3)' 
                                : '0 4px 12px rgba(147, 51, 234, 0.3)'
                            }}
                          >
                            <p className="text-sm whitespace-pre-wrap leading-relaxed text-white">
                              {message.content}
                            </p>
                          </div>
                          
                          {/* 복사 버튼 (호버 시) */}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(message.content)
                              alert('댓글이 클립보드에 복사되었습니다!')
                            }}
                            className={`absolute opacity-0 group-hover:opacity-100 transition-all duration-200 p-2 rounded-full ${
                              isCustomer 
                                ? 'bg-white text-blue-600 shadow-lg -right-10 top-1/2 -translate-y-1/2' 
                                : 'bg-white text-purple-600 shadow-lg -left-10 top-1/2 -translate-y-1/2'
                            } hover:scale-110`}
                            title="복사"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* 댓글 번호 (아바타가 없을 때만) */}
                        {!showAvatar && (
                          <div className={`text-xs text-gray-400 dark:text-gray-500 mt-1 px-2 ${isCustomer ? 'ml-1' : 'mr-1'}`}>
                            #{Math.ceil((message.step + 1) / 2)}
                          </div>
                        )}
                      </div>
                      
                      {/* 오른쪽: 설계사 아바타 (오른쪽에만) - PC용 */}
                      {!isCustomer && (
                        <div className={`flex-shrink-0 ${showAvatar ? 'block' : 'invisible'}`}>
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 flex items-center justify-center text-white text-base font-bold shadow-lg ring-2 ring-purple-200 dark:ring-purple-700 ring-offset-2" title="💻 PC용 - 설계사 답변">
                              👨‍💼
                            </div>
                            {showAvatar && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-400 rounded-full border-2 border-white shadow-sm"></div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          심의필 만들기
        </h2>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* 입력 폼 */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  회사명
                </label>
                <div className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-200">
                  프라임에셋
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  지점명
                  {formData.branchName && !isEditingBranch && (
                    <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">(저장됨)</span>
                  )}
                </label>
                {isEditingBranch ? (
                  <div>
                    <input
                      type="text"
                      value={formData.branchName}
                      onChange={(e) => handleInputChange('branchName', e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-1.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
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
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-200 cursor-not-allowed"
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    저장됨
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  설계사명
                </label>
                <input
                  type="text"
                  value={formData.designerName}
                  onChange={(e) => handleInputChange('designerName', e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
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
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-1.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
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
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-200 cursor-not-allowed"
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    저장됨
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                심의필 번호
              </label>
              <input
                type="text"
                value={formData.approvalNumber}
                onChange={(e) => handleInputChange('approvalNumber', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
                placeholder="00000"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  유효기간 시작일
                </label>
                <input
                  type="text"
                  value={formData.approvalStartDate}
                  onChange={(e) => handleInputChange('approvalStartDate', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
                  placeholder="2026.00.00"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  유효기간 종료일
                </label>
                <input
                  type="text"
                  value={formData.approvalEndDate}
                  onChange={(e) => handleInputChange('approvalEndDate', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
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
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
              미리보기
            </label>
            <div className="bg-white dark:bg-slate-700 rounded-lg border-2 border-gray-300 dark:border-gray-600 overflow-hidden shadow-lg">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="심의필 미리보기"
                  className="w-full h-auto block"
                />
              ) : (
                <div className="w-full h-64 bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
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

// 카톡 유입 추적 링크 생성기 컴포넌트
function KakaoLinkGenerator({ profile }: { profile: Profile | null }) {
  const [channelId, setChannelId] = useState<string>('')
  const [isEditingChannelId, setIsEditingChannelId] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string>('')
  const [sourceInfo, setSourceInfo] = useState<string>('') // 출처 정보 (예: 네이버 블로그 - 수술비 보험 글)

  // localStorage 키 (사용자별)
  const getStorageKey = () => {
    if (!profile?.id) return 'kakao_channel_id_default'
    return `kakao_channel_id_${profile.id}`
  }

  // 고유 추적 코드 생성 (타임스탬프 + 랜덤 문자열로 고유성 보장)
  const generateUniqueTrackingCode = (): string => {
    const timestamp = Date.now().toString(36) // 타임스탬프를 36진수로 변환 (8-9자리)
    const randomStr = Math.random().toString(36).substring(2, 6) // 랜덤 문자열 4자리
    // 총 12-13자리: 타임스탬프(8-9자리) + 랜덤(4자리)
    return `${timestamp}${randomStr}`.toUpperCase()
  }

  // 채널 ID 로드
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(getStorageKey())
      if (stored) {
        setChannelId(stored)
      } else {
        // 기본 채널 ID 설정 (http://pf.kakao.com/_JxmxaJn/chat)
        const defaultChannelId = 'JxmxaJn'
        setChannelId(defaultChannelId)
        // 기본값을 localStorage에 저장
        localStorage.setItem(getStorageKey(), defaultChannelId)
      }
    }
  }, [profile?.id])

  // 채널 ID 저장
  const handleSaveChannelId = () => {
    if (!channelId.trim()) {
      alert('채널 ID를 입력해주세요')
      return
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(getStorageKey(), channelId.trim())
      setIsEditingChannelId(false)
      alert('채널 ID가 저장되었습니다')
    }
  }

  // 채널 ID 수정
  const handleEditChannelId = () => {
    setIsEditingChannelId(true)
  }

  // 채널 ID에서 순수 ID만 추출 (URL이 포함되어 있을 경우 처리)
  const extractChannelId = (input: string): string => {
    const trimmed = input.trim()
    
    // 전체 URL이 입력된 경우
    if (trimmed.includes('pf.kakao.com')) {
      // https://pf.kakao.com/_JxmxaJn 또는 https://pf.kakao.com/_JxmxaJn/chat 형식
      const match = trimmed.match(/pf\.kakao\.com\/_([^\/\?]+)/)
      if (match && match[1]) {
        return match[1]
      }
    }
    
    // 이미 순수 ID만 입력된 경우
    return trimmed
  }

  // 링크 생성 (출처 정보를 짧은 해시로 변환하여 포함)
  const handleGenerateLink = () => {
    if (!channelId.trim()) {
      alert('먼저 채널 ID를 입력해주세요')
      setIsEditingChannelId(true)
      return
    }

    if (!sourceInfo.trim()) {
      alert('출처 정보를 입력해주세요 (예: 네이버 블로그 - 수술비 보험 글)')
      return
    }

    // 채널 ID에서 순수 ID만 추출
    const pureChannelId = extractChannelId(channelId)
    
    // 고유 추적 코드 생성 (타임스탬프 + 랜덤으로 겹치지 않음 보장)
    const trackingCode = generateUniqueTrackingCode()
    
    // 출처 정보를 짧게 인코딩 (한글은 URL 인코딩되면 길어지므로 해시 사용)
    const sourceHash = sourceInfo.trim().split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0)
    }, 0).toString(36).substring(0, 4).toUpperCase()

    // 카톡 채널 링크 생성 (고유 추적 코드와 출처 해시 포함)
    // 카톡 채널 링크 형식: https://pf.kakao.com/_[채널ID]/chat?ref=[추적코드]&s=[출처해시]
    const kakaoLink = `https://pf.kakao.com/_${pureChannelId}/chat?ref=${trackingCode}&s=${sourceHash}`
    
    setGeneratedLink(kakaoLink)
  }

  // 링크 복사
  const handleCopyLink = () => {
    if (!generatedLink) {
      alert('먼저 링크를 생성해주세요')
      return
    }

    navigator.clipboard.writeText(generatedLink)
    alert('링크가 클립보드에 복사되었습니다!')
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-3">
        <LinkIcon className="w-7 h-7 text-blue-600" />
        카톡 유입 추적 링크 생성기
      </h2>

      <p className="text-gray-600 dark:text-gray-300 mb-6">
        고유번호가 자동으로 포함된 카톡 채널 링크를 생성합니다. 네이버에서 이미지에 링크를 붙일 때 사용하세요.
      </p>

      {/* 채널 ID 설정 */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-blue-600" />
          카톡 채널 ID 설정
        </h3>

        {isEditingChannelId ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                채널 ID 또는 채널 링크
              </label>
              <input
                type="text"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder="JxmxaJn 또는 https://pf.kakao.com/_JxmxaJn"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                채널 ID만 입력하거나 전체 링크를 입력해도 자동으로 처리됩니다 (예: JxmxaJn 또는 https://pf.kakao.com/_JxmxaJn)
              </p>
            </div>
            <button
              onClick={handleSaveChannelId}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
            >
              💾 저장
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">현재 채널 ID</p>
              <p className="text-lg font-bold text-gray-800 dark:text-white">{channelId || '설정되지 않음'}</p>
            </div>
            <button
              onClick={handleEditChannelId}
              className="px-4 py-2 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors text-sm font-semibold"
            >
              ✏️ 수정
            </button>
          </div>
        )}
      </div>

      {/* 링크 생성 및 복사 */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-green-600" />
          추적 링크 생성
        </h3>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
            출처 정보 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={sourceInfo}
            onChange={(e) => setSourceInfo(e.target.value)}
            placeholder="예: 네이버 블로그 - 수술비 보험 글"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            이 링크가 어디의 어떤 글에 사용되는지 입력하세요. 카카오톡에서 유입 추적 시 표시됩니다.
          </p>
        </div>

        <button
          onClick={handleGenerateLink}
          disabled={!channelId || !sourceInfo.trim()}
          className="w-full mb-4 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed"
        >
          🔗 링크 생성하기
        </button>

        {generatedLink && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-700 rounded-lg p-4 border-2 border-green-200 dark:border-green-800">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">생성된 링크</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={generatedLink}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-slate-600 text-sm text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  복사
                </button>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                💡 <strong>사용 방법:</strong> 생성된 링크를 복사하여 네이버에서 이미지에 링크를 붙이세요. 
                매번 생성할 때마다 새로운 추적 코드가 자동으로 포함되어 겹치지 않습니다.
                <br />
                <br />
                <strong>유입 추적:</strong> 카카오톡 비즈니스 채널 관리 페이지에서 이 링크로 들어온 사용자의 출처 정보를 확인할 수 있습니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

