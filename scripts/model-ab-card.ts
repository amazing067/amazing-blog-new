/**
 * 카드뉴스 본문 생성 모델 A/B 하네스 (Phase 2 — 모델 결정 게이트).
 *
 *   npx tsx scripts/model-ab-card.ts                 # 3주제 × 2모델 생성 + 채점 + HTML 리포트
 *   npx tsx scripts/model-ab-card.ts --no-factcheck  # 팩트체크 생략(빠름·저비용)
 *
 * 비교 대상:
 *   - Opus 4.8  (claude-opus-4-8)      : temperature 미지원 → adaptive thinking 사용
 *   - Gemini 2.5 Pro (gemini-2.5-pro)  : temperature 0.85
 * 현재 프로덕션 본문 모델은 claude-haiku-4-5. 이 실험으로 상위 모델 채택 여부를 결정한다.
 *
 * 동일 프롬프트(buildCardPrompt)·동일 파서(validateSlides)·동일 검수(lintContent/factCheck)로
 * 공정 비교한다. 운영 코드는 건드리지 않는다 — 결과를 보고 사람이 모델을 결정한다.
 *
 * 산출물: model-ab-report.html (좌 Opus / 우 Gemini 슬라이드 + 지표표 + 종합점수)
 */
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
else dotenv.config();

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { TOPIC_POOL } from '../lib/content/topics';
import { buildCardPrompt, validateSlides } from '../lib/content/generator-card';
import { lintContent } from '../lib/content/compliance-lint';
import { factCheckArticle } from '../lib/content/fact-check';
import type { CardSlide, Topic } from '../lib/content/types';

// ---- 설정 ----------------------------------------------------------------
const TEST_SLUGS = ['claim-non-disc', 'cancer-stage', 'sl-self-burden'];
const OPUS_MODEL = 'claude-opus-4-8';
const GEMINI_MODEL = 'gemini-2.5-pro';
const NO_FACTCHECK = process.argv.includes('--no-factcheck');

// 단가 (USD / 1M tokens). Gemini는 ≤200k 구간 공시가(근사치).
const PRICING: Record<string, { input: number; output: number }> = {
  [OPUS_MODEL]: { input: 5.0, output: 25.0 },
  [GEMINI_MODEL]: { input: 1.25, output: 10.0 },
};
const USD_TO_KRW = 1350;

// ---- 타입 ----------------------------------------------------------------
type GenResult = {
  model: string;
  title: string;
  slides: CardSlide[];
  usage: { input_tokens: number; output_tokens: number };
  ms: number;
  error?: string;
};
type Scored = GenResult & {
  riskScore: number;
  forbidden: string[];
  sourceFill: number; // 출처 매핑된 슬라이드 수 (0~5)
  structureOk: boolean;
  factHigh: number;
  factMedium: number;
  costUsd: number;
  dupVsExisting: number | null; // 기존(5월) 카드와 유사도 0~1
  total: number; // 종합 점수 0~100
};

// ---- 공통 ----------------------------------------------------------------
function extractJson(text: string): { title?: unknown; slides?: unknown } {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('응답에서 JSON 못 찾음');
  return JSON.parse(text.slice(s, e + 1));
}

function slidesText(title: string, slides: CardSlide[]): string {
  const parts: string[] = [title];
  for (const s of slides) {
    if (s.kind === 'cover') parts.push(s.eyebrow, s.title, s.bigStat, s.bigStatLabel);
    else if (s.kind === 'point') parts.push(s.title, s.body, s.bigStat, s.bigStatLabel);
    else parts.push(s.title, ...s.items, s.footer);
  }
  return parts.filter(Boolean).join(' ');
}

