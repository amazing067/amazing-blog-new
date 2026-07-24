import Link from 'next/link';
import { ServerCog, ArrowRight } from 'lucide-react';

// 콘텐츠 자동생성·카드뉴스 기능은 amazing-biz-server(설계사 서버)로 이전되었습니다.
// 중복 실행을 막기 위해 이 repo(블로그)에서는 비활성화하고 안내만 표시합니다.
// 되살리려면 이 컴포넌트를 걷어내고 git 히스토리에서 원래 페이지를 복원하면 됩니다.
export default function MovedNotice({
  title,
  where = 'amazing-biz-server (설계사 서버)',
}: {
  title: string;
  where?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-5 inline-flex rounded-2xl bg-slate-100 p-4">
          <ServerCog className="h-8 w-8 text-slate-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          이 기능은 <span className="font-semibold text-slate-800">{where}</span>로 이전되었습니다.
          <br />
          동일한 콘텐츠 생성·카드뉴스 배포가 그쪽에서 운영되고 있어,
          <br />
          중복 실행을 막기 위해 여기(블로그)에서는 <span className="font-semibold">중단</span>되었습니다.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          <Link
            href="/admin/content/recruit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-lime-600 px-4 py-2 font-medium text-white hover:bg-lime-700"
          >
            리쿠르팅으로 이동
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
          >
            어드민 홈
          </Link>
        </div>
      </div>
    </div>
  );
}
