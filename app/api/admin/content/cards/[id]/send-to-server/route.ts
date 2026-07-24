import { NextResponse } from 'next/server';

// [비활성화] 카드뉴스 → amazing-biz-server 전송 브릿지는 중단되었습니다.
// 이제 카드뉴스 생성·수신·배포(자료실)를 서버(amazing-biz-server)가 자체적으로 처리하므로
// 블로그에서 PNG를 만들어 /api/card-news/ingest 로 밀어 넣는 중복 경로가 필요 없습니다.
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      message:
        '카드뉴스 서버 전송은 중단되었습니다. 카드뉴스 생성·배포는 amazing-biz-server에서 직접 처리됩니다.',
    },
    { status: 410 },
  );
}
