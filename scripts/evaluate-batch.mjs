/**
 * 배치 결과 5축 평가 스크립트
 *  - A. 질문(글) 품질
 *  - B. 답변 품질
 *  - C. 댓글(페어) 품질
 *  - D. SEO/키워드 적합성
 *  - E. 사실성/누설 검사
 *
 * 사용:  node scripts/evaluate-batch.mjs [runs-dir]
 *   기본 runs-dir: test-results/runs
 */

import fs from 'fs'
import path from 'path'

const RUNS_DIR = path.resolve(process.cwd(), process.argv[2] || 'test-results/runs')

// 이미지별 누설 키워드 (회사명 + 원본 브랜드명만)
// ⚠️ 일반 카테고리("간편종합보험", "간편고지"는 카테고리이므로 답변에 OK)는 제외
const LEAK_TERMS_BY_IMG = {
  img01: ['하나손보', '하나손해보험', '하나더퍼스트', '하나 더 퍼스트', '하나더 퍼스트'],
  img02: ['흥국화재', '흥국화재해상', '흥Good', '흥굿', '흥 Good', '든든한'],
  img03: ['신한라이프', '신한 라이프', '신한라이프생명', '통합건강보험 ONE', '통합건강 ONE'],
  img04: ['삼성화재', '삼성화재해상', '마이핏1680', '마이핏 1680'],
  img05: ['미래에셋', '미래에셋생명', '미래에셋생명보험', 'M-케어', 'M케어', '엠케어'],
  img06: ['미래에셋', '미래에셋생명', '미래에셋생명보험', 'M-케어', 'M케어', '엠케어', '3.10.5', '3.10'],
}

