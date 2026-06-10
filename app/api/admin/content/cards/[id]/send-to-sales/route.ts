import { NextResponse } from 'next/server';
import { requireAdmin, adminClient } from '@/lib/admin/guard';

// 심의완료 카드뉴스를 어메이징 영업자료실로 보내기.
// 흐름: 클라가 캡처한 6장 PNG(multipart) → Supabase Storage(public) 업로드 → public URL 6개 →
//       비밀키(x-ingest-key) 붙여 어메이징 서버 /api/card-news/ingest 로 JSON 전송.
// 카드뉴스는 인스타 공개 콘텐츠라 비공개 불필요 → public 버킷·URL 직접 노출 OK.
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
  await requireAdmin();
  const { id } = await ctx.params;

  const ingestUrl = process.env.AMAZING_INGEST_URL;
  const ingestKey = process.env.INGEST_API_KEY;
  if (!ingestUrl || !ingestKey) {
    return NextResponse.json(
      { error: '서버 환경변수(AMAZING_INGEST_URL / INGEST_API_KEY)가 설정되지 않았습니다.' },
      { status: 500 },
    );
  }

  try {
    const form = await req.formData();
    const files = form.getAll('images').filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: '이미지가 필요합니다.' }, { status: 400 });
    }
    const title = String(form.get('title') || '').trim();
    if (!title) return NextResponse.json({ error: '제목이 필요합니다.' }, { status: 400 });
    const category = (form.get('category') as string) || null;
    const complianceRaw = (form.get('compliance') as string) || '{}';
    let compliance: Record<string, unknown> = {};
    try { compliance = JSON.parse(complianceRaw); } catch { compliance = {}; }

    const supa = adminClient();
    await ensureBucket();

    // 재전송 시 같은 경로로 덮어쓰기(upsert) — source_id 폴더로 묶음
    const imageUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const buf = Buffer.from(await files[i].arrayBuffer());
      const path = `cardnews/${id}/slide-${String(i + 1).padStart(2, '0')}.png`;
      const { error: upErr } = await supa.storage
        .from(BUCKET)
        .upload(path, buf, { contentType: 'image/png', upsert: true });
      if (upErr) throw upErr;
      const { data } = supa.storage.from(BUCKET).getPublicUrl(path);
      // 캐시 무력화용 버전 파라미터 — 재전송 시 자료실에서 옛 이미지 안 보이게
      imageUrls.push(`${data.publicUrl}?v=${Date.now()}`);
    }

    const payload = {
      title,
      category,
      source_id: id,
      review: {
        number: compliance.number ?? null,
        company: compliance.company ?? null,
        designer: compliance.designer ?? null,
        start_date: compliance.start_date ?? null,
        end_date: compliance.end_date ?? null,
      },
      image_urls: imageUrls,
    };

    const resp = await fetch(`${ingestUrl.replace(/\/$/, '')}/api/card-news/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ingest-key': ingestKey },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data.ok === false) {
      throw new Error(data.error || `자료실 전송 실패 (${resp.status})`);
    }

    return NextResponse.json({ ok: true, count: imageUrls.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[cards/send-to-sales] failed', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
