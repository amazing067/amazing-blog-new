#!/usr/bin/env node
/**
 * 8회 기능 검증 후 생성된 validation-report.json을 읽어
 * [필수 확인 항목] 형식으로 보고서 출력
 * 사용: node scripts/report-validation-8.mjs
 * (먼저 /admin/quality에서 "8회 기능 검증" 실행 필요)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const reportPath = path.join(__dirname, '..', 'test-results', 'summary', 'validation-report.json')

if (!fs.existsSync(reportPath)) {
  console.error('validation-report.json이 없습니다. 먼저 /admin/quality에서 "8회 기능 검증"을 실행하세요.')
  process.exit(1)
}

const raw = fs.readFileSync(reportPath, 'utf8')
const report = JSON.parse(raw)

const runs = report.runs || []
const successRuns = runs.filter((r) => r.success)
const convTrue = runs.filter((r) => r.conversationMode === true)
const convFalse = runs.filter((r) => r.conversationMode === false)

console.log('=== 8회 기능 검증 보고서 ===\n')

console.log('1. 8회 테스트 성공/실패 요약')
console.log(`   총 ${report.totalRuns ?? 8}회: 성공 ${report.successCount ?? 0}회, 실패 ${report.failCount ?? 0}회`)
successRuns.forEach((r) => {
  console.log(`   - ${r.runId}: 성공, metadata [thread=${r.metadataHasThread}, finalAgentEnding=${r.metadataHasFinalAgentEnding}, questionFirstSentence=${r.metadataHasQuestionFirstSentence}, answerFirstSentence=${r.metadataHasAnswerFirstSentence}]`)
})
runs.filter((r) => !r.success).forEach((r) => {
  console.log(`   - ${r.runId}: 실패`)
})
console.log('')

console.log('2. conversationMode=true 저장률')
const convTrueOk = convTrue.filter((r) => r.success)
const threadOk = convTrueOk.filter((r) => r.threadNonEmpty).length
const endingOk = convTrueOk.filter((r) => r.finalAgentEndingPresent).length
console.log(`   회차 수: ${convTrue.length}, 성공: ${convTrueOk.length}`)
console.log(`   thread 비어있지 않음: ${threadOk}/${convTrueOk.length}, finalAgentEnding 존재: ${endingOk}/${convTrueOk.length}`)
if (report.conversationModeTrueStorageRate) {
  console.log('   ', JSON.stringify(report.conversationModeTrueStorageRate))
}
console.log('')

console.log('3. conversationMode=false 오집계 여부')
console.log(`   회차 수: ${convFalse.length}, 성공: ${convFalse.filter((r) => r.success).length}`)
console.log('   (thread/finalAgentEnding 비어 있어도 정상. quality-kpi가 missing으로 잘못 집계하지 않으면 OK)')
console.log('')

console.log('4. KPI 반환값 샘플')
if (report.kpiSample) {
  const k = report.kpiSample
  console.log(`   threadMissingCount: ${k.threadMissingCount ?? '-'}`)
  console.log(`   finalAgentEndingMissingCount: ${k.finalAgentEndingMissingCount ?? '-'}`)
  console.log('   (기타 필드)', Object.keys(k).filter((x) => !['threadMissingCount', 'finalAgentEndingMissingCount'].includes(x)).slice(0, 8).join(', '))
} else {
  console.log('   (없음 - API 호출 실패 또는 days=1 구간에 8회 데이터 반영 전)')
}
console.log('')

console.log('5. quality-sessions 상세 샘플')
if (report.sessionsDetailSample) {
  const s = report.sessionsDetailSample
  console.log(`   thread: ${Array.isArray(s.thread) ? `배열 길이 ${s.thread.length}` : s.thread}`)
  console.log(`   finalAgentEnding: ${s.finalAgentEnding != null ? `있음(${String(s.finalAgentEnding).length}자)` : s.finalAgentEnding}`)
  console.log(`   questionFirstSentence: ${s.questionFirstSentence != null ? '있음' : s.questionFirstSentence}`)
  console.log(`   answerFirstSentence: ${s.answerFirstSentence != null ? '있음' : s.answerFirstSentence}`)
} else {
  console.log('   (없음)')
}
console.log('')

console.log('6. metadata 필드 존재 여부 (응답 기준)')
const meta = report.metadataFieldsPresent || {}
console.log(`   allRunsHaveThread: ${meta.allRunsHaveThread}`)
console.log(`   allRunsHaveFinalAgentEnding: ${meta.allRunsHaveFinalAgentEnding}`)
console.log(`   allRunsHaveQuestionFirstSentence: ${meta.allRunsHaveQuestionFirstSentence}`)
console.log(`   allRunsHaveAnswerFirstSentence: ${meta.allRunsHaveAnswerFirstSentence}`)
console.log('')
console.log('(/admin/quality 화면에서 운영 경고 카드는 KPI 조회 후 threadMissingCount, finalAgentEndingMissingCount와 일치하는지 확인하세요.)')
