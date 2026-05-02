import { createHash } from 'node:crypto';
import { fetchRSS } from './rss-fetcher';
import type { CandidateArticle, RSSItem } from './types';

export function hashArticle(title: string, excerptOrDesc: string): string {
  const norm = (title.trim() + '|' + excerptOrDesc.trim().slice(0, 200)).replace(/\s+/g, ' ');
  return createHash('sha256').update(norm).digest('hex');
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export function dedupeArticles(items: RSSItem[], seenHashes: Set<string>): CandidateArticle[] {
  const out: CandidateArticle[] = [];
  const local = new Set<string>();
  for (const it of items) {
    const excerpt = stripHtml(it.description).slice(0, 200);
    const h = hashArticle(it.title, excerpt);
    if (seenHashes.has(h) || local.has(h)) continue;
    local.add(h);
    out.push({
      source: it.source, title: it.title, link: it.link,
      pubDate: it.pubDate, excerpt, contentHash: h,
    });
  }
  return out;
}

export type CollectorSource = { name: string; url: string };

export async function collectDailyNews(
  sources: CollectorSource[], recentHashes: Set<string>,
): Promise<CandidateArticle[]> {
  const lists = await Promise.all(
    sources.map(({ url, name }) =>
      fetchRSS(url, name).catch(err => {
        console.warn(`[news-collector] ${name} 실패`, err);
        return [];
      }),
    ),
  );
  const flat = lists.flat();
  const cutoff = Date.now() - 36 * 60 * 60 * 1000;
  const recent = flat.filter(it => new Date(it.pubDate).getTime() >= cutoff);
  return dedupeArticles(recent, recentHashes);
}

export function parseRssSourcesEnv(env: string | undefined): CollectorSource[] {
  if (!env) return [];
  return env.split(',').map(p => {
    const [name, url] = p.split('|').map(s => s.trim());
    return { name, url };
  }).filter(s => s.name && s.url);
}
