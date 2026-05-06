// 운영(Vercel) 환경에서 네이버 검색광고 API 살아있는지 진단하는 어드민 전용 엔드포인트.
// 로컬은 정상 작동하는데 운영에서만 marketHead.source='unavailable'이 100% 나오는 이슈를 진단하기 위한 임시 도구.
// 결과 확인 후 원인 파악되면 이 라우트는 삭제 가능.
//
// 호출: 어드민 로그인 후 GET /api/admin/probe-naver-searchad?keyword=실손보험
// 반환: 환경변수 존재 여부, 실제 API 호출 status·응답 일부.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/admin/guard';

export async function GET(request: NextRequest) {
  // 어드민 인증
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  const admin = adminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 });

  const CID = process.env.NAVER_SEARCHAD_CUSTOMER_ID;
  const KEY = process.env.NAVER_SEARCHAD_ACCESS_LICENSE;
  const SEC = process.env.NAVER_SEARCHAD_SECRET_KEY;

  const envCheck = {
    CUSTOMER_ID: CID ? { present: true, length: CID.length, prefix: CID.slice(0, 4) } : { present: false },
    ACCESS_LICENSE: KEY ? { present: true, length: KEY.length, prefix: KEY.slice(0, 8) } : { present: false },
    SECRET_KEY: SEC ? { present: true, length: SEC.length, prefix: SEC.slice(0, 8) } : { present: false },
  };

  if (!CID || !KEY || !SEC) {
    return NextResponse.json({
      envCheck,
      diagnosis: '환경변수 누락 — Vercel Project Settings → Environment Variables에 NAVER_SEARCHAD_* 3개 추가 필요',
    });
  }

  const keyword = new URL(request.url).searchParams.get('keyword') || '실손보험';
  const BASE = 'https://api.searchad.naver.com';
  const path = '/keywordstool';
  const ts = String(Date.now());
  const message = `${ts}.GET.${path}`;
  const keyBuf = SEC.includes('base64:')
    ? Buffer.from(SEC.replace(/^base64:/, ''), 'base64')
    : Buffer.from(SEC, 'utf8');
  const sig = crypto.createHmac('sha256', keyBuf).update(message, 'utf8').digest('base64');

  const q = new URLSearchParams();
  q.set('hintKeywords', keyword);
  q.set('showDetail', '1');
  q.set('includeHintKeywords', '1');

  const url = `${BASE}${path}?${q.toString()}`;

  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Timestamp': ts,
        'X-API-KEY': KEY,
        'X-Customer': CID,
        'X-Signature': sig,
        'Content-Type': 'application/json; charset=UTF-8',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({
      envCheck,
      callError: e instanceof Error ? e.message : String(e),
      diagnosis: 'fetch 자체가 실패 — 네트워크 또는 Vercel 함수 환경 이슈',
      elapsedMs: Date.now() - t0,
    });
  }

  const body = await res.text();
  const elapsedMs = Date.now() - t0;

  let parsed: unknown = null;
  let keywordCount = 0;
  let sample: Array<{ keyword: string; pc: number; mo: number }> = [];
  try {
    parsed = JSON.parse(body);
    const list = (parsed as { keywordList?: Array<{ relKeyword: string; monthlyPcQcCnt: number; monthlyMobileQcCnt: number }> }).keywordList ?? [];
    keywordCount = list.length;
    sample = list.slice(0, 3).map(k => ({ keyword: k.relKeyword, pc: k.monthlyPcQcCnt, mo: k.monthlyMobileQcCnt }));
  } catch {
    // body가 JSON이 아니면 그대로 두고 status로 판단
  }

  let diagnosis = '';
  if (res.status === 200 && keywordCount > 0) {
    diagnosis = '✅ Vercel에서도 API 정상 작동 — unavailable 원인은 다른 곳(generate-qa의 marketCandidates 매칭 실패 가능)';
  } else if (res.status === 401) {
    diagnosis = '❌ 401 인증 실패 — Vercel env의 SECRET_KEY 인코딩 문제(base64 prefix 누락) 또는 LICENSE/CUSTOMER 불일치';
  } else if (res.status === 403) {
    diagnosis = '❌ 403 접근 금지 — Vercel 서버 IP가 차단됐거나 계정 권한 문제';
  } else if (res.status === 429) {
    diagnosis = '❌ 429 쿼터 초과 — 일일/시간당 한도 도달';
  } else if (res.status >= 500) {
    diagnosis = '❌ 5xx 네이버 측 일시 장애';
  } else if (res.status === 200 && keywordCount === 0) {
    diagnosis = '⚠️ 200 OK이지만 keywordList가 비어있음 — 키워드 정규화 또는 hint 매칭 문제';
  } else {
    diagnosis = `❌ status=${res.status} — body 확인 필요`;
  }

  return NextResponse.json({
    envCheck,
    httpStatus: res.status,
    httpStatusText: res.statusText,
    keyword,
    elapsedMs,
    keywordCount,
    sample,
    bodyHead: body.slice(0, 600),
    diagnosis,
  });
}
