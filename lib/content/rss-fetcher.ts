import { XMLParser } from 'fast-xml-parser';
import type { RSSItem } from './types';

const parser = new XMLParser({
  ignoreAttributes: true,
  cdataPropName: '__cdata',
  parseTagValue: true,
});

function pickText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (typeof o.__cdata === 'string') return o.__cdata;
    if (typeof o['#text'] === 'string') return o['#text'] as string;
  }
  return String(node);
}

export function parseRSSXml(xml: string, sourceName: string): RSSItem[] {
  let parsed: unknown;
  try { parsed = parser.parse(xml); } catch { return []; }
  const channel = (parsed as any)?.rss?.channel;
  if (!channel) return [];
  const raw = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];
  return raw.map((it: any): RSSItem => ({
    source: sourceName,
    title: pickText(it.title).trim(),
    link: pickText(it.link).trim(),
    pubDate: new Date(pickText(it.pubDate)).toISOString(),
    description: pickText(it.description),
  })).filter((it: RSSItem) => it.title && it.link);
}

export async function fetchRSS(url: string, sourceName: string): Promise<RSSItem[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'amazing-biz-blog/1.0 (content-hub)' },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.warn(`[rss-fetcher] ${sourceName} ${url} → HTTP ${res.status}`);
    return [];
  }
  return parseRSSXml(await res.text(), sourceName);
}
