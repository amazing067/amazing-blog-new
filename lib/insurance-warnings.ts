/**
 * 업무광고심의 작성 참고자료 (25.11.21.)에 따른 보험별 경고 문구
 * 참고: 업무광고광고심의작성참고자료_251121.pdf
 * 
 * 경고문구는 글자 색상 차별 필요, 축약 또는 변경 불가
 */

export interface InsuranceWarning {
  template: string
  keywords: string[]
  warning: string
  category: 'common' | 'life' | 'non-life'
}

export const INSURANCE_WARNINGS: InsuranceWarning[] = [
  // 공통사항 - 업무광고심의 작성 참고자료 기준
  {
    template: 'driver',
    keywords: ['운전자보험', '운전자', '자동차보험', '중과실', '12대 중과실', '12대중과실'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 운전자보험 안내</strong></p><p style="margin: 8px 0 0 0; color: #856404;">12대 중과실 중 무면허, 음주운전 및 뺑소니 사고는 보장에서 제외됩니다.</p></div>',
    category: 'common'
  },
  {
    template: 'medical',
    keywords: ['실비보험', '실비', '실손보험', '실손', '진료비'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 실비보험 안내</strong></p><p style="margin: 8px 0 0 0; color: #856404;">실비보험은 자기부담금을 제외한 금액을 보장하는 보험입니다.</p></div>',
    category: 'common'
  },
  {
    template: 'fetal',
    keywords: ['태아보험', '태아'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 태아보험 안내</strong></p><p style="margin: 8px 0 0 0; color: #856404;">태아보험은 태아 시기에 가입하는 어린이 보험이며, 출생 이후부터 보장됩니다.</p></div>',
    category: 'common'
  },
  {
    template: 'surrender',
    keywords: ['해지환급금', '중도해지', '무-저해지', '저축', '환급', '해지'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 해지환급금 안내</strong></p><p style="margin: 8px 0 0 0; color: #856404;">중도해지 시 납입한 보험료보다 환급금이 적거나 없을 수 있습니다.</p></div>',
    category: 'common'
  },
  {
    template: 'simplified',
    keywords: ['유병력자', '유병자', '간편', '간편가입', '간편상품'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 유병자(간편) 상품 안내</strong></p><p style="margin: 8px 0 0 0; color: #856404;">유병자(간편) 보험은 인수기준에 따라 가입이 거절될 수 있습니다.</p></div>',
    category: 'common'
  },
  
  // 생명보험 적용 사항
  {
    template: 'wholelife-short',
    keywords: ['단기납', '단기납 종신', '단기납종신', '단기납 종신보험'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 단기납 종신보험 안내</strong></p><ul style="margin: 8px 0 0 0; padding-left: 20px; color: #856404;"><li>본 상품은 보장성 보험이므로 저축 목적으로는 적합하지 않습니다.</li><li>중도 해지시 납입한 보험료보다 환급금이 적거나 없을 수 있습니다.</li><li>단기납 종신보험은 동일한 보장내용의 일반 종신보험에 비해 보험료가 비쌀 수 있습니다.</li><li>2년 내 자살 등 보험금 비지급 사유에 해당하는 경우 보험금 지급이 거절될 수 있습니다.</li></ul></div>',
    category: 'life'
  },
  {
    template: 'wholelife',
    keywords: ['종신보험', '종신', '일반 종신보험'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 일반 종신보험 안내</strong></p><ul style="margin: 8px 0 0 0; padding-left: 20px; color: #856404;"><li>본 상품은 보장성 상품으로 저축 목적으로는 적합하지 않습니다.</li><li>중도해지 시 납입한 보험료보다 환급금이 적거나 없을 수 있습니다.</li><li>2년 내 자살 등 보험금 미지급 사유에 해당하는 경우 보험금 지급이 거절될 수 있습니다.</li></ul></div>',
    category: 'life'
  },
  
  // 기타 보험
  {
    template: 'cancer',
    keywords: ['암보험', '암', '암진단비'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 암보험 안내</strong></p><p style="margin: 8px 0 0 0; color: #856404;">암의 정의, 진단 기준, 면책 기간 등은 보험회사 및 상품별로 상이할 수 있습니다. 관련한 세부사항은 반드시 해당 약관을 참조하시기 바랍니다.</p></div>',
    category: 'non-life'
  },
  {
    template: 'dementia',
    keywords: ['치매', '치매간병', '간병'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 치매간병보험 안내</strong></p><p style="margin: 8px 0 0 0; color: #856404;">치매 진단 기준, 장기요양등급 인정 여부, 지급 기준 등은 보험회사 및 상품별로 상이할 수 있습니다. 관련한 세부사항은 반드시 해당 약관을 참조하시기 바랍니다.</p></div>',
    category: 'non-life'
  },
  {
    template: 'travel',
    keywords: ['여행자보험', '해외여행', '여행'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 여행자보험 안내</strong></p><p style="margin: 8px 0 0 0; color: #856404;">테러, 전쟁, 자연재해, 기존 질병 악화 등은 보장에서 제외될 수 있습니다. 보험회사 및 상품별로 상이할 수 있으므로, 관련한 세부사항은 반드시 해당 약관을 참조하시기 바랍니다.</p></div>',
    category: 'non-life'
  },
  {
    template: 'injury',
    keywords: ['상해보험', '상해'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 상해보험 안내</strong></p><p style="margin: 8px 0 0 0; color: #856404;">자해, 자살, 범죄행위, 음주운전 중 사고 등은 보장에서 제외됩니다. 보험회사 및 상품별로 상이할 수 있으므로, 관련한 세부사항은 반드시 해당 약관을 참조하시기 바랍니다.</p></div>',
    category: 'non-life'
  },
  {
    template: 'pension',
    keywords: ['연금보험', '연금'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 연금보험 안내</strong></p><p style="margin: 8px 0 0 0; color: #856404;">연금 수령 시작 시점, 수령 방법, 중도 해지 시 환급금 등은 보험회사 및 상품별로 상이할 수 있습니다. 관련한 세부사항은 반드시 해당 약관을 참조하시기 바랍니다.</p></div>',
    category: 'life'
  },
  {
    template: 'child',
    keywords: ['자녀보험', '어린이보험', '자녀'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 자녀보험 안내</strong></p><p style="margin: 8px 0 0 0; color: #856404;">가입 연령, 보장 범위, 만기 시 처리 등은 보험회사 및 상품별로 상이할 수 있습니다. 관련한 세부사항은 반드시 해당 약관을 참조하시기 바랍니다.</p></div>',
    category: 'life'
  },
  {
    template: 'disease',
    keywords: ['질병보험', '질병'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 질병보험 안내</strong></p><p style="margin: 8px 0 0 0; color: #856404;">기존 질병, 선천성 질환, 면책 기간 등은 보장에서 제외될 수 있습니다. 보험회사 및 상품별로 상이할 수 있으므로, 관련한 세부사항은 반드시 해당 약관을 참조하시기 바랍니다.</p></div>',
    category: 'non-life'
  },
  {
    template: 'hospital',
    keywords: ['입원보험', '입원'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 입원보험 안내</strong></p><p style="margin: 8px 0 0 0; color: #856404;">입원 일수 산정 기준, 면책 일수, 최대 보장 일수 등은 보험회사 및 상품별로 상이할 수 있습니다. 관련한 세부사항은 반드시 해당 약관을 참조하시기 바랍니다.</p></div>',
    category: 'non-life'
  },
  {
    template: 'surgery',
    keywords: ['수술보험', '수술'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 수술보험 안내</strong></p><p style="margin: 8px 0 0 0; color: #856404;">수술의 정의, 보장 범위, 면책 사유 등은 보험회사 및 상품별로 상이할 수 있습니다. 관련한 세부사항은 반드시 해당 약관을 참조하시기 바랍니다.</p></div>',
    category: 'non-life'
  },
  {
    template: 'critical',
    keywords: ['중대질병', '중대질병보험'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 중대질병보험 안내</strong></p><p style="margin: 8px 0 0 0; color: #856404;">중대질병의 정의, 진단 기준, 면책 기간 등은 보험회사 및 상품별로 상이할 수 있습니다. 관련한 세부사항은 반드시 해당 약관을 참조하시기 바랍니다.</p></div>',
    category: 'non-life'
  },
  {
    template: 'circulatory',
    keywords: ['순환계', '심장', '뇌졸중', '심근경색'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 순환계 질환 진단비 보험 안내</strong></p><p style="margin: 8px 0 0 0; color: #856404;">심장질환, 뇌혈관질환의 진단 기준, 보장 범위 등은 보험회사 및 상품별로 상이할 수 있습니다. 관련한 세부사항은 반드시 해당 약관을 참조하시기 바랍니다.</p></div>',
    category: 'non-life'
  },
  {
    template: 'longterm',
    keywords: ['장기요양', '요양'],
    warning: '<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;"><p style="margin: 0; font-weight: 600; color: #856404;"><strong>⚠️ 장기요양보험 안내</strong></p><p style="margin: 8px 0 0 0; color: #856404;">장기요양등급 인정 기준, 보장 범위, 지급 한도 등은 보험회사 및 상품별로 상이할 수 있습니다. 관련한 세부사항은 반드시 해당 약관을 참조하시기 바랍니다.</p></div>',
    category: 'non-life'
  }
]

/**
 * 주제와 키워드를 기반으로 적절한 경고 문구를 찾아 반환
 * 여러 경고 문구가 매칭될 수 있으므로 우선순위에 따라 반환
 */
export function getInsuranceWarning(topic: string, keywords: string, template: string): string | null {
  const searchText = `${topic} ${keywords}`.toLowerCase()
  const matchedWarnings: InsuranceWarning[] = []
  
  // 템플릿 ID로 먼저 찾기 (우선순위 1)
  const templateMatch = INSURANCE_WARNINGS.find(w => w.template === template)
  if (templateMatch) {
    matchedWarnings.push(templateMatch)
  }
  
  // 키워드로 찾기 (우선순위 2)
  for (const warning of INSURANCE_WARNINGS) {
    if (warning.template === template) continue // 이미 추가됨
    
    for (const keyword of warning.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        matchedWarnings.push(warning)
        break
      }
    }
  }
  
  // 우선순위: common > life > non-life
  if (matchedWarnings.length > 0) {
    matchedWarnings.sort((a, b) => {
      const priority = { 'common': 3, 'life': 2, 'non-life': 1 }
      return priority[b.category] - priority[a.category]
    })
    return matchedWarnings[0].warning
  }
  
  return null
}

/**
 * HTML 콘텐츠에 경고 문구를 추가
 * 업무광고심의 작성 참고자료에 따라 적절한 위치에 배치
 */
export function addWarningToHTML(html: string, topic: string, keywords: string, template: string): string {
  const warning = getInsuranceWarning(topic, keywords, template)
  
  if (!warning) {
    return html
  }
  
  // 이미 경고 문구가 있는지 확인 (중복 방지)
  if (html.includes('⚠️') && html.includes('안내</strong>')) {
    // 같은 유형의 경고가 이미 있는지 확인
    const warningType = warning.match(/⚠️\s*([^<]+)\s*안내/)?.[1]
    if (warningType && html.includes(warningType)) {
      return html
    }
  }
  
  // 참고 자료 섹션 앞에 추가 (권장 위치)
  if (html.includes('참고 자료 및 출처') || html.includes('참고자료') || html.includes('출처')) {
    const regex = /(<h[2-6][^>]*>.*?참고\s*(자료|자료 및 출처|출처).*?<\/h[2-6]>)/i
    if (regex.test(html)) {
      return html.replace(regex, `${warning}$1`)
    }
  }
  
  // </body> 태그 앞에 추가
  if (html.includes('</body>')) {
    return html.replace('</body>', `${warning}</body>`)
  }
  
  // </main> 태그 앞에 추가
  if (html.includes('</main>')) {
    return html.replace('</main>', `${warning}</main>`)
  }
  
  // </article> 태그 앞에 추가
  if (html.includes('</article>')) {
    return html.replace('</article>', `${warning}</article>`)
  }
  
  // 그 외의 경우 마지막 </div> 태그 뒤에 추가
  const lastDivIndex = html.lastIndexOf('</div>')
  if (lastDivIndex !== -1) {
    return html.slice(0, lastDivIndex + 6) + warning + html.slice(lastDivIndex + 6)
  }
  
  // 최후의 수단: 마지막에 추가
  return `${html}${warning}`
}
