// Q&A 품질 KPI 스냅샷 — 최근 7일·30일 메트릭 한 번에 확인.
// usage_logs.meta를 직접 분석해 quality-kpi API 핵심 지표를 콘솔로 출력.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function snapshot(days) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data: rows, error } = await supa
    .from('usage_logs')
    .select('id, user_id, type, total_tokens, meta, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw error;

  const qa = rows.filter(r => r.type === 'qa');
  const blog = rows.filter(r => r.type === 'blog');

  const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];

  // 품질 경고
  let qualityWarnCount = 0;
  const warnTypes = {};
  // 실패 태그
  const failureTags = {};
  let regenCount = 0;
  // 점수
  let scoreSum = 0, scoreCount = 0;
  // 길이
  let lenSum = 0, lenCount = 0;
  const lenBuckets = { '<280': 0, '280-320': 0, '320-420': 0, '420-520': 0, '520+': 0 };
  // 다양성
  const opener = {}, structure = {}, persona = {}, title = {};
  // 모델 호출
  const models = {};
  // 검색량
  let kwSlots = 0, kwZero = 0;
  // market head
  let mhTotal = 0, mhNonZero = 0, mhFake = 0, mhUnavail = 0;
  // 스레드/엔딩
  let threadMissing = 0, endingMissing = 0, threadRoleBreak = 0;
  // concern 다양성
  const concerns = {};
  // 지연
  let latSum = 0, latCount = 0;
  // 비용
  let costUsd = 0;

  for (const r of rows) {
    const meta = r.meta || {};
    if (Array.isArray(meta.qualityWarnings) && meta.qualityWarnings.length) {
      qualityWarnCount++;
      meta.qualityWarnings.forEach(w => warnTypes[w] = (warnTypes[w] || 0) + 1);
    }
    if (Array.isArray(meta.failureTags)) {
      meta.failureTags.forEach(t => failureTags[t] = (failureTags[t] || 0) + 1);
    }
    if (Array.isArray(meta.regenHistory) && meta.regenHistory.length) regenCount++;
    if (typeof meta?.qualityGate?.totalScore === 'number') {
      scoreSum += meta.qualityGate.totalScore;
      scoreCount++;
    }
    if (typeof meta.answerLength === 'number' && meta.answerLength > 0) {
      lenSum += meta.answerLength; lenCount++;
      const L = meta.answerLength;
      if (L < 280) lenBuckets['<280']++;
      else if (L < 320) lenBuckets['280-320']++;
      else if (L < 420) lenBuckets['320-420']++;
      else if (L < 520) lenBuckets['420-520']++;
      else lenBuckets['520+']++;
    }
    if (meta.answerOpenerCategory) opener[meta.answerOpenerCategory] = (opener[meta.answerOpenerCategory] || 0) + 1;
    if (meta.answerStructureId) structure[meta.answerStructureId] = (structure[meta.answerStructureId] || 0) + 1;
    if (meta.answerPersonaId) persona[meta.answerPersonaId] = (persona[meta.answerPersonaId] || 0) + 1;
    if (meta.titlePatternId) title[meta.titlePatternId] = (title[meta.titlePatternId] || 0) + 1;
    if (Array.isArray(meta.tokenBreakdown)) {
      meta.tokenBreakdown.forEach(u => { if (u?.model) models[u.model] = (models[u.model] || 0) + 1; });
    }
    const dk = meta.displayKeywords || meta.searchKeywordsWithVolume;
    if (Array.isArray(dk)) {
      for (const d of dk) { kwSlots++; if (d.volume == null || d.volume === 0) kwZero++; }
    }
    const mh = meta.marketHeadKeyword;
    if (r.type === 'qa' && mh?.keyword?.trim()) {
      mhTotal++;
      if (mh.volume != null && mh.volume > 0) mhNonZero++;
      else if (mh.source === 'unavailable') mhUnavail++;
      else if (mh.volume === 0) mhFake++;
    }
    if (r.type === 'qa' && meta.conversationMode) {
      if (!Array.isArray(meta.thread) || meta.thread.length === 0) threadMissing++;
      if (meta.finalAgentEnding == null || meta.finalAgentEnding === '') endingMissing++;
      if (Array.isArray(meta.failureTags) && meta.failureTags.includes('thread_role_break')) threadRoleBreak++;
    }
    const sc = (meta.selectedCustomerConcern || '').trim();
    if (r.type === 'qa' && sc) concerns[sc] = (concerns[sc] || 0) + 1;
    if (typeof meta.latencyMs === 'number') { latSum += meta.latencyMs; latCount++; }
    if (typeof meta.costEstimate === 'number') costUsd += meta.costEstimate;
  }

  const pct = (n, d) => d > 0 ? `${(n / d * 100).toFixed(1)}%` : 'n/a';
  const top = (obj, k = 5) => Object.entries(obj).sort((a,b) => b[1]-a[1]).slice(0, k);
  const lockRate = (obj) => {
    const total = Object.values(obj).reduce((a,b) => a+b, 0);
    if (total === 0) return 'n/a';
    const max = Math.max(...Object.values(obj));
    return `${(max / total * 100).toFixed(1)}%`;
  };

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`최근 ${days}일 · ${rows.length}건 (Q&A ${qa.length}, Blog ${blog.length}) · 사용자 ${userIds.length}명`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  console.log(`\n【 핵심 품질 지표 】`);
  console.log(`  품질경고 발생률      : ${pct(qualityWarnCount, rows.length)} (${qualityWarnCount}/${rows.length})`);
  console.log(`  재생성률 (Q&A)        : ${pct(regenCount, qa.length)} (${regenCount}/${qa.length})`);
  console.log(`  평균 품질점수         : ${scoreCount > 0 ? (scoreSum/scoreCount).toFixed(1) : 'n/a'} (n=${scoreCount})`);
  console.log(`  평균 응답시간         : ${latCount > 0 ? (latSum/latCount/1000).toFixed(1) + 's' : 'n/a'} (n=${latCount})`);
  console.log(`  총 비용               : $${costUsd.toFixed(4)} (Q&A 1건당 ~₩${qa.length > 0 ? Math.round(costUsd*1300/qa.length) : 0})`);

  console.log(`\n【 실패 태그 Top5 】`);
  if (Object.keys(failureTags).length === 0) console.log(`  (없음 — 양호)`);
  else top(failureTags).forEach(([t, c]) => console.log(`  ${t.padEnd(30)} ${c}회`));

  console.log(`\n【 품질경고 유형 Top5 】`);
  if (Object.keys(warnTypes).length === 0) console.log(`  (없음 — 양호)`);
  else top(warnTypes).forEach(([t, c]) => console.log(`  ${String(t).slice(0, 50).padEnd(50)} ${c}회`));

  console.log(`\n【 답변 길이 분포 】 평균=${lenCount > 0 ? Math.round(lenSum/lenCount) : 'n/a'}자 (n=${lenCount})`);
  Object.entries(lenBuckets).forEach(([k, v]) => console.log(`  ${k.padEnd(10)} ${v}건 (${pct(v, lenCount)})`));

  console.log(`\n【 다양성 잠금 (50%+ 쏠리면 경고) 】`);
  console.log(`  답변 톤(opener)       : ${lockRate(opener)} 1위 ← ${top(opener, 1).map(([k]) => k).join('') || '-'}`);
  console.log(`  답변 구조(structure)  : ${lockRate(structure)} 1위 ← ${top(structure, 1).map(([k]) => k).join('') || '-'}`);
  console.log(`  답변 페르소나(persona): ${lockRate(persona)} 1위 ← ${top(persona, 1).map(([k]) => k).join('') || '-'}`);
  console.log(`  제목 패턴(title)      : ${lockRate(title)} 1위 ← ${top(title, 1).map(([k]) => k).join('') || '-'}`);
  const concernTotal = Object.values(concerns).reduce((a,b) => a+b, 0);
  const concernUnique = Object.keys(concerns).length;
  console.log(`  Concern 다양성        : 고유 ${concernUnique} / 총 ${concernTotal} = ${pct(concernUnique, concernTotal)} 다양도, 1위 ${lockRate(concerns)}`);

  console.log(`\n【 모델 호출 분포 】`);
  const modelTotal = Object.values(models).reduce((a,b) => a+b, 0);
  Object.entries(models).sort((a,b) => b[1]-a[1]).forEach(([m, c]) => console.log(`  ${m.padEnd(28)} ${c}회 (${pct(c, modelTotal)})`));

  console.log(`\n【 키워드·검색량 】`);
  console.log(`  연관키워드 0 검색량  : ${pct(kwZero, kwSlots)} (${kwZero}/${kwSlots})`);
  console.log(`  대표키워드 진짜 검색량: ${pct(mhNonZero, mhTotal)} (${mhNonZero}/${mhTotal})`);
  console.log(`  대표키워드 가짜 노출  : ${pct(mhFake, mhTotal)} (volume=0인데 표시됨)`);
  console.log(`  대표키워드 unavailable: ${pct(mhUnavail, mhTotal)} (조회 실패)`);

  console.log(`\n【 운영 실패 (대화 모드만) 】`);
  console.log(`  thread 누락           : ${threadMissing}회`);
  console.log(`  finalAgentEnding 누락 : ${endingMissing}회`);
  console.log(`  thread_role_break     : ${threadRoleBreak}회`);
}

await snapshot(7);
await snapshot(30);
console.log('');
