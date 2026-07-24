import { NextResponse } from 'next/server';

// [비활성화] 카드뉴스 자동생성 cron은 amazing-biz-server로 이전되었습니다.
// 중복 실행 방지를 위해 이 라우트는 중단되었고, vercel.json의 crons에서도 제거되었습니다.
// (서버: src/services/contentHub/dailyContentCron.js — 매일 KST 08:00 카드뉴스 생성)
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      message: '카드뉴스 자동생성은 amazing-biz-server로 이전되어 이 repo에서는 중단되었습니다.',
    },
    { status: 410 },
  );
}
