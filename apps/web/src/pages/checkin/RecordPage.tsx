import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { CheckInApi } from '@stillalive/api';
import PageHeader from '@/components/PageHeader';
import ThemeToggle from '@/components/ThemeToggle';

const MOODS = ['😊 开心', '😌 平静', '😔 低落', '😴 疲惫', '😡 烦躁', '🥲 感动'];

export default function RecordPage() {
  const { api } = useAuth();
  const checkinApi = useMemo(() => new CheckInApi(api), [api]);
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('');
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const dateStr = `${today.getFullYear()}·${String(today.getMonth() + 1).padStart(2, '0')}·${String(today.getDate()).padStart(2, '0')}`;

  const save = async (skip?: boolean) => {
    setSaving(true);
    const data = skip ? {} : { content: content || undefined, moodTag: mood || undefined };
    const res = await checkinApi.checkIn(data);
    setSaving(false);
    if (res.success) navigate('/checkin/milestone');
  };

  return (
    <div className="min-h-screen bg-sa-bg transition-colors duration-500">
      <div className="max-w-[430px] mx-auto min-h-screen flex flex-col px-7">
        <PageHeader title="RECORD" back="/checkin" right={<ThemeToggle />} />

        <div className="pt-12 pb-6">
          <h1 className="font-display italic text-[42px] leading-none animate-fade-up">
            Today
            <span className="block font-body not-italic font-bold text-[28px] mt-1">今天有意义的事</span>
          </h1>
          <p className="font-display italic text-sm text-sa-ink-soft mt-4 leading-relaxed animate-fade-up" style={{ animationDelay: '0.1s' }}>
            {dateStr} · A small gift to your future self.
            <br />—— 也可以什么都不写。
          </p>
        </div>

        <section className="animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <div className="section-title mb-3">PHOTO · 今天的一张</div>
          <div className="aspect-[4/3] border border-dashed border-sa-line flex flex-col items-center justify-center gap-2 text-sa-ink-faint hover:border-sa-life hover:text-sa-life transition-colors cursor-pointer">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>
            <span className="font-display italic text-xs">upload one frame of today</span>
          </div>
        </section>

        <section className="mt-8 animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <div className="section-title mb-3 flex justify-between"><span>WORDS · 文字记录</span><span>{content.length} / 500</span></div>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={8} maxLength={500}
            placeholder="什么让你觉得今天和昨天不一样？..."
            className="w-full bg-transparent outline-none text-[17px] font-display italic leading-[1.85] resize-none border-b border-sa-line pb-4 placeholder:text-sa-ink-faint" />
        </section>

        <section className="mt-8 animate-fade-up" style={{ animationDelay: '0.4s' }}>
          <div className="section-title mb-3">MOOD · 心情（可选）</div>
          <div className="flex flex-wrap gap-2">
            {MOODS.map(m => (
              <button key={m} type="button" onClick={() => setMood(mood === m ? '' : m)}
                className={`px-3.5 py-2 font-mono text-[10px] tracking-wider uppercase border transition-colors ${mood === m ? 'bg-sa-life text-sa-bg border-sa-life' : 'border-sa-line text-sa-ink-soft hover:border-sa-life hover:text-sa-life'}`}>
                {m}
              </button>
            ))}
          </div>
        </section>

        <div className="flex gap-3 mt-auto pt-10 pb-8 border-t border-sa-line animate-fade-up" style={{ animationDelay: '0.5s' }}>
          <button onClick={() => save(true)} disabled={saving}
            className="flex-1 py-4 border border-sa-line font-display italic text-sm text-sa-ink-soft text-center">
            什么都不写 · Skip
          </button>
          <button onClick={() => save()} disabled={saving}
            className="flex-1 py-4 bg-sa-life text-sa-bg font-display italic text-sm text-center hover:opacity-90 transition-opacity">
            {saving ? '...' : 'Save · 保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
