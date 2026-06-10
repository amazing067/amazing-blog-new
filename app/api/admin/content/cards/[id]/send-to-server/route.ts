import { NextResponse } from 'next/server';
import { requireContentAccess, adminClient } from '@/lib/admin/guard';
import type { ComplianceInfo } from '@/lib/content/types';

// 확정된 카드뉴스를 amazing-biz-server(설계사방)로 전송.
// 클라가 캡처한 PNG(multipart: 본문 5장 + 설계사 정보 비운 공유용 심의필 1장)를
//   → Supabase Storage(public, cardnews/{id}/slide-NN.png upsert + 캐시버스트) 업로드
//   → 공유키(x-ingest-key)로 서버 /api/card-news/ingest 로 전송.
// 설계사명·협회등록번호는 비워서 보내고(이미지에서도 비움), 각 설계사가 본인 정보로 채워 사용.
const BUCKET = 'content-images';

async function ensureBucket() {
  const supa = adminClient();
  const { error } = await supa.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '10MB',
    allowedMimeTypes: ['image/png', 'image/jpeg'],
  });
  if (error && !/exist/i.test(error.message)) throw error;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireContentAccess();
  const { id } = await ctx.params;

  const ingestUrl = process.env.AMAZING_INGEST_URL;
  const key = process.env.INGEST_API_KEY;
  if (!ingestUrl || !key) {
    return NextResponse.json(
      { error: '서버 연동 환경변수(AMAZING_INGEST_URL / INGEST_API_KEY)가 설정되지 않았습니다.' },
      { status: 500 },
    );
  }

  try {
    const form = await req.formData();
    const files = form.getAll('images').filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: '전송할 이미지가 없습니다.' }, { status: 400 });
    }

    const supa = adminClient();
    // 심의 메타(번호·회사·기간)는 DB에서 읽고, 설계사 정보는 비워서 보낸다.
    const { data: item, error } = await supa
      .from('content_items')
      .select('title, source_refs, compliance')
      .eq('id', id)
      .single();
    if (error || !item) {
      return NextResponse.json({ error: error?.message ?? '카드를 찾을 수 없습니다.' }, { status: 404 });
    }
    const compliance = (item.compliance ?? {}) as Partial<ComplianceInfo>;
    const category = (item.source_refs as Array<{ category?: string | null }> | null)?.[0]?.category ?? null;

    await ensureBucket();
    // 재전송 시 같은 경로 덮어쓰기(upsert) + 캐시버스트(?v=) → 자료실에서 옛 이미지 안 보이게
    const ver = Date.now();
    const imageUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const buf = Buffer.from(await files[i].arrayBuffer());
      const path = `cardnews/${id}/slide-${String(i + 1).padStart(2, '0')}.png`;
      const { error: upErr } = await supa.storage
        .from(BUCKET)
        .upload(path, buf, { contentType: 'image/png', upsert: true });
      if (upErr) throw upErr;
      const { data } = supa.storage.from(BUCKET).getPublicUrl(path);
      imageUrls.push(`${data.publicUrl}?v=${ver}`);
    }

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
      image_urls: imageUrls,
    };

    const endpoint = ingestUrl.includes('/card-news/ingest')
      ? ingestUrl
      : `${ingestUrl.replace(/\/$/, '')}/api/card-news/ingest`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ingest-key': key },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data.ok === false) {
      throw new Error(data.error || `서버 전송 실패 (${resp.status})`);
    }

    await supa.from('content_items').update({ sent_to_server_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ ok: true, count: imageUrls.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[cards/send-to-server] failed', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
