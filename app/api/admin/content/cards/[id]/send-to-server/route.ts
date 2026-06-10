import { NextResponse } from 'next/server';
import { requireContentAccess, adminClient } from '@/lib/admin/guard';
import type { ComplianceInfo } from '@/lib/content/types';

// 확정된 카드뉴스를 amazing-biz-server(설계사방)로 전송.
// 서버-투-서버 호출(공유키 x-ingest-key) — 브라우저엔 키 노출 X.
// 설계사명·협회등록번호는 비워서 보낸다(각 설계사가 본인 정보로 채워 사용).
// 이미지는 브라우저가 공개버킷에 올린 URL(image_urls)을 그대로 전달한다.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireContentAccess();
  const { id } = await ctx.params;

  const { image_urls } = (await req.json().catch(() => ({}))) as { image_urls?: unknown };
  const urls = Array.isArray(image_urls)
    ? image_urls.filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u))
    : [];
  if (!urls.length) {
    return NextResponse.json({ ok: false, error: '전송할 이미지 URL이 없습니다.' }, { status: 400 });
  }

  const ingestUrl = process.env.AMAZING_INGEST_URL;
  const key = process.env.INGEST_API_KEY;
  if (!ingestUrl || !key) {
    return NextResponse.json(
      { ok: false, error: '서버 연동 환경변수(AMAZING_INGEST_URL / INGEST_API_KEY)가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }
  // AMAZING_INGEST_URL 은 전체 엔드포인트(.../api/card-news/ingest) 또는 베이스 URL 둘 다 허용
  const endpoint = ingestUrl.includes('/card-news/ingest')
    ? ingestUrl
    : `${ingestUrl.replace(/\/$/, '')}/api/card-news/ingest`;

  const supa = adminClient();
  const { data: item, error } = await supa
    .from('content_items')
    .select('title, source_refs, compliance, status')
    .eq('id', id)
    .single();
  if (error || !item) {
    return NextResponse.json({ ok: false, error: error?.message ?? '카드를 찾을 수 없습니다.' }, { status: 404 });
  }

  const compliance = (item.compliance ?? {}) as Partial<ComplianceInfo>;
  const category = (item.source_refs as Array<{ category?: string | null }> | null)?.[0]?.category ?? null;

  const payload = {
    title: item.title,
    category,
    source_id: `content_items_${id}`, // 재전송 시 upsert(중복 X)
    review: {
      number: compliance.number ?? '',
      company: compliance.company ?? '',
      designer: '', // 설계사 정보 비움 — 받는 설계사가 채움
      start_date: compliance.start_date ?? '',
      end_date: compliance.end_date ?? '',
    },
    image_urls: urls,
  };

  let resp: Response;
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ingest-key': key },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: '서버 연결 실패: ' + (e instanceof Error ? e.message : String(e)) },
      { status: 502 }
    );
  }

  const text = await resp.text();
  if (!resp.ok) {
    return NextResponse.json({ ok: false, error: `서버 응답 ${resp.status}: ${text}` }, { status: 502 });
  }

  const { error: stampErr } = await supa
    .from('content_items')
    .update({ sent_to_server_at: new Date().toISOString() })
    .eq('id', id);
  if (stampErr) {
    // 전송은 됐으나 시각 기록 실패 — 치명적 아님. 경고만.
    return NextResponse.json({ ok: true, warning: '전송됨(시각 기록 실패: ' + stampErr.message + ')', server: text });
  }

  return NextResponse.json({ ok: true, server: text });
}
