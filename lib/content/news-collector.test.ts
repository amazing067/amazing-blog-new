import { describe, it, expect } from 'vitest';
import { dedupeArticles, hashArticle } from './news-collector';
import type { RSSItem } from './types';

const mk = (title: string, desc: string, source = 'A'): RSSItem => ({
  source, title, link: `https://x/${encodeURIComponent(title)}`,
  pubDate: '2026-05-02T09:00:00.000Z', description: desc,
});

describe('hashArticle', () => {
  it('stable hash', () => {
    expect(hashArticle('a','b')).toBe(hashArticle('a','b'));
    expect(hashArticle('a','b')).toMatch(/^[0-9a-f]{64}$/);
  });
  it('differs on content change', () => {
    expect(hashArticle('a','b')).not.toBe(hashArticle('a','c'));
  });
});

describe('dedupeArticles', () => {
  it('removes exact duplicates', () => {
    const items = [mk('t1','x'), mk('t1','x','B'), mk('t2','y')];
    expect(dedupeArticles(items, new Set())).toHaveLength(2);
  });
  it('removes already-seen', () => {
    const a = mk('seen','body');
    const seen = new Set([hashArticle(a.title, a.description.slice(0,200))]);
    const out = dedupeArticles([a, mk('new','body')], seen);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('new');
  });
  it('strips HTML in excerpt', () => {
    const out = dedupeArticles([mk('t','<p>본문 <b>강조</b> 끝</p>')], new Set());
    expect(out[0].excerpt).toBe('본문 강조 끝');
  });
});
