import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { StoryApi } from '@stillalive/api';
import type { Story, StoryCategory } from '@stillalive/types';
import ThemeToggle from '@/components/ThemeToggle';

const CATEGORIES: Array<{ value: StoryCategory | 'all'; label: string }> = [
  { value: 'all', label: 'ALL · 全部' },
  { value: 'accident', label: 'ACCIDENT · 意外' },
  { value: 'illness', label: 'ILLNESS · 疾病' },
  { value: 'mental', label: 'MENTAL · 心理' },
  { value: 'nature', label: 'NATURE · 自然' },
  { value: 'other', label: 'OTHER · 其他' },
];

export default function StoryListPage() {
  const { api, user } = useAuth();
  const storyApi = useMemo(() => new StoryApi(api), [api]);
  const [stories, setStories] = useState<Story[]>([]);
  const [category, setCategory] = useState<StoryCategory | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    storyApi.list(category === 'all' ? undefined : { category }).then(r => {
      if (r.success && r.data) {
        const data = r.data as unknown as { items: Story[]; nextCursor: string | null };
        setStories(data.items || []);
      }
      setLoading(false);
    });
  }, [category, storyApi]);

  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

  return (
    <div className="min-h-screen bg-sa-bg pb-20 transition-colors duration-500">
      {/* Desktop nav */}
      <nav className="border-b border-sa-line sticky top-0 z-50 bg-sa-bg/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-sa-life flex items-center justify-center animate-breathe">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="2"><path d="M3 12h4l3-9 4 18 3-9h4" /></svg>
            </div>
            <span className="font-display italic text-lg">Still Alive</span>
          </Link>
          <div className="flex items-center gap-4 lg:gap-8 font-mono text-[11px] tracking-wider uppercase">
            <span className="text-sa-life">Stories</span>
            <Link to="/stories/submit" className="text-sa-ink-faint hover:text-sa-life">Submit</Link>
            <ThemeToggle />
            {user ? (
              <Link to="/" className="px-4 py-2 bg-sa-ink text-sa-bg font-display italic text-xs">主页</Link>
            ) : (
              <Link to="/login" className="px-4 py-2 bg-sa-ink text-sa-bg font-display italic text-xs">Log in</Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 lg:px-12 pt-16 pb-12 text-center">
        <h1 className="font-display italic text-[clamp(48px,6vw,80px)] leading-none animate-fade-up">
          Voices
          <span className="block font-body not-italic font-bold text-[clamp(32px,4vw,48px)] mt-2">来自仍在的人</span>
        </h1>
        <p className="font-display italic text-base text-sa-ink-soft max-w-md mx-auto mt-6 leading-relaxed animate-fade-up" style={{ animationDelay: '0.1s' }}>
          每一则故事都是一个"仍在"的证明。<br />
          这里收录"差点就没了，但我现在还活着"的瞬间。
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-6 lg:px-12 flex gap-14 pb-20">
        <aside className="w-52 flex-shrink-0 hidden lg:block sticky top-24 self-start">
          <div className="font-mono text-[10px] tracking-[0.2em] text-sa-ink-faint uppercase mb-3">Category · 分类</div>
          {CATEGORIES.map(c => (
            <button key={c.value} onClick={() => setCategory(c.value)}
              className={`block w-full text-left px-3 py-2.5 text-[13px] border-b border-dashed border-sa-line transition-all ${category === c.value ? 'text-sa-life pl-4' : 'text-sa-ink-faint hover:text-sa-life hover:pl-4'}`}>
              {c.label}
            </button>
          ))}
        </aside>

        <div className="flex-1">
          {/* Mobile category filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden mb-4">
            {CATEGORIES.map(c => (
              <button key={c.value} onClick={() => setCategory(c.value)}
                className={`flex-shrink-0 px-3.5 py-2 font-mono text-[10px] tracking-wider uppercase border ${category === c.value ? 'bg-sa-ink text-sa-bg border-sa-ink' : 'border-sa-line text-sa-ink-faint'}`}>
                {c.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-32 text-center font-mono text-xs text-sa-ink-faint tracking-wider animate-breathe">LOADING...</div>
          ) : stories.length === 0 ? (
            <div className="py-32 text-center font-display italic text-sa-ink-faint">— 暂无故事 —</div>
          ) : (
            stories.map((s, i) => (
              <Link key={s.id} to={`/stories/${s.id}`}
                className="block py-8 border-t border-sa-line hover:pl-3 transition-all group animate-fade-up"
                style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="font-mono text-[10px] tracking-[0.15em] text-sa-ink-faint uppercase mb-3 flex gap-3 items-center">
                  {s.category && <span className="px-2 py-0.5 border border-sa-life text-sa-life">{s.category}</span>}
                  <span>{s.approximateDate}</span>
                </div>
                {s.title && <h3 className="font-body font-bold text-lg mb-2">{s.title}</h3>}
                <p className="font-display italic text-base leading-[1.95] line-clamp-3">{s.content}</p>
                <div className="flex justify-between items-center mt-4">
                  <span className="font-mono text-[11px] text-sa-ink-faint tracking-wider flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--life)" strokeWidth="2"><path d="M3 12h4l3-9 4 18 3-9h4" /></svg>
                    {s.resonanceCount}
                  </span>
                  <span className="font-mono text-[11px] text-sa-life tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity">READ →</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <footer className="border-t border-sa-line">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-10 flex flex-col lg:flex-row items-start lg:items-end justify-between gap-4 font-mono text-[10px] tracking-wider text-sa-ink-faint uppercase">
          <div className="flex items-center gap-2 font-display italic normal-case text-sm text-sa-ink-soft">
            <div className="w-5 h-5 bg-sa-life flex items-center justify-center"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="2"><path d="M3 12h4l3-9 4 18 3-9h4" /></svg></div>
            Still Alive · 还活着
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-sa-life">About</a>
            <a href="#" className="hover:text-sa-life">Terms</a>
            <a href="#" className="hover:text-sa-life">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
