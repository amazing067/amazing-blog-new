import { NextResponse } from 'next/server';
import { requireContentAccess, adminClient } from '@/lib/admin/guard';

// 네이버용 복사 시 시각 블록(통계·비교·SVG 등)을 PNG로 구워 올리는 범용 업로드.
// 네이버 에디터는 data: URL을 막으므로 반드시 공개 URL이 필요하다.
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

export async function POST(req: Request) {
  await requireContentAccess();
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: '파일이 필요합니다' }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const supa = adminClient();
    await ensureBucket();

    const path = `naver/${crypto.randomUUID()}.png`;
    const { error: upErr } = await supa.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: 'image/png', upsert: true });
    if (upErr) throw upErr;

    const { data } = supa.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[content/upload-image] failed', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
