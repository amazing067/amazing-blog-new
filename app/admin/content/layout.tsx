import Link from 'next/link';
import { ChevronLeft, Newspaper } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/guard';

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-4">
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
            <ChevronLeft className="w-4 h-4" />
            어드민
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <div className="inline-flex items-center gap-2">
            <div className="rounded-lg bg-emerald-100 p-1.5">
              <Newspaper className="w-4 h-4 text-emerald-700" />
            </div>
            <h1 className="text-base font-semibold text-slate-900">Content Hub</h1>
          </div>
          <nav className="ml-auto flex gap-1 text-sm">
            <Link href="/admin/content/news" className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100">보험뉴스</Link>
            <Link href="/admin/content/cards" className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100">카드뉴스</Link>
            <Link href="/admin/content/billing" className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100">💰 비용</Link>
            <Link href="/admin/content/card-preview" className="rounded-lg px-3 py-1.5 text-slate-400 hover:bg-slate-100">시안</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
