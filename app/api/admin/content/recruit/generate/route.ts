import { NextResponse } from 'next/server';
import { requireAdmin, adminClient } from '@/lib/admin/guard';
import { pickFreshRecruitTopics, RECRUIT_TOPIC_POOL } from '@/lib/content/recruit-topics';
import { generateRecruitCardSet } from '@/lib/content/generator-recruit-card';
import { lintRecruit } from '@/lib/content/recruit-lint';
import { calcCost } from '@/lib/content/billing';
import { getRecruitImage } from '@/lib/content/recruit-image';
import { pickStrengths, RECRUIT_STRENGTH_TITLE, RECRUIT_STRENGTH_CAPSTONE } from '@/lib/content/recruit-strengths';
import type { CardSlide, CardStyleKey } from '@/lib/content/types';

const GENERATOR_MODEL = 'claude-haiku-4-5';
const STYLES: CardStyleKey[] = ['A', 'B', 'C', 'D', 'E', 'F'];

function flatten(slides: CardSlide[]): string {
  return slides.map(s =>
    s.kind === 'cover' ? `${s.eyebrow} ${s.title} ${s.bigStat} ${s.bigStatLabel}`
    : s.kind === 'point' ? `${s.title} ${s.body} ${s.bigStat} ${s.bigStatLabel} ${(s.benefits ?? []).map(b => `${b.head} ${b.exp}`).join(' ')} ${s.capstone?.text ?? ''}`
    : `${s.title} ${s.items.join(' ')} ${s.footer}`).join('\n');
}

// 수동 생성 — 어드민 "새 카드 생성" 버튼. (cron 자동화는 Phase 2)
export async function POST(req: Request) {
  await requireAdmin();
  const supa = adminClient();
  const body = await req.json().catch(() => ({}));
  const requestedSlug = typeof body?.slug === 'string' ? body.slug : undefined;

  // 30일 내 사용 슬러그 (리쿠르팅만 — type='recruit-card')
  const { data: recent } = await supa.from('content_items').select('source_refs')
    .eq('type', 'recruit-card').gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString());
  const used = new Set<string>();
  for (const r of recent ?? []) {
    for (const ref of (r.source_refs ?? []) as Array<{ topic_slug?: string }>) {
      if (ref.topic_slug) used.add(ref.topic_slug);
    }
  }

  const topic = requestedSlug
    ? RECRUIT_TOPIC_POOL.find(t => t.slug === requestedSlug)
    : pickFreshRecruitTopics(used, 1)[0];
  if (!topic) return NextResponse.json({ error: '생성할 앵글을 찾지 못했습니다' }, { status: 400 });

  try {
    const set = await generateRecruitCardSet(topic);

    // 듀오톤 사진 주입 — 커버(0)·통념(2)·증거(4). 풀 비면 undefined → 렌더 단색 fallback.
    const cover = set.slides[0];
    if (cover && cover.kind === 'cover') {
      const img = getRecruitImage(topic.pillar, 'cover');
      if (img) cover.image = img;
    }
    const breakthrough = set.slides[2];
    if (breakthrough && breakthrough.kind === 'point') {
      const img = getRecruitImage(topic.pillar, 'breakthrough');
      if (img) breakthrough.image = img;
    }

    // 강점 카드(3) — AI 그리드 폐기, 고정 팩트뱅크 혜택 3개 + 캡스톤 주입(topic.slug seed로 변주).
    const strength = set.slides[3];
    if (strength && strength.kind === 'point') {
      strength.layout = 'benefits';
      strength.title = RECRUIT_STRENGTH_TITLE;
      strength.benefits = pickStrengths(topic.slug);
      strength.capstone = RECRUIT_STRENGTH_CAPSTONE;
      strength.gridItems = undefined; // 구 그리드 데이터 정리
    }
    const evidence = set.slides[4];
    if (evidence && evidence.kind === 'point') {
      const img = getRecruitImage(topic.pillar, 'evidence');
      if (img) evidence.image = img;
    }

    const flat = flatten(set.slides);
    const lint = lintRecruit(flat);

    const genIn = set.usage?.input_tokens ?? 0;
    const genOut = set.usage?.output_tokens ?? 0;
    const genCost = calcCost(GENERATOR_MODEL, genIn, genOut);
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
        generated_by: GENERATOR_MODEL,
      }],
      status: 'review',
      generated_by: GENERATOR_MODEL,
      gen_input_tokens: genIn,
      gen_output_tokens: genOut,
      gen_cost_usd: genCost,
      total_cost_usd: genCost,
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