// 정형/AI 티 패턴 (답변 + 댓글 공통)
const STEREOTYPE_PATTERNS = [
  { id: 'good_but_burden', re: /유리하지만\s*(아니면\s*)?부담/ },
  { id: 'good_but_burden_ko', re: /본인\s*상황에\s*맞으면\s*유리/ },
  { id: 'middle_cancel', re: /중간에\s*해지하면\s*돌려받는\s*돈이\s*거의\s*없는/ },
  { id: 'two_things', re: /딱\s*두\s*가지/ },
  { id: 'ah_now', re: /\b아\s*이제\b/ },
  { id: 'first_second', re: /첫째[,]?\s*[\s\S]{0,30}둘째/ },
  { id: 'core_is', re: /핵심은\s*(딱)?\s*(이거|두\s*가지|하나)/ },
  { id: 'judgment_line', re: /판단\s*기준(을|이)\s*(명확|딱|이렇게)/ },
  { id: 'easy_high_med', re: /[가-힣]+_[가-힣]+/ }, // 언더스코어 잔여 (정규화 결함)
  { id: 'double_typo', re: /([가-힣])\1{1,}요/ }, // "보여요요" 같은 중첩 오타
  { id: 'excess_excl', re: /[!]{2,}|[!][가-힣]{1,5}[!]/ }, // 느낌표 과다
  { id: 'dot_seq', re: /\b\d+\.\d+\.\d+\b/ }, // "3.10.5" 같은 버전 잔여
  { id: 'md_residue', re: /[*_`]{1,3}[가-힣A-Za-z]/ }, // 마크다운 잔여
]

// 키워드 사전 (네이버 카페/블로그 상위 콘텐츠 SEO 기준 — 자동완성/연관검색 분석 기반)
const KEYWORD_DICT = {
  product_type: ['건강보험', '간편보험', '간편심사', '간편고지', '실비보험', '실손', '의료실비', '종합보험', '암보험', '치아보험', '치매보험', '간병보험'],
  product_feature: ['갱신형', '비갱신형', '비갱신', '종신', '만기환급', '무해지', '무해지환급', '저해지', '특약', '담보', '주계약', '표준체', '유병자'],
  generation: ['20대', '30대', '40대', '50대', '60대', '70대', '직장인', '주부', '자영업', '어르신', '엄마', '아빠', '여성', '남성'],
  decision: ['vs', '비교', '후기', '추천', '단점', '장점', '함정', '주의', '가입조건', '가입 조건', '보장한도', '한도', '만기', '면책', '대기기간', '체크', '확인'],
  body_part: ['암', '뇌혈관', '심혈관', '뇌졸중', '심근경색', '갑상선', '유방', '대장', '간암', '폐암', '치매', '관절', '뼈', '진단비', '수술비', '입원'],
  question_phrase: ['궁금', '문의', '질문', '여쭤', '도와주세요', '추천해주세요', '봐주세요', '좀 봐줘', '괜찮을까', '솔직'],
}

// 이미지별 고유 키워드 (조사된 자동완성/연관검색 기반)
const IMG_KEYWORDS = {
  img01: ['무해지환급', '해약환급금', '50대 여성 건강보험', '비갱신', '100세 만기', '진단비', '갑상선', '유방', '부담보'],
  img02: ['갱신형', '비갱신', '20년 갱신', '간편보험', '40대 종합보험', '진단비', '수술비', '간편고지'],
  img03: ['60대 여성', '통합건강보험', '월 2만원', '갱신형', '노후 의료비', '입원일당', '간편고지'],
  img04: ['치매보험', '간편심사', '경도인지장애', '장기요양', '면책기간', '감액기간', '간병', '50대 여성'],
  img05: ['50대 남성', '비갱신', '3대 진단비', '뇌혈관', '심혈관', '수술비', '입원일당', '표준체', 'CI'],
  img06: ['3.10.5', '간편고지', '유병자', '간편보험', '50대 남성', '부담보', '할증', '메리츠', '하나'],
}

// 카페 클릭률 높은 제목 패턴
const CLICK_TITLE_PATTERNS = [
  { id: 'after_review', re: /후기|썼어요|가입했어요|가입한|결정한/ },
  { id: 'vs_compare', re: /\bvs\b|비교|차이/i },
  { id: 'pros_cons', re: /단점|장점|함정|주의|체크/ },
  { id: 'count_list', re: /\d+\s*가지/ },
  { id: 'caution', re: /괜찮을까|되나요|맞나요|충분할까/ },
]

// ─── 유틸 ────────────────────────────────────────────────
function getImgKey(runFolder) {
  const m = runFolder.match(/^(img\d{2})_/)
  return m ? m[1] : null
}
function uniqRatio(arr) {
  if (!arr.length) return 0
  return new Set(arr).size / arr.length
}
function lengthVarCoef(arr) {
  if (arr.length < 2) return 0
  const mean = arr.reduce((s, n) => s + n, 0) / arr.length
  if (mean === 0) return 0
  const variance = arr.reduce((s, n) => s + (n - mean) ** 2, 0) / arr.length
  return Math.sqrt(variance) / mean
}
function findMatches(text, patterns) {
  const hits = []
  for (const p of patterns) {
    const m = text.match(p.re)
    if (m) hits.push({ id: p.id, sample: m[0].slice(0, 40) })
  }
  return hits
}
function countKeywords(text, words) {
  const t = text.toLowerCase()
  return words.filter(w => t.includes(w.toLowerCase())).length
}
function listKeywords(text, words) {
  const t = text.toLowerCase()
  return words.filter(w => t.includes(w.toLowerCase()))
}

// ─── 5축 평가 ────────────────────────────────────────────
function evalQuestion(j) {
  const title = j.questionTitle || ''
  const body = j.questionContent || ''
  const stereo = findMatches(body, STEREOTYPE_PATTERNS)
  return {
    titleLen: title.length,
    titleLenOk: title.length >= 12 && title.length <= 35,
    bodyLen: body.length,
    bodyLenOk: body.length >= 200 && body.length <= 600,
    paragraphs: body.split(/\n+/).filter(p => p.trim()).length,
    excessExcl: (body.match(/[!]/g) || []).length,
    stereotypeHits: stereo,
  }
}

function evalAnswer(j) {
  const a = j.answerContent || ''
  const stereo = findMatches(a, STEREOTYPE_PATTERNS)
  return {
    len: a.length,
    lenOk: a.length >= 280 && a.length <= 520,
    paragraphs: a.split(/\n+/).filter(p => p.trim()).length,
    stereotypeHits: stereo,
  }
}

function evalThread(j) {
  const t = Array.isArray(j.thread) ? j.thread : []
  const lengths = t.map(m => (m.content || '').length)
  const allText = t.map(m => m.content || '').join('\n')
  const stereo = findMatches(allText, STEREOTYPE_PATTERNS)
  const customerOpenings = t.filter(m => m.role === 'customer').map(m => (m.content || '').slice(0, 12))
  const agentOpenings = t.filter(m => m.role === 'agent').map(m => (m.content || '').slice(0, 12))
  return {
    msgCount: t.length,
    lengths,
    lenAvg: lengths.length ? Math.round(lengths.reduce((s, n) => s + n, 0) / lengths.length) : 0,
    lenVarCoef: Number(lengthVarCoef(lengths).toFixed(2)),
    stereotypeHits: stereo,
    customerOpenings,
    agentOpenings,
  }
}

function evalSeo(j, imgKey) {
  const fullText = [j.questionTitle, j.questionContent, j.answerContent,
    ...(Array.isArray(j.thread) ? j.thread.map(m => m.content || '') : [])].join('\n')
  const title = j.questionTitle || ''
  const titleBody = title + '\n' + (j.questionContent || '')
  const cats = {}
  for (const [cat, words] of Object.entries(KEYWORD_DICT)) {
    cats[cat] = listKeywords(fullText, words)
  }
  const totalCats = Object.values(cats).filter(arr => arr.length > 0).length
  const promptKws = Array.isArray(j.promptKeywords) ? j.promptKeywords : []
  const promptKwsInBody = promptKws.filter(k => titleBody.toLowerCase().includes(String(k).toLowerCase()))
  const headKw = j.marketHeadKeyword || ''
  const headInTitle = headKw && title.toLowerCase().includes(headKw.toLowerCase())

  // 이미지별 자동완성 키워드 노출
  const imgKws = IMG_KEYWORDS[imgKey] || []
  const imgKwsHit = imgKws.filter(k => fullText.toLowerCase().includes(String(k).toLowerCase()))
  const imgKwHitRate = imgKws.length ? Number((imgKwsHit.length / imgKws.length).toFixed(2)) : 0

  // 카페 클릭률 높은 제목 패턴
  const titleClickHits = CLICK_TITLE_PATTERNS.filter(p => p.re.test(title)).map(p => p.id)

  return {
    keywordsByCat: cats,
    catsCovered: totalCats,
    promptKeywords: promptKws,
    promptKeywordsInBody: promptKwsInBody,
    promptKwHitRate: promptKws.length ? Number((promptKwsInBody.length / promptKws.length).toFixed(2)) : 0,
    headKeyword: headKw,
    headInTitle,
    imgKeywords: imgKws,
    imgKeywordsHit: imgKwsHit,
    imgKwHitRate,
    titleClickPatterns: titleClickHits,
  }
}

function evalLeak(j, imgKey) {
  // 정책: 질문(고객)은 OK, 답변(설계사/agent)만 누설 검사 대상
  const terms = LEAK_TERMS_BY_IMG[imgKey] || []
  const agentText = [
    j.answerContent,
    ...(Array.isArray(j.thread) ? j.thread.filter(m => m.role === 'agent').map(m => m.content || '') : []),
  ].join('\n')
  const customerText = [
    j.questionTitle,
    j.questionContent,
    ...(Array.isArray(j.thread) ? j.thread.filter(m => m.role === 'customer').map(m => m.content || '') : []),
  ].join('\n')
  const leakedAgent = terms.filter(t => agentText.includes(t))
  const exposedCustomer = terms.filter(t => customerText.includes(t)) // 참고용 (위반 아님)
  return {
    terms,
    leaked: leakedAgent,
    count: leakedAgent.length,
    customerExposure: exposedCustomer,
    customerExposureCount: exposedCustomer.length,
  }
}

// ─── 메인 ────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(RUNS_DIR)) {
    console.error(`runs 폴더 없음: ${RUNS_DIR}`)
    process.exit(1)
  }
  const folders = fs.readdirSync(RUNS_DIR).filter(f => /^img\d{2}_run\d{2}$/.test(f)).sort()
  if (!folders.length) {
    console.error('runs 폴더에 img*_run* 결과 없음')
    process.exit(1)
  }

  const rows = []
  const aggregateStereo = {}
  let totalLeaks = 0
  let leaksByImg = {}

  for (const folder of folders) {
    const genPath = path.join(RUNS_DIR, folder, 'generate.json')
    const qPath = path.join(RUNS_DIR, folder, 'quality.json')
    if (!fs.existsSync(genPath)) continue
    const j = JSON.parse(fs.readFileSync(genPath, 'utf8'))
    const q = fs.existsSync(qPath) ? JSON.parse(fs.readFileSync(qPath, 'utf8')) : null
    const imgKey = getImgKey(folder)
    const A = evalQuestion(j)
    const B = evalAnswer(j)
    const C = evalThread(j)
    const D = evalSeo(j, imgKey)
    const E = evalLeak(j, imgKey)

    for (const h of [...A.stereotypeHits, ...B.stereotypeHits, ...C.stereotypeHits]) {
      aggregateStereo[h.id] = (aggregateStereo[h.id] || 0) + 1
    }
    if (E.count > 0) {
      totalLeaks++
      leaksByImg[imgKey] = (leaksByImg[imgKey] || 0) + 1
    }

    rows.push({
      folder, imgKey,
      qScore: q?.qualityGate?.totalScore ?? null,
      titleLen: A.titleLen, bodyLen: A.bodyLen,
      ansLen: B.len, ansLenOk: B.lenOk,
      threadAvg: C.lenAvg, threadVar: C.lenVarCoef,
      seoCats: D.catsCovered, seoHitRate: D.promptKwHitRate, headInTitle: D.headInTitle,
      imgKwHitRate: D.imgKwHitRate, titleClickPatterns: D.titleClickPatterns,
      leakCount: E.count, leakedTerms: E.leaked,
      customerExposureCount: E.customerExposureCount, customerExposure: E.customerExposure,
      stereoQ: A.stereotypeHits.map(h => h.id),
      stereoA: B.stereotypeHits.map(h => h.id),
      stereoT: C.stereotypeHits.map(h => h.id),
      title: j.questionTitle,
    })
  }

  // ───── 보고 ─────
  console.log('\n=== 회차별 요약 ===')
  console.log(rows.map(r =>
    `${r.folder} | qScore=${r.qScore} | title(${r.titleLen}자) | body(${r.bodyLen}자) | ans(${r.ansLen}자${r.ansLenOk ? '✓' : '✗'}) | thrAvg=${r.threadAvg} thrVar=${r.threadVar} | SEO cats=${r.seoCats}/6 hit=${r.seoHitRate} headTitle=${r.headInTitle ? '✓' : '✗'} | 누설=${r.leakCount}${r.leakCount ? '🚨' : '✅'}`
  ).join('\n'))

  console.log('\n=== A. 질문 ===')
  const titleOk = rows.filter(r => r.titleLen >= 12 && r.titleLen <= 35).length
  const bodyOk = rows.filter(r => r.bodyLen >= 200 && r.bodyLen <= 600).length
  console.log(`제목 길이 12~35자 적정: ${titleOk}/${rows.length}`)
  console.log(`본문 길이 200~600자 적정: ${bodyOk}/${rows.length}`)
  console.log('제목 샘플 (12개):')
  rows.forEach(r => console.log(`  - ${r.folder}: ${r.title}`))

  console.log('\n=== B. 답변 ===')
  const ansLenAvg = Math.round(rows.reduce((s, r) => s + r.ansLen, 0) / rows.length)
  const ansLenOkN = rows.filter(r => r.ansLenOk).length
  console.log(`답변 평균 길이: ${ansLenAvg}자 / 280~520자 적정: ${ansLenOkN}/${rows.length}`)

  console.log('\n=== C. 댓글(페어) ===')
  const thrVarAvg = (rows.reduce((s, r) => s + r.threadVar, 0) / rows.length).toFixed(2)
  console.log(`댓글 길이 변동계수 평균: ${thrVarAvg} (높을수록 다양)`)

  console.log('\n=== D. SEO/키워드 ===')
  const catAvg = (rows.reduce((s, r) => s + r.seoCats, 0) / rows.length).toFixed(1)
  const hitAvg = (rows.reduce((s, r) => s + r.seoHitRate, 0) / rows.length).toFixed(2)
  const headOk = rows.filter(r => r.headInTitle).length
  const imgKwAvg = (rows.reduce((s, r) => s + r.imgKwHitRate, 0) / rows.length).toFixed(2)
  const clickPatHits = rows.filter(r => r.titleClickPatterns.length > 0).length
  console.log(`평균 카테고리 커버리지: ${catAvg}/6 (상품군/특징/세대/의사결정/부위/질문)`)
  console.log(`promptKeyword → 본문 등장률 평균: ${hitAvg}`)
  console.log(`marketHeadKeyword 제목 노출: ${headOk}/${rows.length}`)
  console.log(`이미지별 자동완성 키워드 등장률: ${imgKwAvg}`)
  console.log(`제목 클릭 패턴(후기/vs/단점/N가지/괜찮을까) 적용: ${clickPatHits}/${rows.length}`)
  const clickPatAggregate = {}
  rows.forEach(r => r.titleClickPatterns.forEach(p => clickPatAggregate[p] = (clickPatAggregate[p] || 0) + 1))
  console.log('  ', JSON.stringify(clickPatAggregate))

  console.log('\n=== E. 사실성/누설 ===')
  console.log('정책: 질문(고객)은 노출 OK, 답변(설계사/agent)만 누설 검사')
  console.log(`답변/agent 누설 회차: ${totalLeaks}/${rows.length}`)
  if (totalLeaks > 0) {
    console.log('이미지별 누설:', leaksByImg)
    rows.filter(r => r.leakCount > 0).forEach(r => {
      console.log(`  🚨 ${r.folder} (답변/agent): ${r.leakedTerms.join(', ')}`)
    })
  } else {
    console.log('  ✅ 답변/agent 측 누설 없음')
  }
  console.log('\n[참고] 질문(고객) 측 노출 — 위반 아님:')
  rows.forEach(r => {
    if (r.customerExposureCount > 0) {
      console.log(`  ✓ ${r.folder} (질문): ${r.customerExposure.join(', ')}`)
    }
  })

  console.log('\n=== 정형/AI 티 패턴 집계 (전체 회차 합산) ===')
  const sortedStereo = Object.entries(aggregateStereo).sort((a, b) => b[1] - a[1])
  if (!sortedStereo.length) console.log('  ✅ 정형 패턴 없음')
  else sortedStereo.forEach(([id, n]) => console.log(`  ${id}: ${n}회`))

  // JSON 저장
  const outPath = path.join(RUNS_DIR, '..', 'evaluation.json')
  fs.writeFileSync(outPath, JSON.stringify({ rows, aggregateStereo, totalLeaks, leaksByImg }, null, 2), 'utf8')
  console.log(`\n📄 상세 결과: ${outPath}`)
}

main()