// 단어 3-gram Jaccard 유사도 (간이 중복 측정).
function jaccard(a: string, b: string): number {
  const grams = (t: string) => {
    const w = t.replace(/\s+/g, ' ').trim().split(' ');
    const g = new Set<string>();
    for (let i = 0; i < w.length - 2; i++) g.add(w.slice(i, i + 3).join(' '));
    return g;
  };
  const A = grams(a), B = grams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

// ---- 생성: Opus 4.8 ------------------------------------------------------
async function genOpus(topic: Topic): Promise<GenResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const t0 = Date.now();
  try {
    const msg = await client.messages.create({
      model: OPUS_MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' }, // Opus 4.8: temperature 미지원
      output_config: { effort: 'medium' } as never,
      messages: [{ role: 'user', content: buildCardPrompt(topic) }],
    } as never);
    const ms = Date.now() - t0;
    const text = (msg.content as Array<{ type: string; text?: string }>)
      .filter(b => b.type === 'text').map(b => b.text ?? '').join('\n').trim();
    const obj = extractJson(text);
    return {
      model: OPUS_MODEL,
      title: String(obj.title ?? ''),
      slides: validateSlides(obj.slides),
      usage: { input_tokens: msg.usage?.input_tokens ?? 0, output_tokens: msg.usage?.output_tokens ?? 0 },
      ms,
    };
  } catch (e) {
    return { model: OPUS_MODEL, title: '', slides: [], usage: { input_tokens: 0, output_tokens: 0 }, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---- 생성: Gemini 2.5 Pro ------------------------------------------------
async function genGemini(topic: Topic): Promise<GenResult> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { temperature: 0.85, maxOutputTokens: 8192, responseMimeType: 'application/json' },
  });
  const t0 = Date.now();
  let lastErr = '';
  // 비제한 키 단속 프리뷰로 간헐적 403이 떠서 최대 4회 재시도(지수 백오프).
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const result = await model.generateContent(buildCardPrompt(topic));
      const ms = Date.now() - t0;
      const text = result.response.text().trim();
      const um = result.response.usageMetadata;
      const obj = extractJson(text);
      return {
        model: GEMINI_MODEL,
        title: String(obj.title ?? ''),
        slides: validateSlides(obj.slides),
        usage: { input_tokens: um?.promptTokenCount ?? 0, output_tokens: um?.candidatesTokenCount ?? 0 },
        ms,
      };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      if (attempt < 4) await new Promise(r => setTimeout(r, attempt * 2500));
    }
  }
  return { model: GEMINI_MODEL, title: '', slides: [], usage: { input_tokens: 0, output_tokens: 0 }, ms: Date.now() - t0, error: lastErr };
}

// ---- 채점 ----------------------------------------------------------------
async function score(r: GenResult, existingText: string | null): Promise<Scored> {
  if (r.error || r.slides.length === 0) {
    return { ...r, riskScore: 100, forbidden: [], sourceFill: 0, structureOk: false, factHigh: 0, factMedium: 0, costUsd: 0, dupVsExisting: null, total: 0 };
  }
  const text = slidesText(r.title, r.slides);
  const lint = lintContent(text);
  const sourceFill = r.slides.filter(s => (s.kind === 'cover' || s.kind === 'point') && s.source).length;
  const structureOk = r.slides.length === 5 && r.slides[0].kind === 'cover' && r.slides[4].kind === 'closing';

  let factHigh = 0, factMedium = 0;
  if (!NO_FACTCHECK) {
    try {
      const fc = await factCheckArticle(r.title, text);
      factHigh = fc.issues.filter(i => i.severity === 'high').length;
      factMedium = fc.issues.filter(i => i.severity === 'medium').length;
    } catch { /* 팩트체크 실패는 채점에서 무시 */ }
  }

  const p = PRICING[r.model];
  const costUsd = (r.usage.input_tokens * p.input + r.usage.output_tokens * p.output) / 1_000_000;
  const dupVsExisting = existingText ? jaccard(text, existingText) : null;

  // 종합 점수(0~100): 사실성 35 + 출처 20 + 심의 20 + 다양성 15 + 구조 10
  let total = 0;
  total += Math.max(0, 35 - factHigh * 20 - factMedium * 5);
  total += (sourceFill / 5) * 20;
  total += Math.max(0, 20 - lint.risk_score * 0.2);
  if (dupVsExisting != null) total += (1 - Math.min(1, dupVsExisting)) * 15;
  else total += 15; // 기존 카드 없으면 다양성 만점 처리
  total += structureOk ? 10 : 0;

  return {
    ...r, riskScore: lint.risk_score, forbidden: lint.forbidden_terms_found,
    sourceFill, structureOk, factHigh, factMedium, costUsd, dupVsExisting,
    total: Math.round(total),
  };
}

