/**
 * 관리자 전용: 설계서 PNG 배치 테스트 러너
 * - 로그인된 관리자 세션(쿠키)으로만 실행 가능
 * - 기본: test-images PNG 6개 × 5회 = 30회, analyze → generate-qa 순서
 * - validationOnly: true 시 8회 (PNG 6개 각 1회 + 텍스트 모드 2회: conversationMode true/false)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const RUNS_PER_IMAGE = 5
const IMAGE_COUNT = 6
const TEXT_RUNS_VALIDATION: Array<{ runId: string; imageId: string; conversationMode: boolean }> = [
  { runId: 'text01_run01', imageId: 'text01', conversationMode: true },
  { runId: 'text02_run01', imageId: 'text02', conversationMode: false },
]

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function escapeCsv(val: unknown): string {
  if (val == null) return ''
  const s = String(val)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function jaccardSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const tokenize = (s: string) =>
    new Set(String(s).replace(/[^가-힣a-zA-Z0-9\s]/g, '').split(/\s+/).filter((t) => t.length > 1))
  const setA = tokenize(a)
  const setB = tokenize(b)
  if (setA.size === 0 && setB.size === 0) return 0
  let inter = 0
  for (const t of setA) if (setB.has(t)) inter++
  const union = setA.size + setB.size - inter
  return union === 0 ? 0 : inter / union
}

export const maxDuration = 300 // 5분 (Vercel 등)
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    // RLS 우회: 서비스 역할로 profiles 조회 (quality-kpi와 동일)
    let adminClient: ReturnType<typeof createAdminClient> | null = null
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
      if (key.length >= 50 && key.startsWith('eyJ')) {
        adminClient = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          key
        ) as ReturnType<typeof createAdminClient>
      }
    }
    const client = adminClient || supabase
    const { data: profile } = await client.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    let validationOnly = false
    try {
      const body = await request.json().catch(() => ({}))
      validationOnly = (body as { validationOnly?: boolean })?.validationOnly === true
    } catch {
      // no body or invalid JSON → full batch
    }

    const runsPerImage = validationOnly ? 1 : RUNS_PER_IMAGE
    const cwd = process.cwd()
    const inputDir = path.join(cwd, 'test-images')
    const outputDir = path.join(cwd, 'test-results')
    if (!fs.existsSync(inputDir)) {
      return NextResponse.json({ error: `입력 폴더 없음: ${inputDir}` }, { status: 400 })
    }

    const pngFiles = fs.readdirSync(inputDir).filter((f) => f.toLowerCase().endsWith('.png')).sort()
    const images = pngFiles.slice(0, IMAGE_COUNT).map((name, i) => ({
      imageId: `img${String(i + 1).padStart(2, '0')}`,
      originalFileName: name,
      absolutePath: path.join(inputDir, name),
    }))
    if (images.length === 0) {
      return NextResponse.json({ error: 'PNG 파일이 없습니다.' }, { status: 400 })
    }

    ensureDir(outputDir)
    ensureDir(path.join(outputDir, 'runs'))
    ensureDir(path.join(outputDir, 'summary'))

    const cookie = request.headers.get('cookie') || ''
    const origin = request.nextUrl?.origin || new URL(request.url).origin
    const allRuns: Array<{
      runId: string
      imageId: string
      originalFileName: string
      success: boolean
      totalScore: number | null
      breakdown: Record<string, number>
      latencyMs: number | null
      totalTokens: number | null
      totalCost: number | null
      questionTitle: string | null
      questionFirstSentence?: string | null
      answerFirstSentence?: string | null
      finalAgentEnding?: string | null
      zeroVolumeSlots?: number
      concernVariant: string | null
      openingFamilyId: string | null
      titlePatternId: string | null
      questionConceptId: string | null
      marketHeadKeyword: string | null
      failureTags: string[]
      qualityWarnings: string[]
      regenHistory: unknown
      errorMessage: string
      conversationMode?: boolean
      metadataHasThread?: boolean
      metadataHasFinalAgentEnding?: boolean
      metadataHasQuestionFirstSentence?: boolean
      metadataHasAnswerFirstSentence?: boolean
    }> = []

    for (const img of images) {
      for (let run = 1; run <= runsPerImage; run++) {
        const runId = `${img.imageId}_run${String(run).padStart(2, '0')}`
        const runDir = path.join(outputDir, 'runs', runId)
        ensureDir(runDir)
        const runStartedAt = new Date().toISOString()
        const logLines: string[] = []
        const log = (...args: unknown[]) => {
          const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
          logLines.push(`[${new Date().toISOString()}] ${msg}`)
        }

        const inputMeta = {
          imageId: img.imageId,
          runId,
          originalFileName: img.originalFileName,
          absolutePath: img.absolutePath,
          relativePath: path.join('test-images', img.originalFileName),
          startedAt: runStartedAt,
          endedAt: null as string | null,
        }

        let analyzeOk = false
        let analyzeData: Record<string, unknown> | null = null
        let errorMessage = ''
        let genPayload: Record<string, unknown> = {}
        let latencyMs = 0

        try {
          const base64 = fs.readFileSync(img.absolutePath).toString('base64')
          log('analyze-design-sheet 요청:', img.originalFileName)

          const analyzeRes = await fetch(`${origin}/api/analyze-design-sheet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ imageBase64: base64 }),
          })
          const analyzeJson = (await analyzeRes.json().catch(() => ({}))) as { success?: boolean; data?: Record<string, unknown>; error?: string }
          log('analyze-design-sheet 응답:', analyzeRes.status, 'success:', !!analyzeJson?.success)

          if (!analyzeRes.ok || !analyzeJson?.success) {
            errorMessage = analyzeJson?.error || analyzeRes.statusText || '분석 실패'
            log('analyze 실패:', errorMessage)
            fs.writeFileSync(
              path.join(runDir, 'analyze.json'),
              JSON.stringify({ error: errorMessage, status: analyzeRes.status }, null, 2),
              'utf8'
            )
          } else {
            analyzeOk = true
            analyzeData = analyzeJson.data || analyzeJson as Record<string, unknown>
            const analyzeOut = {
              rawProductName: analyzeData.rawProductName ?? analyzeData.productName,
              normalizedProductName: analyzeData.productName,
              correctedProductName: (analyzeData as { nameCorrection?: { corrected?: string } }).nameCorrection?.corrected ?? null,
              correctionApplied: (analyzeData as { nameCorrection?: { method?: string } }).nameCorrection?.method !== 'none',
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
              evidenceMap: analyzeData.evidenceMap,
              conflictAxis: analyzeData.conflictAxis,
            }
            fs.writeFileSync(path.join(runDir, 'analyze.json'), JSON.stringify(analyzeOut, null, 2), 'utf8')
            genPayload = {
              productName: analyzeData.productName || analyzeData.rawProductName,
              targetPersona: analyzeData.targetPersona || '30대 직장인',
              worryPoint: analyzeData.worryPoint || '',
              sellingPoint: analyzeData.sellingPoint || '',
              designSheetImage: base64,
              designSheetAnalysis: analyzeData,
              generateStep: 'all',
            }
          }

          if (analyzeOk && analyzeData) {
            log('generate-qa 요청 (쿠키 전달)')
            const genStart = Date.now()
            const genRes = await fetch(`${origin}/api/generate-qa`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Cookie: cookie },
              body: JSON.stringify(genPayload),
            })
            latencyMs = Date.now() - genStart
            const genJson = (await genRes.json().catch(() => ({}))) as {
              success?: boolean
              error?: string
              question?: { title?: string; content?: string }
              answer?: { content?: string }
              conversation?: unknown[]
              qualityGate?: { totalScore?: number; breakdown?: Record<string, number>; allPassed?: boolean; criticalFailures?: string[] }
              usage?: { totalTokens?: number; costEstimate?: { totalCost?: number }; breakdown?: unknown }
              metadata?: Record<string, unknown>
            }
            log('generate-qa 응답:', genRes.status, 'success:', !!genJson?.success, 'latencyMs:', latencyMs)

            if (!genRes.ok || !genJson?.success) {
              errorMessage = genJson?.error || genRes.statusText || '생성 실패'
              log('generate 실패:', errorMessage)
              fs.writeFileSync(
                path.join(runDir, 'generate.json'),
                JSON.stringify({ error: errorMessage, status: genRes.status }, null, 2),
                'utf8'
              )
              fs.writeFileSync(path.join(runDir, 'quality.json'), JSON.stringify({ error: errorMessage }, null, 2), 'utf8')
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
                errorMessage,
              })
            } else {
              const meta = genJson.metadata || {}
              const usage = genJson.usage || {}
              const q = genJson.question || {}
              const questionContent = q.content || ''
              const answerContent = genJson.answer?.content || ''
              const threadFromMeta = Array.isArray(meta.thread) ? (meta.thread as Array<{ role: string; content: string }>) : null
              const thread = threadFromMeta ?? (genJson.conversation || []) as Array<{ role: string; content: string }>
              const getFirst = (t: string) => { const m = t.trim().match(/^.+?[.?!？！\n]/); return m ? m[0].trim() : t.trim().substring(0, 80) }
              const lastAgent = thread.filter((m: { role: string }) => m.role === 'agent').pop()
              const questionFirstFromMeta = meta.questionFirstSentence != null && meta.questionFirstSentence !== '' ? meta.questionFirstSentence : null
              const answerFirstFromMeta = meta.answerFirstSentence != null && meta.answerFirstSentence !== '' ? meta.answerFirstSentence : null
              const finalEndingFromMeta = meta.finalAgentEnding != null && meta.finalAgentEnding !== '' ? meta.finalAgentEnding : null
              const genOut = {
                productName: meta.productName,
                targetPersona: meta.targetPersona,
                topicCore: meta.topicName,
                topicConcern: meta.topicConcern,
                topicConcernSearch: meta.topicConcernSearch,
                displayProductName: meta.displayProductName,
                selectedConcernVariant: meta.concernVariant,
                openingFamilyId: meta.openingFamilyId,
                titlePatternId: meta.titlePatternId,
                questionConceptId: meta.questionConceptId,
                promptKeywords: meta.promptKeywords ?? meta.searchKeywords,
                displayKeywords: meta.displayKeywords ?? null,
                marketHeadKeyword: meta.marketHeadKeyword ?? (Array.isArray(meta.searchKeywords) ? (meta.searchKeywords as string[])[0] : null),
                questionTitle: q.title,
                questionContent: questionContent,
                answerContent: answerContent,
                thread,
                questionFirstSentence: questionFirstFromMeta ?? getFirst(questionContent),
                answerFirstSentence: answerFirstFromMeta ?? getFirst(answerContent),
                finalAgentEnding: finalEndingFromMeta ?? (lastAgent?.content?.trim().substring(0, 300) ?? null),
                reviewCount: null,
                regenHistory: null,
                latencyMs,
                customSearchCount: (usage as { costEstimate?: { customSearchCount?: number } }).costEstimate?.customSearchCount,
                customSearchCost: (usage as { costEstimate?: { customSearchCost?: number } }).costEstimate?.customSearchCost,
                tokenBreakdown: usage.breakdown,
                totalTokens: usage.totalTokens,
                totalCostEstimate: (usage as { costEstimate?: { totalCost?: number } }).costEstimate?.totalCost,
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
                failureTags: meta.failureTags || [],
                humanLikeness: qg.breakdown?.humanLikeness ?? null,
                evidenceConsistency: qg.breakdown?.evidenceConsistency ?? null,
                keywordHealth: qg.breakdown?.keywordHealth ?? null,
                operationalRisk: qg.breakdown?.operationalRisk ?? null,
              }
              fs.writeFileSync(path.join(runDir, 'quality.json'), JSON.stringify(qualityOut, null, 2), 'utf8')

              const marketHead = meta.marketHeadKeyword as { keyword?: string; volume?: number | null } | undefined
              const displayKw = meta.displayKeywords as Array<{ keyword?: string; volume?: number | null; role?: string }> | undefined
              let zeroVolumeSlots = 0
              let totalSlots = 0
              if (Array.isArray(displayKw)) {
                for (const d of displayKw) {
                  totalSlots++
                  if (d.volume == null || d.volume === 0) zeroVolumeSlots++
                }
              }
              allRuns.push({
                runId,
                imageId: img.imageId,
                originalFileName: img.originalFileName,
                success: true,
                totalScore: qg.totalScore ?? null,
                breakdown: qg.breakdown || {},
                latencyMs,
                totalTokens: usage.totalTokens ?? null,
                totalCost: (usage as { costEstimate?: { totalCost?: number } }).costEstimate?.totalCost ?? null,
                questionTitle: q.title ?? null,
                questionFirstSentence: typeof genOut.questionFirstSentence === 'string' ? genOut.questionFirstSentence : null,
                answerFirstSentence: typeof genOut.answerFirstSentence === 'string' ? genOut.answerFirstSentence : null,
                finalAgentEnding: typeof genOut.finalAgentEnding === 'string' ? genOut.finalAgentEnding : null,
                concernVariant: (meta.concernVariant as string) ?? null,
                openingFamilyId: (meta.openingFamilyId as string) ?? null,
                titlePatternId: (meta.titlePatternId as string) ?? null,
                questionConceptId: (meta.questionConceptId as string) ?? null,
                marketHeadKeyword: marketHead?.keyword ?? (Array.isArray(meta.searchKeywords) ? (meta.searchKeywords as string[])[0] : null),
                failureTags: (meta.failureTags as string[]) || [],
                qualityWarnings: ((meta.qualityWarnings as string[]) || []),
                regenHistory: (meta.regenHistory as unknown[]) ?? null,
                errorMessage: '',
                zeroVolumeSlots: totalSlots > 0 ? zeroVolumeSlots / totalSlots : 0,
                conversationMode: meta.conversationMode as boolean | undefined,
                metadataHasThread: 'thread' in meta && Array.isArray(meta.thread),
                metadataHasFinalAgentEnding: 'finalAgentEnding' in meta,
                metadataHasQuestionFirstSentence: 'questionFirstSentence' in meta,
                metadataHasAnswerFirstSentence: 'answerFirstSentence' in meta,
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
              errorMessage,
            })
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          const stack = err instanceof Error ? err.stack : ''
          errorMessage = msg
          log('예외:', msg)
          if (stack) log(stack)
          fs.writeFileSync(path.join(runDir, 'analyze.json'), JSON.stringify({ error: msg }, null, 2), 'utf8')
          fs.writeFileSync(path.join(runDir, 'generate.json'), JSON.stringify({ error: msg }, null, 2), 'utf8')
          fs.writeFileSync(path.join(runDir, 'quality.json'), JSON.stringify({ error: msg }, null, 2), 'utf8')
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
            errorMessage: msg,
          })
        }

        inputMeta.endedAt = new Date().toISOString()
        fs.writeFileSync(path.join(runDir, 'input.json'), JSON.stringify(inputMeta, null, 2), 'utf8')
        fs.writeFileSync(
          path.join(runDir, 'screenshot.txt'),
          '배치 API 실행. 브라우저에서 해당 회차 결과를 열어 수동 캡처하거나, 결과는 generate.json/quality.json 참고.',
          'utf8'
        )
        fs.writeFileSync(path.join(runDir, 'raw.log'), logLines.join('\n'), 'utf8')
      }
    }

    // validationOnly: 텍스트 모드 2회 (conversationMode true / false)
    if (validationOnly && TEXT_RUNS_VALIDATION.length > 0) {
      const textPayloadBase = {
        productName: '실손의료비보험',
        targetPersona: '30대 직장인',
        worryPoint: '보험료 부담',
        sellingPoint: '실제 치료비 보장',
        generateStep: 'all',
      }
      for (const tr of TEXT_RUNS_VALIDATION) {
        const runDir = path.join(outputDir, 'runs', tr.runId)
        ensureDir(runDir)
        const logLines: string[] = []
        const log = (...args: unknown[]) => {
          logLines.push(`[${new Date().toISOString()}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`)
        }
        const genPayload = { ...textPayloadBase, conversationMode: tr.conversationMode }
        let errorMessage = ''
        let latencyMs = 0
        try {
          log('generate-qa 요청 (텍스트 모드, conversationMode=', tr.conversationMode, ')')
          const genStart = Date.now()
          const genRes = await fetch(`${origin}/api/generate-qa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify(genPayload),
          })
          latencyMs = Date.now() - genStart
          const genJson = (await genRes.json().catch(() => ({}))) as {
            success?: boolean
            error?: string
            question?: { title?: string; content?: string }
            answer?: { content?: string }
            conversation?: unknown[]
            qualityGate?: { totalScore?: number; breakdown?: Record<string, number> }
            usage?: { totalTokens?: number; costEstimate?: { totalCost?: number }; breakdown?: unknown }
            metadata?: Record<string, unknown>
          }
          log('generate-qa 응답:', genRes.status, 'success:', !!genJson?.success)
          if (!genRes.ok || !genJson?.success) {
            errorMessage = genJson?.error || '생성 실패'
            fs.writeFileSync(path.join(runDir, 'generate.json'), JSON.stringify({ error: errorMessage }, null, 2), 'utf8')
            allRuns.push({
              runId: tr.runId,
              imageId: tr.imageId,
              originalFileName: 'text',
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
              errorMessage,
              conversationMode: tr.conversationMode,
            })
          } else {
            const meta = genJson.metadata || {}
            const usage = genJson.usage || {}
            const q = genJson.question || {}
            const qg = genJson.qualityGate || {}
            const questionContent = q.content || ''
            const answerContent = genJson.answer?.content || ''
            const threadFromMeta = Array.isArray(meta.thread) ? (meta.thread as Array<{ role: string; content: string }>) : null
            const thread = threadFromMeta ?? (genJson.conversation || []) as Array<{ role: string; content: string }>
            const getFirst = (t: string) => { const m = t.trim().match(/^.+?[.?!？！\n]/); return m ? m[0].trim() : t.trim().substring(0, 80) }
            const lastAgent = thread.filter((m: { role: string }) => m.role === 'agent').pop()
            const questionFirstFromMeta = meta.questionFirstSentence != null && meta.questionFirstSentence !== '' ? meta.questionFirstSentence : null
            const answerFirstFromMeta = meta.answerFirstSentence != null && meta.answerFirstSentence !== '' ? meta.answerFirstSentence : null
            const finalEndingFromMeta = meta.finalAgentEnding != null && meta.finalAgentEnding !== '' ? meta.finalAgentEnding : null
            const finalAgentEnding = finalEndingFromMeta ?? (lastAgent?.content?.trim().substring(0, 300) ?? null)
            const genOut = {
              productName: meta.productName,
              questionTitle: q.title,
              questionContent,
              answerContent,
              thread,
              questionFirstSentence: questionFirstFromMeta ?? getFirst(questionContent),
              answerFirstSentence: answerFirstFromMeta ?? getFirst(answerContent),
              finalAgentEnding,
              latencyMs,
              totalTokens: usage.totalTokens,
              totalCost: (usage as { costEstimate?: { totalCost?: number } })?.costEstimate?.totalCost,
            }
            fs.writeFileSync(path.join(runDir, 'generate.json'), JSON.stringify(genOut, null, 2), 'utf8')
            const marketHead = meta.marketHeadKeyword as { keyword?: string } | undefined
            allRuns.push({
              runId: tr.runId,
              imageId: tr.imageId,
              originalFileName: 'text',
              success: true,
              totalScore: qg.totalScore ?? null,
              breakdown: qg.breakdown || {},
              latencyMs,
              totalTokens: usage.totalTokens ?? null,
              totalCost: (usage as { costEstimate?: { totalCost?: number } })?.costEstimate?.totalCost ?? null,
              questionTitle: q.title ?? null,
              questionFirstSentence: typeof genOut.questionFirstSentence === 'string' ? genOut.questionFirstSentence : null,
              answerFirstSentence: typeof genOut.answerFirstSentence === 'string' ? genOut.answerFirstSentence : null,
              finalAgentEnding: typeof genOut.finalAgentEnding === 'string' ? genOut.finalAgentEnding : null,
              concernVariant: (meta.concernVariant as string) ?? null,
              openingFamilyId: (meta.openingFamilyId as string) ?? null,
              titlePatternId: (meta.titlePatternId as string) ?? null,
              questionConceptId: (meta.questionConceptId as string) ?? null,
              marketHeadKeyword: marketHead?.keyword ?? null,
              failureTags: (meta.failureTags as string[]) || [],
              qualityWarnings: (meta.qualityWarnings as string[]) || [],
              regenHistory: null,
              errorMessage: '',
              conversationMode: tr.conversationMode,
              metadataHasThread: 'thread' in meta && Array.isArray(meta.thread),
              metadataHasFinalAgentEnding: 'finalAgentEnding' in meta,
              metadataHasQuestionFirstSentence: 'questionFirstSentence' in meta,
              metadataHasAnswerFirstSentence: 'answerFirstSentence' in meta,
            })
          }
        } catch (err: unknown) {
          errorMessage = err instanceof Error ? err.message : String(err)
          log('예외:', errorMessage)
          fs.writeFileSync(path.join(runDir, 'generate.json'), JSON.stringify({ error: errorMessage }, null, 2), 'utf8')
          allRuns.push({
            runId: tr.runId,
            imageId: tr.imageId,
            originalFileName: 'text',
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
            errorMessage,
            conversationMode: tr.conversationMode,
          })
        }
        fs.writeFileSync(path.join(runDir, 'raw.log'), logLines.join('\n'), 'utf8')
      }
    }

    const successRuns = allRuns.filter((r) => r.success)
    const failedRuns = allRuns.filter((r) => !r.success)
    const scores = successRuns.map((r) => r.totalScore).filter((n): n is number => n != null)
    const avgTotalScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const latencies = successRuns.map((r) => r.latencyMs).filter((n): n is number => n != null)
    const avgLatencyMs = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0
    const breakdownSums: Record<string, number> = {}
    successRuns.forEach((r) => {
      Object.entries(r.breakdown || {}).forEach(([k, v]) => {
        breakdownSums[k] = (breakdownSums[k] || 0) + v
      })
    })
    const count = successRuns.length
    const concernDist: Record<string, number> = {}
    successRuns.forEach((r) => {
      const v = r.concernVariant || '(none)'
      concernDist[v] = (concernDist[v] || 0) + 1
    })
    const openingDist: Record<string, number> = {}
    successRuns.forEach((r) => {
      const v = r.openingFamilyId || '(none)'
      openingDist[v] = (openingDist[v] || 0) + 1
    })
    const titleFamilyDist: Record<string, number> = {}
    successRuns.forEach((r) => {
      const v = r.titlePatternId || '(none)'
      titleFamilyDist[v] = (titleFamilyDist[v] || 0) + 1
    })
    const failureTagCounts: Record<string, number> = {}
    allRuns.forEach((r) => (r.failureTags || []).forEach((t) => { failureTagCounts[t] = (failureTagCounts[t] || 0) + 1 }))
    const topFailureTags = Object.entries(failureTagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15)
    const warningCounts: Record<string, number> = {}
    allRuns.forEach((r) => (r.qualityWarnings || []).forEach((w) => { warningCounts[w] = (warningCounts[w] || 0) + 1 }))
    const topWarnings = Object.entries(warningCounts).sort((a, b) => b[1] - a[1]).slice(0, 15)
    const titles = successRuns.map((r) => r.questionTitle).filter(Boolean)
    let titleDuplicateRate = 0
    if (titles.length > 1) {
      let dup = 0
      for (let i = 0; i < titles.length; i++) {
        for (let j = i + 1; j < titles.length; j++) {
          if (jaccardSimilarity(titles[i]!, titles[j]!) >= 0.6) dup++
        }
      }
      titleDuplicateRate = Math.round((dup / (titles.length * (titles.length - 1) / 2)) * 1000) / 10
    }
    const questionFirsts = successRuns.map((r) => r.questionFirstSentence).filter((s): s is string => !!s && s.length > 10)
    const answerFirsts = successRuns.map((r) => r.answerFirstSentence).filter((s): s is string => !!s && s.length > 10)
    const agentEndings = successRuns.map((r) => r.finalAgentEnding).filter((s): s is string => !!s && s.length > 10)
    const avgPairwise = (arr: string[]) => {
      if (arr.length < 2) return 0
      let sum = 0
      let n = 0
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          sum += jaccardSimilarity(arr[i], arr[j])
          n++
        }
      }
      return n > 0 ? Math.round(sum / n * 1000) / 1000 : 0
    }
    const questionFirstSentenceSimilarityAvg = questionFirsts.length >= 2 ? avgPairwise(questionFirsts) : 0
    const answerFirstSentenceSimilarityAvg = answerFirsts.length >= 2 ? avgPairwise(answerFirsts) : 0
    const finalAgentEndingSimilarityAvg = agentEndings.length >= 2 ? avgPairwise(agentEndings) : 0
    const zeroVolumeKeywordRate = successRuns.length > 0
      ? Math.round(successRuns.reduce((a, r) => a + (r.zeroVolumeSlots ?? 0), 0) / successRuns.length * 1000) / 10
      : 0
    const sortedByScore = [...successRuns].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
    const highest3Runs = sortedByScore.slice(0, 3).map((r) => ({ runId: r.runId, totalScore: r.totalScore, questionTitle: r.questionTitle }))
    const lowest3Runs = sortedByScore.slice(-3).reverse().map((r) => ({ runId: r.runId, totalScore: r.totalScore, questionTitle: r.questionTitle }))

    const overallSummary = {
      totalRuns: allRuns.length,
      successCount: successRuns.length,
      failCount: failedRuns.length,
      successRate: allRuns.length ? Math.round((successRuns.length / allRuns.length) * 1000) / 10 : 0,
      avgTotalScore: Math.round(avgTotalScore * 10) / 10,
      avgLatencyMs: Math.round(avgLatencyMs),
      avgTokens: successRuns.length ? Math.round(successRuns.reduce((a, r) => a + (r.totalTokens || 0), 0) / successRuns.length) : 0,
      avgCost: successRuns.length ? successRuns.reduce((a, r) => a + (r.totalCost || 0), 0) / successRuns.length : 0,
      avgHumanLikeness: count && breakdownSums.humanLikeness != null ? Math.round((breakdownSums.humanLikeness / count) * 10) / 10 : 0,
      avgEvidenceConsistency: count && breakdownSums.evidenceConsistency != null ? Math.round((breakdownSums.evidenceConsistency / count) * 10) / 10 : 0,
      avgKeywordHealth: count && breakdownSums.keywordHealth != null ? Math.round((breakdownSums.keywordHealth / count) * 10) / 10 : 0,
      avgOperationalRisk: count && breakdownSums.operationalRisk != null ? Math.round((breakdownSums.operationalRisk / count) * 10) / 10 : 0,
      titleDuplicateRate,
      questionFirstSentenceSimilarityAvg,
      answerFirstSentenceSimilarityAvg,
      finalAgentEndingSimilarityAvg,
      zeroVolumeKeywordRate,
      marketHeadKeywordPresenceRate: successRuns.length ? Math.round((successRuns.filter((r) => r.marketHeadKeyword).length / successRuns.length) * 1000) / 10 : 0,
      regenRate: allRuns.length ? Math.round((allRuns.filter((r) => r.regenHistory && Array.isArray(r.regenHistory) && r.regenHistory.length > 0).length / allRuns.length) * 1000) / 10 : 0,
      concernVariantDistribution: concernDist,
      openingFamilyDistribution: openingDist,
      titleFamilyDistribution: titleFamilyDist,
      topFailureTags,
      topWarnings,
      highest3Runs,
      lowest3Runs,
      failedRuns: failedRuns.map((r) => ({ runId: r.runId, errorMessage: r.errorMessage })),
    }

    fs.writeFileSync(path.join(outputDir, 'summary', 'overall-summary.json'), JSON.stringify(overallSummary, null, 2), 'utf8')
    const md = [
      '# 설계서 PNG 배치 테스트 요약',
      '',
      `- 총 실행: ${overallSummary.totalRuns}회`,
      `- 성공: ${overallSummary.successCount}회, 실패: ${overallSummary.failCount}회`,
      `- 성공률: ${overallSummary.successRate}%`,
      `- 평균 총점: ${overallSummary.avgTotalScore}`,
      `- 평균 생성 시간: ${overallSummary.avgLatencyMs}ms`,
      '',
      '## 상위 3회',
      ...highest3Runs.map((r) => `- ${r.runId}: ${r.totalScore}점`),
      '',
      '## 하위 3회',
      ...lowest3Runs.map((r) => `- ${r.runId}: ${r.totalScore}점`),
      '',
      '## 실패 회차',
      ...failedRuns.map((r) => `- ${r.runId}: ${r.errorMessage}`),
    ].join('\n')
    fs.writeFileSync(path.join(outputDir, 'summary', 'overall-summary.md'), md, 'utf8')

    const perRunHeader = 'imageId,runId,originalFileName,success,totalScore,titleScore,bodyScore,answerScore,threadScore,humanLikeness,evidenceConsistency,keywordHealth,operationalRisk,latencyMs,totalTokens,totalCost,questionTitle,selectedConcernVariant,openingFamilyId,titlePatternId,questionConceptId,marketHeadKeyword,errorMessage'
    const perRunRows = allRuns.map((r) => {
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
    fs.writeFileSync(path.join(outputDir, 'summary', 'per-run-summary.csv'), '\uFEFF' + perRunHeader + '\n' + perRunRows.join('\n'), 'utf8')

    const perImageHeader = 'imageId,originalFileName,runCount,successCount,avgTotalScore,avgLatencyMs,avgTokens,avgCost,avgHumanLikeness,avgEvidenceConsistency,avgKeywordHealth,avgOperationalRisk,titleDuplicateRate,mostCommonFailureTag,mostCommonConcernVariant'
    const perImageRows = images.map((img) => {
      const runs = allRuns.filter((r) => r.imageId === img.imageId)
      const ok = runs.filter((r) => r.success)
      const scoresImg = ok.map((r) => r.totalScore).filter((n): n is number => n != null)
      const avgScore = scoresImg.length ? scoresImg.reduce((a, b) => a + b, 0) / scoresImg.length : 0
      const latImg = ok.map((r) => r.latencyMs).filter((n): n is number => n != null)
      const avgLat = latImg.length ? latImg.reduce((a, b) => a + b, 0) / latImg.length : 0
      const tokImg = ok.map((r) => r.totalTokens).filter((n): n is number => n != null)
      const avgTok = tokImg.length ? tokImg.reduce((a, b) => a + b, 0) / tokImg.length : 0
      const costImg = ok.map((r) => r.totalCost).filter((n): n is number => n != null)
      const avgCostImg = costImg.length ? costImg.reduce((a, b) => a + b, 0) / costImg.length : 0
      const bSum: Record<string, number> = {}
      ok.forEach((r) => Object.entries(r.breakdown || {}).forEach(([k, v]) => { bSum[k] = (bSum[k] || 0) + v }))
      const n = ok.length
      const tagsImg: Record<string, number> = {}
      runs.forEach((r) => (r.failureTags || []).forEach((t) => { tagsImg[t] = (tagsImg[t] || 0) + 1 }))
      const mostCommonFailureTag = Object.entries(tagsImg).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
      const variantsImg: Record<string, number> = {}
      ok.forEach((r) => { const v = r.concernVariant || '(none)'; variantsImg[v] = (variantsImg[v] || 0) + 1 })
      const mostCommonConcernVariant = Object.entries(variantsImg).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
      const titlesImg = ok.map((r) => r.questionTitle).filter(Boolean)
      let titleDup = 0
      if (titlesImg.length > 1) {
        for (let i = 0; i < titlesImg.length; i++) {
          for (let j = i + 1; j < titlesImg.length; j++) {
            if (jaccardSimilarity(titlesImg[i]!, titlesImg[j]!) >= 0.6) titleDup++
          }
        }
        titleDup = Math.round((titleDup / (titlesImg.length * (titlesImg.length - 1) / 2)) * 1000) / 10
      }
      return [
        img.imageId,
        escapeCsv(img.originalFileName),
        runs.length,
        ok.length,
        Math.round(avgScore * 10) / 10,
        Math.round(avgLat),
        Math.round(avgTok),
        avgCostImg,
        n && bSum.humanLikeness != null ? Math.round((bSum.humanLikeness / n) * 10) / 10 : '',
        n && bSum.evidenceConsistency != null ? Math.round((bSum.evidenceConsistency / n) * 10) / 10 : '',
        n && bSum.keywordHealth != null ? Math.round((bSum.keywordHealth / n) * 10) / 10 : '',
        n && bSum.operationalRisk != null ? Math.round((bSum.operationalRisk / n) * 10) / 10 : '',
        titleDup,
        escapeCsv(mostCommonFailureTag),
        escapeCsv(mostCommonConcernVariant),
      ].join(',')
    })
    fs.writeFileSync(path.join(outputDir, 'summary', 'per-image-summary.csv'), '\uFEFF' + perImageHeader + '\n' + perImageRows.join('\n'), 'utf8')

    const summary = {
      successCount: successRuns.length,
      failCount: failedRuns.length,
      resultPath: outputDir,
      overallSummaryMdCreated: true,
      avgTotalScore: overallSummary.avgTotalScore,
      avgLatencyMs: overallSummary.avgLatencyMs,
    }

    let validationReport: Record<string, unknown> | null = null
    if (validationOnly) {
      const convModeTrueRuns = allRuns.filter((r) => r.conversationMode === true)
      const convModeFalseRuns = allRuns.filter((r) => r.conversationMode === false)
      validationReport = {
        totalRuns: allRuns.length,
        successCount: successRuns.length,
        failCount: failedRuns.length,
        runs: allRuns.map((r) => ({
          runId: r.runId,
          imageId: r.imageId,
          success: r.success,
          conversationMode: r.conversationMode,
          metadataHasThread: r.metadataHasThread,
          metadataHasFinalAgentEnding: r.metadataHasFinalAgentEnding,
          metadataHasQuestionFirstSentence: r.metadataHasQuestionFirstSentence,
          metadataHasAnswerFirstSentence: r.metadataHasAnswerFirstSentence,
          threadNonEmpty: r.success && r.conversationMode === true && (r.finalAgentEnding != null && String(r.finalAgentEnding).trim() !== ''),
          finalAgentEndingPresent: r.finalAgentEnding != null && String(r.finalAgentEnding).trim() !== '',
        })),
        metadataFieldsPresent: {
          allRunsHaveThread: allRuns.filter((r) => r.success).every((r) => r.metadataHasThread === true),
          allRunsHaveFinalAgentEnding: allRuns.filter((r) => r.success).every((r) => r.metadataHasFinalAgentEnding === true),
          allRunsHaveQuestionFirstSentence: allRuns.filter((r) => r.success).every((r) => r.metadataHasQuestionFirstSentence === true),
          allRunsHaveAnswerFirstSentence: allRuns.filter((r) => r.success).every((r) => r.metadataHasAnswerFirstSentence === true),
        },
        conversationModeTrue: {
          total: convModeTrueRuns.length,
          success: convModeTrueRuns.filter((r) => r.success).length,
          threadNonEmpty: convModeTrueRuns.filter((r) => r.success && r.finalAgentEnding != null).length,
          finalAgentEndingPresent: convModeTrueRuns.filter((r) => r.success && r.finalAgentEnding != null && String(r.finalAgentEnding).trim() !== '').length,
        },
        conversationModeFalse: {
          total: convModeFalseRuns.length,
          success: convModeFalseRuns.filter((r) => r.success).length,
          threadEmptyOk: true,
        },
        kpiSample: null as Record<string, unknown> | null,
        sessionsDetailSample: null as Record<string, unknown> | null,
      }
      // conversationMode=true 저장률: thread 비어있지 않음 + finalAgentEnding 있음
      const convTrueOk = convModeTrueRuns.filter((r) => r.success)
      ;(validationReport as any).conversationModeTrueStorageRate = convTrueOk.length
        ? {
          threadNonEmptyRate: convTrueOk.filter((r) => r.finalAgentEnding != null).length / convTrueOk.length,
          finalAgentEndingPresentRate: convTrueOk.filter((r) => r.finalAgentEnding != null && String(r.finalAgentEnding).trim() !== '').length / convTrueOk.length,
        }
        : null

      try {
        const kpiRes = await fetch(`${origin}/api/admin/quality-kpi?days=1`, { headers: { Cookie: cookie } })
        if (kpiRes.ok) {
          const kpiJson = await kpiRes.json().catch(() => ({}))
          validationReport.kpiSample = kpiJson.kpiSummary || kpiJson
        }
        const sessionsRes = await fetch(`${origin}/api/admin/quality-sessions?days=1&limit=5`, { headers: { Cookie: cookie } })
        if (sessionsRes.ok) {
          const sessionsJson = await sessionsRes.json().catch(() => ({}))
          const sessions = sessionsJson.sessions || []
          const firstId = sessions[0]?.id
          if (firstId) {
            const detailRes = await fetch(`${origin}/api/admin/quality-sessions?id=${firstId}`, { headers: { Cookie: cookie } })
            if (detailRes.ok) {
              const detailJson = await detailRes.json().catch(() => ({}))
              validationReport.sessionsDetailSample = detailJson.session ?? detailJson
            }
          }
        }
      } catch (_) {
        // ignore fetch errors for KPI/sessions
      }
      fs.writeFileSync(path.join(outputDir, 'summary', 'validation-report.json'), JSON.stringify(validationReport, null, 2), 'utf8')
    }

    return NextResponse.json({
      success: true,
      message: validationOnly ? '8회 기능 검증 완료' : '배치 테스트 완료',
      ...summary,
      validationReport: validationReport ?? undefined,
    })
  } catch (err: unknown) {
    console.error('[admin/run-batch-qa-test]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '서버 오류' },
      { status: 500 }
    )
  }
}
