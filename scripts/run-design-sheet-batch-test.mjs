/**
 * 설계서 PNG 배치 테스트 (기본: 이미지 최대 6개 × RUNS_PER_IMAGE)
 * - generate-qa에 conversationMode 기본 활성화 → 스레드 품질(threadScore)까지 측정
 *   끄려면 BATCH_CONVERSATION=0
 * - CONVERSATION_LENGTH 기본 6 (운영과 맞춤)
 * - 인증: generate-qa는 쿠키 필요. 브라우저 로그인 후 Application > Cookies 에서
 *   sb- 로 시작하는 쿠키 전체를 복사해 AUTH_COOKIE 환경변수로 설정하세요.
 *   없으면 analyze만 성공하고 generate는 401로 실패 처리됩니다.
 *
 * 실행: node scripts/run-design-sheet-batch-test.mjs
 * (개발 서버: npm run dev 를 먼저 띄운 뒤 실행)
 */

import fs from 'fs'
import path from 'path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const AUTH_COOKIE = process.env.AUTH_COOKIE || ''
const INPUT_DIR = path.resolve(process.cwd(), 'test-images')
const OUTPUT_DIR = path.resolve(process.cwd(), 'test-results')
const RUNS_PER_IMAGE = Number(process.env.RUNS_PER_IMAGE || 5)
const BATCH_CONVERSATION = process.env.BATCH_CONVERSATION !== '0'
const CONVERSATION_LENGTH = Number(process.env.CONVERSATION_LENGTH || 6)

// 이미지 목록 (PNG만, 파일명 오름차순)
function getImageList() {
  if (!fs.existsSync(INPUT_DIR)) {
    throw new Error(`입력 폴더가 없습니다: ${INPUT_DIR}`)
  }
  const files = fs.readdirSync(INPUT_DIR)
    .filter(f => f.toLowerCase().endsWith('.png'))
    .sort()
  if (files.length === 0) throw new Error(`PNG 파일이 없습니다: ${INPUT_DIR}`)
  return files
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function toBase64(filePath) {
  const buf = fs.readFileSync(filePath)
  return buf.toString('base64')
}

// Jaccard 유사도 (간단 토큰 기반)
function jaccardSimilarity(a, b) {
  if (!a || !b) return 0
  const tokenize = (s) => new Set(String(s).replace(/[^가-힣a-zA-Z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 1))
  const setA = tokenize(a)
  const setB = tokenize(b)
  if (setA.size === 0 && setB.size === 0) return 0
  let inter = 0
  for (const t of setA) if (setB.has(t)) inter++
  const union = setA.size + setB.size - inter
  return union === 0 ? 0 : inter / union
}

function getFirstSentence(text) {
  if (!text) return ''
  const m = String(text).trim().match(/^.+?[.?!？！\n]/)
  return m ? m[0].trim() : String(text).trim().slice(0, 80)
}

// 로그 수집 (해당 회차)
function createRunLogger(runDir) {
  const lines = []
  return {
    log(...args) {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 0) : String(a)).join(' ')
      lines.push(`[${new Date().toISOString()}] ${msg}`)
      console.log(...args)
    },
    flush() {
      fs.writeFileSync(path.join(runDir, 'raw.log'), lines.join('\n'), 'utf8')
    }
  }
}

