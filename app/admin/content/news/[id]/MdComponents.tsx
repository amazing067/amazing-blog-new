'use client';
import type { ComponentProps } from 'react';
import { Check } from 'lucide-react';
import { CustomBlockquote } from './Callouts';

// 카카오페이 머니콘텐츠 톤의 마크다운 컴포넌트 모음.

export const mdComponents = {
  // 큰 H2 — 좌측 컬러 액센트 바 + 큰 폰트
  h2: ({ children, ...props }: ComponentProps<'h2'>) => (
    <h2
      {...props}
      className="mt-12 mb-4 pb-3 border-b-2 border-emerald-100 text-[22px] font-extrabold text-slate-900 leading-snug"
    >
      <span className="inline-block w-1 h-5 bg-emerald-500 rounded-full mr-2.5 align-middle" />
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: ComponentProps<'h3'>) => (
    <h3 {...props} className="mt-8 mb-3 text-lg font-bold text-slate-800">
      {children}
    </h3>
  ),

  // 단락 — 카카오페이처럼 줄간격 1.85, 글자 굵기 약간 두텁게
  p: ({ children, ...props }: ComponentProps<'p'>) => (
    <p {...props} className="my-4 text-[16px] leading-[1.85] text-slate-700">
      {children}
    </p>
  ),

  // 굵게 — 핵심 단어에 자동 형광펜 효과 (배경 노랑, 색상 진한 텍스트)
  strong: ({ children, ...props }: ComponentProps<'strong'>) => (
    <strong
      {...props}
      className="font-bold text-slate-900 bg-yellow-100/70 px-1 py-0.5 rounded-md"
    >
      {children}
    </strong>
  ),

  // 밑줄 (mark·u 태그 둘 다 지원)
  mark: ({ children, ...props }: ComponentProps<'mark'>) => (
    <mark {...props} className="bg-amber-200/80 px-1 py-0.5 rounded-md text-slate-900 font-medium">
      {children}
    </mark>
  ),
  u: ({ children, ...props }: ComponentProps<'u'>) => (
    <u {...props} className="decoration-emerald-400 decoration-2 underline-offset-4">
      {children}
    </u>
  ),

  // 링크 — 초록 + 호버 밑줄
  a: ({ children, ...props }: ComponentProps<'a'>) => (
    <a {...props} target="_blank" rel="noopener noreferrer"
       className="text-emerald-700 font-medium underline-offset-2 hover:underline">
      {children}
    </a>
  ),

  // 표 — 카드형 + 헤더 배경 + 줄무늬 + 라운드
  table: ({ children, ...props }: ComponentProps<'table'>) => (
    <div className="my-6 overflow-x-auto rounded-2xl ring-1 ring-slate-200">
      <table {...props} className="w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: ComponentProps<'thead'>) => (
    <thead {...props} className="bg-slate-50">{children}</thead>
  ),
  tr: ({ children, ...props }: ComponentProps<'tr'>) => (
    <tr {...props} className="border-b border-slate-100 last:border-0 even:bg-slate-50/50">
      {children}
    </tr>
  ),
  th: ({ children, ...props }: ComponentProps<'th'>) => (
    <th {...props} className="px-4 py-3 text-left font-semibold text-slate-700 text-[13px]">
      {children}
    </th>
  ),
  td: ({ children, ...props }: ComponentProps<'td'>) => (
    <td {...props} className="px-4 py-3 text-slate-700 align-top">
      {children}
    </td>
  ),

  // ul/li — 체크 아이콘 + 간격
  ul: ({ children, ...props }: ComponentProps<'ul'>) => (
    <ul {...props} className="my-4 space-y-2 list-none pl-0">
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: ComponentProps<'ol'>) => (
    <ol {...props} className="my-4 space-y-2 list-decimal pl-6 marker:text-emerald-600 marker:font-bold">
      {children}
    </ol>
  ),
  li: ({ children, ...props }: ComponentProps<'li'> & { ordered?: boolean }) => {
    // ordered list 안의 li는 기본 마커 사용, ul 안의 li는 체크 아이콘
    const isOrdered = (props as { ordered?: boolean }).ordered === true;
    if (isOrdered) {
      return <li {...props} className="pl-1 leading-7 text-slate-700">{children}</li>;
    }
    return (
      <li {...props} className="flex gap-2.5 items-start leading-7 text-slate-700">
        <Check className="w-4 h-4 text-emerald-600 mt-1.5 shrink-0" strokeWidth={3} />
        <span className="flex-1">{children}</span>
      </li>
    );
  },

  // 구분선
  hr: () => <hr className="my-10 border-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />,

  // 인라인 코드 — 핵심 키워드 강조용
  code: ({ children, ...props }: ComponentProps<'code'>) => (
    <code {...props} className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[14px] font-mono">
      {children}
    </code>
  ),

  // blockquote — 콜아웃 자동 매칭
  blockquote: CustomBlockquote,
};
