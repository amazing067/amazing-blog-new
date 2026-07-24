'use client';

import { useEffect, useState } from 'react';

// blog.어메이징사업부.com 방문자 안내 페이지.
// 서비스가 어메이징사업부 통합 사이트로 이전되었음을 알리고, 그쪽으로 유도한다.
const GO = 'https://xn--h32b21du9cf7grcy2k20f.com'; // = https://어메이징사업부.com
const GO_LABEL = '어메이징사업부.com';
const COUNTDOWN = 6; // 초 후 자동 이동

export default function SiteClosedPage() {
  const [left, setLeft] = useState(COUNTDOWN);

  useEffect(() => {
    if (left <= 0) {
      window.location.href = GO;
      return;
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b1220] text-white">
      {/* 배경 장식 */}
      <div className="pointer-events-none absolute -top-40 -right-32 h-[36rem] w-[36rem] rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -left-32 h-[36rem] w-[36rem] rounded-full bg-sky-500/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-white/70">
          AMAZING · 어메이징사업부
        </div>

        <h1 className="text-3xl font-black leading-tight sm:text-4xl">
          서비스가 하나로 합쳐졌어요
        </h1>

        <p className="mt-5 text-base leading-relaxed text-white/70">
          그동안 이용해 주신 <span className="font-semibold text-white">블로그 서비스</span>는
          <br className="hidden sm:block" />
          이제 <span className="font-semibold text-sky-300">어메이징사업부 통합 사이트</span>로 이전되었습니다.
          <br />
          아래 버튼으로 새 사이트에서 계속 이용해 주세요.
        </p>

        <a
          href={GO}
          className="group mt-9 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-indigo-900/40 transition-transform hover:scale-[1.03]"
        >
          {GO_LABEL} 바로가기
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </a>

        <p className="mt-6 text-sm text-white/45">
          {left > 0 ? (
            <>
              <span className="tabular-nums font-semibold text-white/70">{left}초</span> 후
              자동으로 이동합니다.
            </>
          ) : (
            <>이동 중…</>
          )}
        </p>

        <p className="mt-10 text-xs text-white/30">
          문의는 어메이징사업부 통합 사이트에서 도와드리겠습니다.
        </p>
      </div>
    </main>
  );
}
