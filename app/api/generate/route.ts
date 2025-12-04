import { NextRequest, NextResponse } from 'next/server'

// n8n Webhook URL (환경 변수로 설정)
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/blog-generate'

export async function POST(request: NextRequest) {
  try {
    const { topic, keywords, product, tone } = await request.json()

    if (!topic) {
      return NextResponse.json(
        { error: '주제를 입력해주세요' },
        { status: 400 }
      )
    }

    console.log('n8n 워크플로우 호출:', { topic, keywords, product, tone })

    // n8n Webhook으로 요청
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic,
        keywords: keywords || '보험, 가이드, 비교',
        product,
        tone,
      }),
    })

    if (!n8nResponse.ok) {
      throw new Error(`n8n 워크플로우 오류: ${n8nResponse.status}`)
    }

    const result = await n8nResponse.json()

    // n8n에서 반환된 HTML 추출
    let htmlContent = result.html || result.output || result.data?.html

    if (!htmlContent) {
      throw new Error('n8n에서 HTML을 생성하지 못했습니다')
    }

    // 코드 블록 제거 (혹시 있을 경우)
    htmlContent = htmlContent.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim()

    console.log('n8n 워크플로우 성공! HTML 길이:', htmlContent.length)

    return NextResponse.json({
      success: true,
      html: htmlContent,
      metadata: {
        topic,
        keywords,
        wordCount: htmlContent.length,
      },
    })
  } catch (error: any) {
    console.error('n8n 워크플로우 오류:', error)
    
    // 개발용: 오류 시 더미 HTML 반환
    if (process.env.NODE_ENV === 'development') {
      const dummyHTML = generateDummyHTML(error.topic || '보험 가이드')
      return NextResponse.json({
        success: true,
        html: dummyHTML,
        metadata: {
          topic: error.topic || '보험 가이드',
          keywords: '',
          wordCount: dummyHTML.length,
        },
        warning: 'n8n 연결 실패 - 더미 데이터 반환',
      })
    }
    
    return NextResponse.json(
      { error: error.message || 'AI 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

// 개발용 더미 HTML 생성
function generateDummyHTML(topic: string) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${topic} | 완벽 가이드</title>
<style>
:root { --primary: #3683f1; --navy: #25467a; }
body { font-family: -apple-system, sans-serif; margin: 0; padding: 0; background: #f7fafc; }
header { background: linear-gradient(135deg, var(--primary), var(--navy)); color: white; padding: 40px 24px; text-align: center; }
h1 { font-size: 32px; margin: 0; }
main { max-width: 850px; margin: 0 auto; padding: 24px; }
.card { background: white; border-radius: 16px; box-shadow: 0 2px 20px rgba(35, 96, 164, 0.08); padding: 24px; margin: 24px 0; }
</style>
</head>
<body>
<header><h1>${topic}</h1></header>
<main>
<div class="card">
<p><strong>⚠️ n8n 워크플로우 연결 필요</strong></p>
<p>n8n 서버가 실행되지 않았거나 워크플로우가 설정되지 않았습니다.</p>
</div>
</main>
</body>
</html>`
}

