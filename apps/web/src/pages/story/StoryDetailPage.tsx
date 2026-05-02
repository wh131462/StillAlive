import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { StoryApi } from '@stillalive/api';
import type { Story } from '@stillalive/types';
import ThemeToggle from '@/components/ThemeToggle';

const HELPLINE = '如果你正在经历类似的时刻，请联系：北京心理危机研究与干预中心 010-82951332 · 全国心理援助热线 400-161-9995 · 生命热线 400-821-1215';

export default function StoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { api, user } = useAuth();
  const storyApi = useMemo(() => new StoryApi(api), [api]);
  const [story, setStory] = useState<Story | null>(null);
  const [resonated, setResonated] = useState(false);
  const [resonanceCount, setResonanceCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    storyApi.detail(id).then(r => {
      if (r.success && r.data) {
        setStory(r.data);
        setResonanceCount(r.data.resonanceCount);
      }
    });
  }, [id, storyApi]);

  const handleResonate = async () => {
    if (!id || resonated) return;
    const deviceId = localStorage.getItem('sa-device-id') || `dev-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('sa-device-id', deviceId);
    const res = await storyApi.resonate({ storyId: id, deviceId: user ? undefined : deviceId });
    if (res.success && res.data) {
      const data = res.data as unknown as { resonanceCount: number; alreadyResonated: boolean };
      setResonanceCount(data.resonanceCount);
      setResonated(true);
    }
  };

  if (!story) return <div className="min-h-screen bg-sa-bg flex items-center justify-center"><div className="animate-breathe w-6 h-6 rounded-full bg-sa-life" /></div>;

  const paragraphs = story.content.split('\n').filter(Boolean);

  return (
    <div className="min-h-screen bg-sa-bg pb-32 transition-colors duration-500">
      <div className="max-w-[640px] mx-auto px-8">
        <header className="flex justify-between items-center pt-8 sticky top-0 z-10 bg-sa-bg/90 backdrop-blur pb-4">
          <Link to="/stories" className="text-sa-ink-faint text-sm hover:text-sa-life">← Back</Link>
          <div className="flex gap-2">
            <button className="w-9 h-9 rounded-full border border-sa-line bg-sa-surface flex items-center justify-center text-sa-ink-soft">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
            </button>
            <ThemeToggle />
          </div>
        </header>

        <div className="font-mono text-[10px] tracking-[0.2em] text-sa-ink-faint uppercase mt-16 animate-fade-up">
          {story.approximateDate || ''} {story.category && `· ${story.category.toUpperCase()}`}
        </div>

        <article className="mt-10 font-body text-[20px] leading-[2.1] tracking-wide space-y-8">
          {paragraphs.map((p, i) => (
            <p key={i} className={`animate-fade-up ${i === 0 ? 'first-letter:font-display first-letter:text-[64px] first-letter:float-left first-letter:leading-[0.85] first-letter:mr-2 first-letter:mt-1.5 first-letter:text-sa-life first-letter:font-bold' : ''}`}
              style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
              {p}
            </p>
          ))}
        </article>

        <div className="text-center mt-20 animate-fade-up" style={{ animationDelay: '0.5s' }}>
          <button onClick={handleResonate}
            className={`w-20 h-20 rounded-full border mx-auto flex items-center justify-center transition-all ${resonated ? 'bg-sa-life-soft border-sa-life' : 'border-sa-line hover:border-sa-life animate-breathe'}`}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--life)" strokeWidth="2"><path d="M3 12h4l3-9 4 18 3-9h4" /></svg>
          </button>
          <div className="font-mono text-[11px] text-sa-ink-faint tracking-wider mt-4">感同身受</div>
          <div className="font-display italic text-[28px] text-sa-life mt-2">&hearts; {resonanceCount.toLocaleString()}</div>
        </div>

        <div className="flex gap-3 justify-center mt-8 animate-fade-up" style={{ animationDelay: '0.6s' }}>
          <button className="px-5 py-2.5 border border-sa-line text-sa-ink-soft font-mono text-[10px] tracking-wider uppercase flex items-center gap-2 hover:border-sa-life hover:text-sa-life transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
            COPY
          </button>
          <button className="px-5 py-2.5 border border-sa-line text-sa-ink-soft font-mono text-[10px] tracking-wider uppercase flex items-center gap-2 hover:border-sa-life hover:text-sa-life transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>
            SHARE
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-sa-surface/95 backdrop-blur border-t border-sa-line px-8 py-4 max-w-[640px] mx-auto">
        <p className="font-mono text-[10px] text-sa-ink-faint tracking-wider leading-relaxed">{HELPLINE}</p>
      </div>
    </div>
  );
}
