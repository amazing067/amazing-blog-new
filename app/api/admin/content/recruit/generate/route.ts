import { NextResponse } from 'next/server';
import { requireContentAccess, adminClient } from '@/lib/admin/guard';
import { pickFreshRecruitTopics, RECRUIT_TOPIC_POOL } from '@/lib/content/recruit-topics';
import { generateRecruitCardSet } from '@/lib/content/generator-recruit-card';
import { lintRecruit } from '@/lib/content/recruit-lint';
import { calcCost } from '@/lib/content/billing';
import { getRecruitImage, type RecruitImageSlot } from '@/lib/content/recruit-image';
import { generateRecruitImageForTopic } from '@/lib/content/recruit-image-gen';
import { pickStrengthsLRU, RECRUIT_STRENGTH_TITLE, RECRUIT_STRENGTH_CAPSTONE } from '@/lib/content/recruit-strengths';
import type { CardSlide, CardStyleKey, RecruitImage } from '@/lib/content/types';

const GENERATOR_MODEL = 'claude-haiku-4-5';
const STYLES: CardStyleKey[] = ['A', 'B', 'C', 'D', 'E', 'F'];
const IMAGEN_COST_USD = 0.04; // Imagen 4 장당 대략 단가 (비용 추적용)

function flatten(slides: CardSlide[]): string {
  return slides.map(s =>
    s.kind === 'cover' ? `${s.eyebrow} ${s.title} ${s.bigStat} ${s.bigStatLabel}`
    : s.kind === 'point' ? `${s.title} ${s.body} ${s.bigStat} ${s.bigStatLabel} ${(s.benefits ?? []).map(b => `${b.head} ${b.exp}`).join(' ')} ${s.capstone?.text ?? ''}`
    : `${s.title} ${s.items.join(' ')} ${s.footer}`).join('\n');
}

// 수동 생성 — 어드민 "새 카드 생성" 버튼. (cron 자동화는 Phase 2)
export async function POST(req: Request) {
  await requireContentAccess();
  const supa = adminClient();
  const body = await req.json().catch(() => ({}));
  const requestedSlug = typeof body?.slug === 'string' ? body.slug : undefined;

  // 30일 내 사용 슬러그 (리쿠르팅만 — type='recruit-card')
  const { data: recent } = await supa.from('content_items').select('source_refs')
    .eq('type', 'recruit-card').gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString());
  const used = new Set<string>();
  const recentStrengthHeads: string[] = []; // 최근 사용한 강점 head들 — LRU 회전(전부 한 번씩)
  for (const r of recent ?? []) {
    for (const ref of (r.source_refs ?? []) as Array<{ topic_slug?: string; strengths?: string[] }>) {
      if (ref.topic_slug) used.add(ref.topic_slug);
      if (Array.isArray(ref.strengths)) recentStrengthHeads.push(...ref.strengths);
    }
  }

  const topic = requestedSlug
    ? RECRUIT_TOPIC_POOL.find(t => t.slug === requestedSlug)
    : pickFreshRecruitTopics(used, 1)[0];
  if (!topic) return NextResponse.json({ error: '생성할 앵글을 찾지 못했습니다' }, { status: 400 });

  try {
    const set = await generateRecruitCardSet(topic);

    // 듀오톤 사진 주입 — 커버(0)·통념(2)·증거(4). 토픽 내용 맞춤 실시간 생성.
    // 슬롯 3장 병렬 생성, 실패 시 기존 정적 풀로 폴백(없으면 렌더 단색 fallback).
    let imageCount = 0; // Imagen 실제 호출(성공) 수 — 비용 추적용
    const pickImage = async (slot: RecruitImageSlot): Promise<RecruitImage | undefined> => {
      try {
        const img = await generateRecruitImageForTopic(supa, topic, slot);
        imageCount++;
        return img;
      } catch (e) {
        console.warn(`[recruit/generate] 이미지 실시간 생성 실패 ${topic.slug}/${slot} — 정적 풀 폴백:`,
          e instanceof Error ? e.message : e);
        return getRecruitImage(topic.pillar, slot);
      }
    };
    const [coverImg, breakImg, eviImg] = await Promise.all([
      pickImage('cover'), pickImage('breakthrough'), pickImage('evidence'),
    ]);

    const cover = set.slides[0];
    if (cover && cover.kind === 'cover' && coverImg) cover.image = coverImg;
    const breakthrough = set.slides[2];
    if (breakthrough && breakthrough.kind === 'point' && breakImg) breakthrough.image = breakImg;
    const evidence = set.slides[4];
    if (evidence && evidence.kind === 'point' && eviImg) evidence.image = eviImg;

    // 강점 카드(3) — 고정 팩트뱅크(시스템+수수료). LRU 회전으로 전부 한 번씩 노출.
    const chosenStrengths = pickStrengthsLRU(recentStrengthHeads, topic.slug);
    const strength = set.slides[3];
    if (strength && strength.kind === 'point') {
      strength.layout = 'benefits';
      strength.title = RECRUIT_STRENGTH_TITLE;
      strength.benefits = chosenStrengths;
      strength.capstone = RECRUIT_STRENGTH_CAPSTONE;
      strength.gridItems = undefined; // 구 그리드 데이터 정리
    }

    const flat = flatten(set.slides);
    const lint = lintRecruit(flat);

    const genIn = set.usage?.input_tokens ?? 0;
    const genOut = set.usage?.output_tokens ?? 0;
    const genCost = calcCost(GENERATOR_MODEL, genIn, genOut);
    const imageCost = imageCount * IMAGEN_COST_USD;
    const totalCost = genCost + imageCost;
    const cardStyle = STYLES[Math.floor(Math.random() * STYLES.length)]; // 수동 생성은 스타일 랜덤(다양성)

    const { data: inserted, error } = await supa.from('content_items').insert({
      type: 'recruit-card',
      title: set.title,
      body_md: flat,
      card_slides: set.slides,
      card_style: cardStyle,
      source_refs: [{
        topic_slug: topic.slug,
        pillar: topic.pillar,
        tone: topic.tone,
        target: topic.target,
        strengths: chosenStrengths.map(s => s.head), // LRU 회전 이력
        generated_by: GENERATOR_MODEL,
      }],
      status: 'review',
      generated_by: GENERATOR_MODEL,
      gen_input_tokens: genIn,
      gen_output_tokens: genOut,
      gen_cost_usd: genCost,
      total_cost_usd: totalCost,
    }).select('id').single();
    if (error || !inserted) throw error ?? new Error('insert failed');

    // 리쿠르팅 가드레일 결과는 raw_report(JSONB)에 저장. 보험용 배열 컬럼은 비움.
    await supa.from('compliance_lints').insert({
      content_id: inserted.id,
      forbidden_terms_found: [], comparison_phrases: [], guarantee_phrases: [],
      insurer_mentions: [], product_mentions: [],
      risk_score: lint.risk_score,
      must_fix: lint.must_fix,
      raw_report: lint,
    });

    return NextResponse.json({ ok: true, id: inserted.id, slug: topic.slug, risk_score: lint.risk_score, must_fix: lint.must_fix });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[recruit/generate] failed', topic.slug, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