function escapeCsv(val) {
  if (val == null) return ''
  const s = String(val)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

async function main() {
  const startedAt = new Date().toISOString()
  // 서버 연결 확인
  try {
    const probe = await fetch(`${BASE_URL}/api/analyze-design-sheet`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    await probe.text()
  } catch (e) {
    console.error('연결 실패:', BASE_URL)
    console.error('먼저 개발 서버를 실행하세요: npm run dev')
    process.exit(1)
  }
  const imageFiles = getImageList()
  const imageCount = Math.min(6, imageFiles.length)
  const images = imageFiles.slice(0, imageCount).map((name, i) => ({
    imageId: `img${String(i + 1).padStart(2, '0')}`,
    originalFileName: name,
    absolutePath: path.join(INPUT_DIR, name),
    relativePath: path.join('test-images', name),
  }))

  ensureDir(OUTPUT_DIR)
  ensureDir(path.join(OUTPUT_DIR, 'runs'))
  ensureDir(path.join(OUTPUT_DIR, 'summary'))

  const allRuns = []
  const runLogs = []

  for (const img of images) {
    for (let run = 1; run <= RUNS_PER_IMAGE; run++) {
      const runId = `${img.imageId}_run${String(run).padStart(2, '0')}`
      const runDir = path.join(OUTPUT_DIR, 'runs', runId)
      ensureDir(runDir)
      const log = createRunLogger(runDir)
      const runStartedAt = new Date().toISOString()

      const inputMeta = {
        imageId: img.imageId,
        runId,
        originalFileName: img.originalFileName,
        absolutePath: img.absolutePath,
        relativePath: img.relativePath,
        startedAt: runStartedAt,
        endedAt: null,
      }

      let analyzeOk = false
      let analyzeData = null
      let generateOk = false
      let generateData = null
      let errorMessage = ''
      let errorStage = ''

      try {
        const base64 = toBase64(img.absolutePath)
        log.log('analyze-design-sheet 요청:', img.originalFileName)

        const analyzeRes = await fetch(`${BASE_URL}/api/analyze-design-sheet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 }),
        })
        const analyzeJson = await analyzeRes.json().catch(() => ({}))
        log.log('analyze-design-sheet 응답 상태:', analyzeRes.status, 'success:', !!analyzeJson?.success)

        if (!analyzeRes.ok || !analyzeJson?.success) {
          errorStage = 'analyze'
          errorMessage = analyzeJson?.error || analyzeRes.statusText || '분석 실패'
          log.log('analyze 실패:', errorMessage)
          fs.writeFileSync(path.join(runDir, 'analyze.json'), JSON.stringify({ error: errorMessage, status: analyzeRes.status, body: analyzeJson }, null, 2), 'utf8')
        } else {
          analyzeOk = true
          analyzeData = analyzeJson.data || analyzeJson
          const analyzeOut = {
            rawProductName: analyzeData.rawProductName ?? analyzeData.productName,
            normalizedProductName: analyzeData.productName,
            correctedProductName: analyzeData.nameCorrection?.corrected ?? null,
            correctionApplied: analyzeData.nameCorrection?.method !== 'none' && analyzeData.nameCorrection?.method !== undefined,
            validationReason: analyzeData.validationReason ?? null,
            validationConfidence: analyzeData.validationConfidence ?? null,
            targetPersona: analyzeData.targetPersona,
            personaBucket: analyzeData.personaBucket,
            topicName: analyzeData.topicCore ?? analyzeData.productName,
            displayProductName: analyzeData.displayProductName,
            cleanProductCore: analyzeData.topicCore,
            topicConcern: analyzeData.topicConcern,
            topicConcernSearch: analyzeData.topicConcernSearch,
            premium: analyzeData.premium,
            worryPoint: analyzeData.worryPoint,
            sellingPoint: analyzeData.sellingPoint,
            coverages: analyzeData.coverages,
            specialClauses: analyzeData.specialClauses,
            searchSummary: analyzeData.searchSummary,
            searchKeywordHints: analyzeData.searchKeywordHints,
            evidenceMap: analyzeData.evidenceMap ? {
              questionFacts: analyzeData.evidenceMap.questionFacts,
              answerFacts: analyzeData.evidenceMap.answerFacts,
              forbiddenPatterns: analyzeData.evidenceMap.forbiddenPatterns,
            } : null,
            conflictAxis: analyzeData.conflictAxis ? {
              proCondition: analyzeData.conflictAxis.proCondition,
              conCondition: analyzeData.conflictAxis.conCondition,
              summary: analyzeData.conflictAxis.summary,
            } : null,
          }
          fs.writeFileSync(path.join(runDir, 'analyze.json'), JSON.stringify(analyzeOut, null, 2), 'utf8')
        }

        if (analyzeOk && analyzeData) {
          const genPayload = {
            productName: analyzeData.productName || analyzeData.rawProductName,
            targetPersona: analyzeData.targetPersona || '30대 직장인',
            worryPoint: analyzeData.worryPoint || '',
            sellingPoint: analyzeData.sellingPoint || '',
            designSheetImage: base64,
            designSheetAnalysis: analyzeData,
            generateStep: 'all',
            ...(BATCH_CONVERSATION
              ? { conversationMode: true, conversationLength: CONVERSATION_LENGTH }
              : {}),
          }
          const headers = { 'Content-Type': 'application/json' }
          if (AUTH_COOKIE) headers['Cookie'] = AUTH_COOKIE
          log.log('generate-qa 요청 (auth:', !!AUTH_COOKIE, ')')
          const genStartMs = Date.now()

          const genRes = await fetch(`${BASE_URL}/api/generate-qa`, {
            method: 'POST',
            headers,
            body: JSON.stringify(genPayload),
          })
          const latencyMs = Date.now() - genStartMs
          const genJson = await genRes.json().catch(() => ({}))
          log.log('generate-qa 응답 상태:', genRes.status, 'success:', !!genJson?.success, 'latencyMs:', latencyMs)

          if (!genRes.ok || !genJson?.success) {
            if (!errorStage) errorStage = 'generate'
            errorMessage = genJson?.error || genRes.statusText || '생성 실패'
            log.log('generate 실패:', errorMessage)
            fs.writeFileSync(path.join(runDir, 'generate.json'), JSON.stringify({ error: errorMessage, status: genRes.status }, null, 2), 'utf8')
            fs.writeFileSync(path.join(runDir, 'quality.json'), JSON.stringify({ error: errorMessage }, null, 2), 'utf8')
            allRuns.push({
              runId,
              imageId: img.imageId,
              originalFileName: img.originalFileName,
              success: false,
              totalScore: null,
              breakdown: {},
              latencyMs,
              totalTokens: null,
              totalCost: null,
              questionTitle: null,
              concernVariant: null,
              openingFamilyId: null,
              titlePatternId: null,
              questionConceptId: null,
              marketHeadKeyword: null,
              failureTags: [],
              qualityWarnings: [],
              regenHistory: null,
              errorMessage,
            })
          } else {
            generateOk = true
            generateData = genJson
            const meta = genJson.metadata || {}
            const usage = genJson.usage || {}
            const q = genJson.question || {}
            const a = genJson.answer || {}
            const genOut = {
              productName: meta.productName,
              targetPersona: meta.targetPersona,
              topicCore: meta.topicName,
              topicConcern: meta.topicCore ? undefined : meta.topicConcern,
              topicConcernSearch: meta.topicConcernSearch,
              displayProductName: meta.displayProductName,
              selectedConcernVariant: meta.concernVariant,
              openingFamilyId: meta.openingFamilyId,
              titlePatternId: meta.titlePatternId,
              questionConceptId: meta.questionConceptId,
              promptKeywords: meta.searchKeywords,
              displayKeywords: meta.searchKeywords,
              marketHeadKeyword: meta.searchKeywords?.[0] ?? null,
              questionTitle: q.title,
              questionContent: q.content,
              answerContent: a.content,
              thread: genJson.conversation,
              reviewCount: null,
              regenHistory: null,
              latencyMs,
              customSearchCount: usage.costEstimate?.customSearchCount,
              customSearchCost: usage.costEstimate?.customSearchCost,
              tokenBreakdown: usage.breakdown,
              totalTokens: usage.totalTokens,
              totalCostEstimate: usage.costEstimate?.totalCost,
            }
            fs.writeFileSync(path.join(runDir, 'generate.json'), JSON.stringify(genOut, null, 2), 'utf8')

            const qg = genJson.qualityGate || {}
            const qualityOut = {
              qualityGate: {
                totalScore: qg.totalScore,
                breakdown: qg.breakdown || {},
                allPassed: qg.allPassed,
                criticalFailures: qg.criticalFailures,
              },
              qualityWarnings: meta.qualityWarnings,
              failureTags: meta.failureTags ?? [],
              humanLikeness: (qg.breakdown && qg.breakdown.humanLikeness) ?? null,
              evidenceConsistency: (qg.breakdown && qg.breakdown.evidenceConsistency) ?? null,
              keywordHealth: (qg.breakdown && qg.breakdown.keywordHealth) ?? null,
              operationalRisk: (qg.breakdown && qg.breakdown.operationalRisk) ?? null,
            }
            fs.writeFileSync(path.join(runDir, 'quality.json'), JSON.stringify(qualityOut, null, 2), 'utf8')

            allRuns.push({
              runId,
              imageId: img.imageId,
              originalFileName: img.originalFileName,
              success: true,
              totalScore: qg.totalScore,
              breakdown: qg.breakdown || {},
              latencyMs,
              totalTokens: usage.totalTokens,
              totalCost: usage.costEstimate?.totalCost,
              questionTitle: q.title,
              concernVariant: meta.concernVariant,
              openingFamilyId: meta.openingFamilyId,
              titlePatternId: meta.titlePatternId,
              questionConceptId: meta.questionConceptId,
              marketHeadKeyword: meta.searchKeywords?.[0],
              failureTags: [], // API 응답에는 없음(usage_logs에만 저장)
              qualityWarnings: meta.qualityWarnings || [],
              regenHistory: null,
              errorMessage: '',
            })
          }
        } else {
          allRuns.push({
            runId,
            imageId: img.imageId,
            originalFileName: img.originalFileName,
            success: false,
            totalScore: null,
            breakdown: {},
            latencyMs: null,
            totalTokens: null,
            totalCost: null,
            questionTitle: null,
            concernVariant: null,
            openingFamilyId: null,
            titlePatternId: null,
            questionConceptId: null,
            marketHeadKeyword: null,
            failureTags: [],
            qualityWarnings: [],
            regenHistory: null,
            errorMessage: errorMessage,
          })
        }
      } catch (err) {
        errorStage = errorStage || 'request'
        errorMessage = err?.message || String(err)
        log.log('예외:', errorMessage)
        if (err?.stack) log.log(err.stack)
        allRuns.push({
          runId,
          imageId: img.imageId,
          originalFileName: img.originalFileName,
          success: false,
          totalScore: null,
          breakdown: {},
          latencyMs: null,
          totalTokens: null,
          totalCost: null,
          questionTitle: null,
          concernVariant: null,
          openingFamilyId: null,
          titlePatternId: null,
          questionConceptId: null,
          marketHeadKeyword: null,
          failureTags: [],
          qualityWarnings: [],
          regenHistory: null,
          errorMessage: errorMessage,
        })
        if (!analyzeData) {
          fs.writeFileSync(path.join(runDir, 'analyze.json'), JSON.stringify({ error: errorMessage }, null, 2), 'utf8')
        }
        if (!generateData) {
          fs.writeFileSync(path.join(runDir, 'generate.json'), JSON.stringify({ error: errorMessage }, null, 2), 'utf8')
          fs.writeFileSync(path.join(runDir, 'quality.json'), JSON.stringify({ error: errorMessage }, null, 2), 'utf8')
        }
      }

      inputMeta.endedAt = new Date().toISOString()
      fs.writeFileSync(path.join(runDir, 'input.json'), JSON.stringify(inputMeta, null, 2), 'utf8')
      fs.writeFileSync(path.join(runDir, 'screenshot.txt'), '자동 실행 환경에서는 스크린샷을 캡처할 수 없습니다. 브라우저에서 해당 회차 결과를 열어 수동 저장해 주세요.', 'utf8')
      log.flush()
      runLogs.push({ runId, log: runLogs.length })
    }
  }

  // 집계
  const successRuns = allRuns.filter(r => r.success)
  const failedRuns = allRuns.filter(r => !r.success)
  const scores = successRuns.map(r => r.totalScore).filter(n => n != null)
  const avgTotalScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
  const latencies = successRuns.map(r => r.latencyMs).filter(n => n != null)
  const avgLatencyMs = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0
  const tokens = successRuns.map(r => r.totalTokens).filter(n => n != null)
  const avgTokens = tokens.length ? tokens.reduce((a, b) => a + b, 0) / tokens.length : 0
  const costs = successRuns.map(r => r.totalCost).filter(n => n != null)
  const avgCost = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0

  const breakdownSums = {}
  successRuns.forEach(r => {
    Object.entries(r.breakdown || {}).forEach(([k, v]) => {
      breakdownSums[k] = (breakdownSums[k] || 0) + v
    })
  })
  const count = successRuns.length
  const avgHumanLikeness = breakdownSums.humanLikeness != null && count ? breakdownSums.humanLikeness / count : 0
  const avgEvidenceConsistency = breakdownSums.evidenceConsistency != null && count ? breakdownSums.evidenceConsistency / count : 0
  const avgKeywordHealth = breakdownSums.keywordHealth != null && count ? breakdownSums.keywordHealth / count : 0
  const avgOperationalRisk = breakdownSums.operationalRisk != null && count ? breakdownSums.operationalRisk / count : 0

  const titles = successRuns.map(r => r.questionTitle).filter(Boolean)
  let titleDuplicateRate = 0
  if (titles.length > 1) {
    let dup = 0
    for (let i = 0; i < titles.length; i++) {
      for (let j = i + 1; j < titles.length; j++) {
        if (jaccardSimilarity(titles[i], titles[j]) >= 0.6) dup++
      }
    }
    titleDuplicateRate = Math.round((dup / (titles.length * (titles.length - 1) / 2)) * 1000) / 10
  }

  const failureTagCounts = {}
  allRuns.forEach(r => (r.failureTags || []).forEach(t => { failureTagCounts[t] = (failureTagCounts[t] || 0) + 1 }))
  const topFailureTags = Object.entries(failureTagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15)
  const warningCounts = {}
  allRuns.forEach(r => (r.qualityWarnings || []).forEach(w => { warningCounts[w] = (warningCounts[w] || 0) + 1 }))
  const topWarnings = Object.entries(warningCounts).sort((a, b) => b[1] - a[1]).slice(0, 15)

  const concernDist = {}
  successRuns.forEach(r => {
    const v = r.concernVariant || '(none)'
    concernDist[v] = (concernDist[v] || 0) + 1
  })
  const openingDist = {}
  successRuns.forEach(r => {
    const v = r.openingFamilyId || '(none)'
    openingDist[v] = (openingDist[v] || 0) + 1
  })
  const titleFamilyDist = {}
  successRuns.forEach(r => {
    const v = r.titlePatternId || '(none)'
    titleFamilyDist[v] = (titleFamilyDist[v] || 0) + 1
  })

  const regenCount = successRuns.filter(r => r.regenHistory && r.regenHistory.length > 0).length
  const regenRate = allRuns.length ? Math.round(regenCount / allRuns.length * 1000) / 10 : 0

  // 간단한 "AI 티" 패턴 카운트 (형식적인 인사/반복 패턴)
  const AI_LIKE_PATTERNS = [
    /소중한 질문 감사합니다/,
    /정리해드리면/,
    /따라서/,
    /결국에는?/,
    /결국\s/,
    /핵심은\s/,
    /한번 정리해보면/,
    /전문적으로 말씀드리면/,
  ]
  let aiLikeCount = 0
  successRuns.forEach(r => {
    const title = r.questionTitle || ''
    AI_LIKE_PATTERNS.forEach(re => {
      if (re.test(title)) aiLikeCount++
    })
  })
  const aiLikeRatePerRun = successRuns.length ? Math.round(aiLikeCount / successRuns.length * 1000) / 10 : 0

  const sortedByScore = [...successRuns].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
  const highest3Runs = sortedByScore.slice(0, 3).map(r => ({ runId: r.runId, totalScore: r.totalScore, questionTitle: r.questionTitle }))
  const lowest3Runs = sortedByScore.slice(-3).reverse().map(r => ({ runId: r.runId, totalScore: r.totalScore, questionTitle: r.questionTitle }))

  const overallSummary = {
    totalRuns: allRuns.length,
    successCount: successRuns.length,
    failCount: failedRuns.length,
    successRate: allRuns.length ? Math.round(successRuns.length / allRuns.length * 1000) / 10 : 0,
    avgTotalScore: Math.round(avgTotalScore * 10) / 10,
    avgLatencyMs: Math.round(avgLatencyMs),
    avgTokens: Math.round(avgTokens),
    avgCost: avgCost,
    avgHumanLikeness: Math.round(avgHumanLikeness * 10) / 10,
    avgEvidenceConsistency: Math.round(avgEvidenceConsistency * 10) / 10,
    avgKeywordHealth: Math.round(avgKeywordHealth * 10) / 10,
    avgOperationalRisk: Math.round(avgOperationalRisk * 10) / 10,
    titleDuplicateRate,
    aiLikeRatePerRun,
    questionFirstSentenceSimilarityAvg: null,
    answerFirstSentenceSimilarityAvg: null,
    finalAgentEndingSimilarityAvg: null,
    zeroVolumeKeywordRate: null,
    marketHeadKeywordPresenceRate: successRuns.length ? Math.round(successRuns.filter(r => r.marketHeadKeyword).length / successRuns.length * 1000) / 10 : 0,
    regenRate,
    concernVariantDistribution: concernDist,
    openingFamilyDistribution: openingDist,
    titleFamilyDistribution: titleFamilyDist,
    topFailureTags,
    topWarnings,
    highest3Runs,
    lowest3Runs,
    failedRuns: failedRuns.map(r => ({ runId: r.runId, errorMessage: r.errorMessage })),
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'summary', 'overall-summary.json'), JSON.stringify(overallSummary, null, 2), 'utf8')

  const md = [
    '# 설계서 PNG 배치 테스트 요약',
    '',
    `- 총 실행: ${overallSummary.totalRuns}회`,
    `- 성공: ${overallSummary.successCount}회, 실패: ${overallSummary.failCount}회`,
    `- 성공률: ${overallSummary.successRate}%`,
    `- 평균 총점: ${overallSummary.avgTotalScore}`,
    `- 평균 생성 시간: ${overallSummary.avgLatencyMs}ms`,
    `- 평균 토큰: ${overallSummary.avgTokens}`,
    `- 평균 비용: ${overallSummary.avgCost}`,
    `- AI 티 패턴 비율(질문 제목 기준): ${overallSummary.aiLikeRatePerRun}%`,
    '',
    '## 상위 3회',
    ...highest3Runs.map(r => `- ${r.runId}: ${r.totalScore}점`),
    '',
    '## 하위 3회',
    ...lowest3Runs.map(r => `- ${r.runId}: ${r.totalScore}점`),
    '',
    '## 실패 회차',
    ...failedRuns.map(r => `- ${r.runId}: ${r.errorMessage}`),
  ].join('\n')
  fs.writeFileSync(path.join(OUTPUT_DIR, 'summary', 'overall-summary.md'), md, 'utf8')

  const perRunCsvHeader = 'imageId,runId,originalFileName,success,totalScore,titleScore,bodyScore,answerScore,threadScore,humanLikeness,evidenceConsistency,keywordHealth,operationalRisk,latencyMs,totalTokens,totalCost,questionTitle,selectedConcernVariant,openingFamilyId,titlePatternId,questionConceptId,marketHeadKeyword,errorMessage'
  const perRunRows = allRuns.map(r => {
    const b = r.breakdown || {}
    return [
      r.imageId,
      r.runId,
      escapeCsv(r.originalFileName),
      r.success ? '1' : '0',
      r.totalScore ?? '',
      b.title ?? '',
      b.questionBody ?? '',
      b.answer ?? '',
      b.thread ?? '',
      b.humanLikeness ?? '',
      b.evidenceConsistency ?? '',
      b.keywordHealth ?? '',
      b.operationalRisk ?? '',
      r.latencyMs ?? '',
      r.totalTokens ?? '',
      r.totalCost ?? '',
      escapeCsv(r.questionTitle),
      escapeCsv(r.concernVariant),
      escapeCsv(r.openingFamilyId),
      escapeCsv(r.titlePatternId),
      escapeCsv(r.questionConceptId),
      escapeCsv(r.marketHeadKeyword),
      escapeCsv(r.errorMessage),
    ].join(',')
  })
  fs.writeFileSync(path.join(OUTPUT_DIR, 'summary', 'per-run-summary.csv'), '\uFEFF' + perRunCsvHeader + '\n' + perRunRows.join('\n'), 'utf8')

  const perImageRows = []
  for (const img of images) {
    const runs = allRuns.filter(r => r.imageId === img.imageId)
    const ok = runs.filter(r => r.success)
    const scoresImg = ok.map(r => r.totalScore).filter(n => n != null)
    const avgScore = scoresImg.length ? scoresImg.reduce((a, b) => a + b, 0) / scoresImg.length : 0
    const latImg = ok.map(r => r.latencyMs).filter(n => n != null)
    const avgLat = latImg.length ? latImg.reduce((a, b) => a + b, 0) / latImg.length : 0
    const tokImg = ok.map(r => r.totalTokens).filter(n => n != null)
    const avgTok = tokImg.length ? tokImg.reduce((a, b) => a + b, 0) / tokImg.length : 0
    const costImg = ok.map(r => r.totalCost).filter(n => n != null)
    const avgCostImg = costImg.length ? costImg.reduce((a, b) => a + b, 0) / costImg.length : 0
    const bSum = {}
    ok.forEach(r => Object.entries(r.breakdown || {}).forEach(([k, v]) => { bSum[k] = (bSum[k] || 0) + v }))
    const n = ok.length
    const tagsImg = {}
    runs.forEach(r => (r.failureTags || []).forEach(t => { tagsImg[t] = (tagsImg[t] || 0) + 1 }))
    const mostCommonFailureTag = Object.entries(tagsImg).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
    const variantsImg = {}
    ok.forEach(r => { const v = r.concernVariant || '(none)'; variantsImg[v] = (variantsImg[v] || 0) + 1 })
    const mostCommonConcernVariant = Object.entries(variantsImg).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
    const titlesImg = ok.map(r => r.questionTitle).filter(Boolean)
    let titleDup = 0
    if (titlesImg.length > 1) {
      for (let i = 0; i < titlesImg.length; i++)
        for (let j = i + 1; j < titlesImg.length; j++)
          if (jaccardSimilarity(titlesImg[i], titlesImg[j]) >= 0.6) titleDup++
      titleDup = Math.round((titleDup / (titlesImg.length * (titlesImg.length - 1) / 2)) * 1000) / 10
    }
    perImageRows.push([
      img.imageId,
      escapeCsv(img.originalFileName),
      runs.length,
      ok.length,
      Math.round(avgScore * 10) / 10,
      Math.round(avgLat),
      Math.round(avgTok),
      avgCostImg,
      n ? Math.round((bSum.humanLikeness || 0) / n * 10) / 10 : '',
      n ? Math.round((bSum.evidenceConsistency || 0) / n * 10) / 10 : '',
      n ? Math.round((bSum.keywordHealth || 0) / n * 10) / 10 : '',
      n ? Math.round((bSum.operationalRisk || 0) / n * 10) / 10 : '',
      titleDup,
      escapeCsv(mostCommonFailureTag),
      escapeCsv(mostCommonConcernVariant),
    ].join(','))
  }
  const perImageHeader = 'imageId,originalFileName,runCount,successCount,avgTotalScore,avgLatencyMs,avgTokens,avgCost,avgHumanLikeness,avgEvidenceConsistency,avgKeywordHealth,avgOperationalRisk,titleDuplicateRate,mostCommonFailureTag,mostCommonConcernVariant'
  fs.writeFileSync(path.join(OUTPUT_DIR, 'summary', 'per-image-summary.csv'), '\uFEFF' + perImageHeader + '\n' + perImageRows.join('\n'), 'utf8')

  // 최종 5줄 출력
  const plannedRuns = images.length * RUNS_PER_IMAGE
  const completedRuns = allRuns.length
  console.log('\n========== 배치 테스트 완료 ==========')
  console.log(`1. 계획 ${plannedRuns}회 / 완료 ${completedRuns}회 — 성공: ${successRuns.length}회 / 실패: ${failedRuns.length}회`)
  console.log('2. 결과 폴더 경로:', OUTPUT_DIR)
  console.log('3. overall-summary.md 생성 여부: 예')
  console.log('4. 평균 총점:', overallSummary.avgTotalScore)
  console.log('5. 평균 생성 시간:', overallSummary.avgLatencyMs, 'ms')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
