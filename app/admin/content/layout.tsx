import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/guard';

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <Link href="/admin/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← 어드민</Link>
          <h1 className="text-lg font-semibold">Content Hub</h1>
          <nav className="ml-auto flex gap-4 text-sm">
            <Link href="/admin/content/news">보험뉴스</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