// ---- HTML 리포트 ---------------------------------------------------------
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function slideCard(s: CardSlide): string {
  if (s.kind === 'cover') return `<div class="sl"><div class="kd">표지</div><div class="eb">${esc(s.eyebrow)}</div><h3>${esc(s.title)}</h3><div class="bs">${esc(s.bigStat)} <span>${esc(s.bigStatLabel)}</span></div>${s.source ? `<div class="src">📎 ${esc(s.source.organization)} · ${esc(s.source.name)}</div>` : ''}</div>`;
  if (s.kind === 'point') return `<div class="sl"><div class="kd">${esc(s.number)}</div><div class="bs">${esc(s.bigStat)} <span>${esc(s.bigStatLabel)}</span></div><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p>${s.source ? `<div class="src">📎 ${esc(s.source.organization)} · ${esc(s.source.name)}</div>` : ''}</div>`;
  return `<div class="sl"><div class="kd">마무리</div><h3>${esc(s.title)}</h3><ul>${s.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul><div class="ft">${esc(s.footer)}</div></div>`;
}
function metricRow(sc: Scored): string {
  const krw = Math.round(sc.costUsd * USD_TO_KRW);
  return `<table class="mx"><tr><td>종합점수</td><th>${sc.total}/100</th></tr>`
    + `<tr><td>사실성(팩트체크 high/med)</td><td>${NO_FACTCHECK ? '—' : `${sc.factHigh} / ${sc.factMedium}`}</td></tr>`
    + `<tr><td>출처 채움</td><td>${sc.sourceFill}/5</td></tr>`
    + `<tr><td>심의 위험점수</td><td>${sc.riskScore}${sc.forbidden.length ? ' ⚠ ' + esc(sc.forbidden.join(', ')) : ''}</td></tr>`
    + `<tr><td>기존(5월)과 유사도</td><td>${sc.dupVsExisting == null ? '—' : (sc.dupVsExisting * 100).toFixed(0) + '%'}</td></tr>`
    + `<tr><td>구조 5장</td><td>${sc.structureOk ? 'OK' : '✗'}</td></tr>`
    + `<tr><td>토큰 in/out</td><td>${sc.usage.input_tokens}/${sc.usage.output_tokens}</td></tr>`
    + `<tr><td>비용/지연</td><td>$${sc.costUsd.toFixed(4)} (≈${krw}원) · ${(sc.ms / 1000).toFixed(1)}s</td></tr>`
    + `</table>`;
}
function buildHtml(blocks: Array<{ topic: Topic; opus: Scored; gemini: Scored }>): string {
  const css = `body{font-family:-apple-system,'Malgun Gothic',sans-serif;background:#f4f4f5;margin:0;padding:24px;color:#18181b}h1{font-size:22px}h2{font-size:17px;margin:28px 0 8px;border-left:4px solid #6366f1;padding-left:8px}.cmp{display:grid;grid-template-columns:1fr 1fr;gap:18px}.col{background:#fff;border-radius:12px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.08)}.col h3.mdl{margin:0 0 4px;font-size:15px}.win{outline:2px solid #16a34a}.badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:99px;background:#dcfce7;color:#15803d;margin-left:6px}.sl{border:1px solid #e4e4e7;border-radius:8px;padding:10px;margin:8px 0;background:#fafafa}.sl h3{font-size:14px;margin:4px 0}.sl p{font-size:12px;color:#3f3f46;margin:4px 0}.kd{font-size:10px;color:#a1a1aa;text-transform:uppercase}.eb{font-size:11px;color:#6366f1}.bs{font-size:13px;font-weight:700;color:#4338ca}.bs span{font-weight:400;font-size:11px;color:#71717a}.src{font-size:10px;color:#059669;margin-top:4px}.ft{font-size:10px;color:#a1a1aa;margin-top:6px}ul{margin:4px 0;padding-left:16px;font-size:12px}.mx{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}.mx td,.mx th{border:1px solid #e4e4e7;padding:3px 6px;text-align:left}.mx th{background:#eef2ff}.err{color:#dc2626;font-size:12px}`;
  let body = `<h1>카드뉴스 본문 모델 A/B — Opus 4.8 vs Gemini 2.5 Pro</h1><p style="font-size:13px;color:#71717a">현재 프로덕션=claude-haiku-4-5. 종합점수=사실성35+출처20+심의20+다양성15+구조10. 비용은 입력 토큰가 기준, Gemini 단가는 근사치. 최종 판단은 슬라이드 품질·톤을 눈으로 확인 후 결정.</p>`;
  for (const b of blocks) {
    const owin = b.opus.total >= b.gemini.total;
    body += `<h2>${esc(b.topic.title)} <span style="font-weight:400;font-size:12px;color:#a1a1aa">(${b.topic.slug})</span></h2><div class="cmp">`;
    for (const [sc, win] of [[b.opus, owin], [b.gemini, !owin]] as Array<[Scored, boolean]>) {
      body += `<div class="col${win && sc.total > 0 ? ' win' : ''}"><h3 class="mdl">${esc(sc.model)}${win && sc.total > 0 ? '<span class="badge">우세</span>' : ''}</h3>`;
      if (sc.error) body += `<div class="err">생성 실패: ${esc(sc.error)}</div>`;
      else { body += `<div style="font-size:13px;font-weight:600">${esc(sc.title)}</div>`; for (const s of sc.slides) body += slideCard(s); }
      body += metricRow(sc) + `</div>`;
    }
    body += `</div>`;
  }
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>모델 A/B 카드뉴스</title><style>${css}</style></head><body>${body}</body></html>`;
}

// ---- main ----------------------------------------------------------------
async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY 필요');
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY 필요');

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supa = supaUrl && supaKey ? createClient(supaUrl, supaKey) : null;

  const blocks: Array<{ topic: Topic; opus: Scored; gemini: Scored }> = [];

  for (const slug of TEST_SLUGS) {
    const topic = TOPIC_POOL.find(t => t.slug === slug);
    if (!topic) { console.error(`주제 없음: ${slug}`); continue; }
    console.log(`\n▶ ${topic.title} (${slug})`);

    // 기존(5월) 카드 텍스트 — 유사도 비교용
    let existingText: string | null = null;
    if (supa) {
      const { data } = await supa.from('content_items')
        .select('title, card_slides')
        .eq('type', 'card').contains('source_refs', [{ topic_slug: slug }])
        .order('created_at', { ascending: true }).limit(1);
      const row = data?.[0] as { title?: string; card_slides?: CardSlide[] } | undefined;
      if (row?.card_slides) existingText = slidesText(row.title ?? '', row.card_slides);
    }

    console.log('  · Opus 4.8 생성...');
    const opusR = await genOpus(topic);
    console.log(`    ${opusR.error ? '실패: ' + opusR.error : `OK (${(opusR.ms / 1000).toFixed(1)}s, out ${opusR.usage.output_tokens}tok)`}`);
    console.log('  · Gemini 2.5 Pro 생성...');
    const gemR = await genGemini(topic);
    console.log(`    ${gemR.error ? '실패: ' + gemR.error : `OK (${(gemR.ms / 1000).toFixed(1)}s, out ${gemR.usage.output_tokens}tok)`}`);

    console.log('  · 채점...');
    const opus = await score(opusR, existingText);
    const gemini = await score(gemR, existingText);
    console.log(`    Opus ${opus.total}/100 · Gemini ${gemini.total}/100`);
    blocks.push({ topic, opus, gemini });
  }

  const html = buildHtml(blocks);
  const out = path.join(process.cwd(), 'model-ab-report.html');
  fs.writeFileSync(out, html, 'utf-8');

  // 콘솔 요약
  console.log('\n===== 종합 =====');
  let oSum = 0, gSum = 0;
  for (const b of blocks) {
    oSum += b.opus.total; gSum += b.gemini.total;
    console.log(`${b.topic.slug}: Opus ${b.opus.total} vs Gemini ${b.gemini.total} → ${b.opus.total >= b.gemini.total ? 'Opus' : 'Gemini'}`);
  }
  console.log(`합계: Opus ${oSum} vs Gemini ${gSum} → 우세: ${oSum >= gSum ? 'Opus 4.8' : 'Gemini 2.5 Pro'}`);
  console.log(`\n리포트: ${out}`);
}

main().catch(e => { console.error(e); process.exit(1); });
