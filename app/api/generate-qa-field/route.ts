import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(request: NextRequest) {
  try {
    const {
      field, // 'worryPoint' | 'sellingPoint'
      mode, // 'regenerate' | 'complete'
      productName,
      targetPersona,
      currentValue, // 현재 입력된 값 (완성 모드에서 사용)
      designSheetImage,
      designSheetAnalysis,
      alsoGenerateSellingPoint, // 핵심 고민 생성 시 답변 강조 포인트도 함께 생성
      worryPointValue // alsoGenerateSellingPoint가 true일 때 사용할 핵심 고민 값
    } = await request.json()

    if (!field || !mode || !productName || !targetPersona) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다' },
        { status: 500 }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash' // 빠른 응답을 위해 Flash 사용
    })

    // 프롬프트 생성
    let prompt = ''
    
    if (mode === 'regenerate') {
      // 재생성 모드: 기존 내용 무시하고 완전히 새로 생성
      if (field === 'worryPoint') {
        prompt = `보험 상품에 대한 고객의 핵심 고민을 작성해주세요.

**[상품 정보]**
- 상품명: ${productName}
- 타겟 고객: ${targetPersona}
${designSheetAnalysis?.premium ? `- 보험료: ${designSheetAnalysis.premium}` : ''}
${designSheetAnalysis?.coverages?.length > 0 ? `- 주요 담보: ${designSheetAnalysis.coverages.slice(0, 3).join(', ')}` : ''}

**[작성 지침]**
1. 이 상품을 고려하는 고객의 실제 고민을 구체적으로 작성
2. 보험료 부담, 보장 범위, 특약 구성 등 실질적인 고민점 포함
3. 2-3문장, 50-100자 내외
4. 자연스러운 문체로 작성

**[출력 형식]**
핵심 고민만 출력하세요 (제목이나 설명 없이).`
      } else if (field === 'sellingPoint') {
        prompt = `보험 상품의 답변 강조 포인트를 작성해주세요.

**[상품 정보]**
- 상품명: ${productName}
- 타겟 고객: ${targetPersona}
${designSheetAnalysis?.premium ? `- 보험료: ${designSheetAnalysis.premium}` : ''}
${designSheetAnalysis?.coverages?.length > 0 ? `- 주요 담보: ${designSheetAnalysis.coverages.slice(0, 3).join(', ')}` : ''}

**[작성 지침]**
1. 이 상품의 주요 장점 2-3개를 구체적으로 작성
2. 보장 범위, 보험료, 특약 구성 등 실질적인 강점 포함
3. 2-3문장, 50-100자 내외
4. 자연스러운 문체로 작성

**[출력 형식]**
답변 강조 포인트만 출력하세요 (제목이나 설명 없이).`
      }
    } else if (mode === 'complete') {
      // 완성 모드: 현재 입력을 기반으로 확장/완성
      if (field === 'worryPoint') {
        prompt = `다음은 보험 상품에 대한 고객의 핵심 고민 초안입니다. 이를 기반으로 더 구체적이고 완성된 문장으로 확장해주세요.

**[초안]**
${currentValue || ''}

**[상품 정보]**
- 상품명: ${productName}
- 타겟 고객: ${targetPersona}
${designSheetAnalysis?.premium ? `- 보험료: ${designSheetAnalysis.premium}` : ''}
${designSheetAnalysis?.coverages?.length > 0 ? `- 주요 담보: ${designSheetAnalysis.coverages.slice(0, 3).join(', ')}` : ''}

**[작성 지침]**
1. 초안의 의도를 유지하면서 더 구체적으로 확장
2. 상품 정보를 반영하여 실질적인 고민점 추가
3. 2-3문장, 50-100자 내외로 완성
4. 자연스러운 문체로 작성

**[출력 형식]**
완성된 핵심 고민만 출력하세요 (제목이나 설명 없이).`
      } else if (field === 'sellingPoint') {
        prompt = `다음은 보험 상품의 답변 강조 포인트 초안입니다. 이를 기반으로 더 구체적이고 완성된 문장으로 확장해주세요.

**[초안]**
${currentValue || ''}

**[상품 정보]**
- 상품명: ${productName}
- 타겟 고객: ${targetPersona}
${designSheetAnalysis?.premium ? `- 보험료: ${designSheetAnalysis.premium}` : ''}
${designSheetAnalysis?.coverages?.length > 0 ? `- 주요 담보: ${designSheetAnalysis.coverages.slice(0, 3).join(', ')}` : ''}

**[작성 지침]**
1. 초안의 의도를 유지하면서 더 구체적으로 확장
2. 상품 정보를 반영하여 실질적인 강점 추가
3. 2-3문장, 50-100자 내외로 완성
4. 자연스러운 문체로 작성

**[출력 형식]**
완성된 답변 강조 포인트만 출력하세요 (제목이나 설명 없이).`
      }
    }

    // 이미지가 있으면 이미지와 함께 전송
    let contentResult
    if (designSheetImage) {
      const base64Data = designSheetImage.includes(',') 
        ? designSheetImage.split(',')[1] 
        : designSheetImage
      
      let mimeType = 'image/png'
      if (designSheetImage.includes('data:image/jpeg') || designSheetImage.includes('data:image/jpg')) {
        mimeType = 'image/jpeg'
      } else if (designSheetImage.includes('data:image/webp')) {
        mimeType = 'image/webp'
      }

      contentResult = await model.generateContent([
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        },
        prompt
      ])
    } else {
      contentResult = await model.generateContent(prompt)
    }

    const response = await contentResult.response
    let text = response.text().trim()

    // 제어 문자 제거
    text = text.replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x1F\x7F]/g, '')
    
    // 마크다운 코드 블록 제거
    text = text.replace(/```[\s\S]*?```/g, '').trim()
    
    // 제목이나 설명 제거 (필드명, "핵심 고민:", "답변 강조 포인트:" 등)
    text = text.replace(/^(핵심 고민|답변 강조 포인트|worryPoint|sellingPoint)[:\s]*/i, '')
    text = text.replace(/^[가-힣\s]*[:：]\s*/g, '')

    const result: { success: boolean; value: string; sellingPoint?: string } = {
      success: true,
      value: text
    }

    // 핵심 고민 생성 시 답변 강조 포인트도 함께 생성
    if (alsoGenerateSellingPoint && field === 'worryPoint') {
      // worryPointValue가 있으면 사용 (완성 모드), 없으면 방금 생성된 text 사용 (재생성 모드)
      const finalWorryPoint = worryPointValue || text
      const sellingPointPrompt = `다음은 보험 상품에 대한 고객의 핵심 고민입니다. 이 고민에 맞춰서 이 상품의 답변 강조 포인트를 작성해주세요.

**[핵심 고민]**
${finalWorryPoint}

**[상품 정보]**
- 상품명: ${productName}
- 타겟 고객: ${targetPersona}
${designSheetAnalysis?.premium ? `- 보험료: ${designSheetAnalysis.premium}` : ''}
${designSheetAnalysis?.coverages?.length > 0 ? `- 주요 담보: ${designSheetAnalysis.coverages.slice(0, 3).join(', ')}` : ''}

**[작성 지침]**
1. 위 핵심 고민을 해결할 수 있는 이 상품의 강점을 구체적으로 작성
2. 고민과 직접적으로 연관된 장점을 우선적으로 강조
   - 예: 고민이 "보험료 부담"이면 → "합리적인 보험료", "보험료 대비 높은 보장"
   - 예: 고민이 "보장 범위"이면 → "넓은 보장 범위", "다양한 특약"
   - 예: 고민이 "특약 구성"이면 → "탄탄한 특약 구성", "선택의 자유도"
3. 2-3문장, 50-100자 내외
4. 자연스러운 문체로 작성

**[출력 형식]**
답변 강조 포인트만 출력하세요 (제목이나 설명 없이).`

      try {
        let sellingPointResult
        if (designSheetImage) {
          const base64Data = designSheetImage.includes(',') 
            ? designSheetImage.split(',')[1] 
            : designSheetImage
          
          let mimeType = 'image/png'
          if (designSheetImage.includes('data:image/jpeg') || designSheetImage.includes('data:image/jpg')) {
            mimeType = 'image/jpeg'
          } else if (designSheetImage.includes('data:image/webp')) {
            mimeType = 'image/webp'
          }

          sellingPointResult = await model.generateContent([
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            },
            sellingPointPrompt
          ])
        } else {
          sellingPointResult = await model.generateContent(sellingPointPrompt)
        }

        const sellingPointResponse = await sellingPointResult.response
        let sellingPointText = sellingPointResponse.text().trim()
        
        // 제어 문자 제거
        sellingPointText = sellingPointText.replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x1F\x7F]/g, '')
        sellingPointText = sellingPointText.replace(/```[\s\S]*?```/g, '').trim()
        sellingPointText = sellingPointText.replace(/^(핵심 고민|답변 강조 포인트|worryPoint|sellingPoint)[:\s]*/i, '')
        sellingPointText = sellingPointText.replace(/^[가-힣\s]*[:：]\s*/g, '')

        result.sellingPoint = sellingPointText
      } catch (error: any) {
        console.error('답변 강조 포인트 자동 생성 오류:', error)
        // 답변 강조 포인트 생성 실패해도 핵심 고민은 반환
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('필드 생성 오류:', error)
    return NextResponse.json(
      { error: error.message || '필드 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
