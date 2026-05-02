import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { PersonApi } from '@stillalive/api';
import type { Person, ImportantDate, SharedMemory } from '@stillalive/types';
import ThemeToggle from '@/components/ThemeToggle';

interface PersonDetail extends Person {
  importantDates?: ImportantDate[];
  sharedMemories?: SharedMemory[];
}

export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { api } = useAuth();
  const personApi = useMemo(() => new PersonApi(api), [api]);
  const [person, setPerson] = useState<PersonDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    personApi.detail(id).then(r => r.success && r.data && setPerson(r.data as PersonDetail));
  }, [id, personApi]);

  if (!person) return <div className="min-h-screen bg-sa-bg flex items-center justify-center"><div className="animate-breathe w-6 h-6 rounded-full bg-sa-life" /></div>;

  const themeBg = `linear-gradient(135deg, ${person.themeColor}, ${darken(person.themeColor)})`;

  return (
    <div className="min-h-screen bg-sa-bg pb-10 transition-colors duration-500">
      <div className="max-w-[430px] mx-auto">

        <div className="relative px-7 pt-8 pb-20" style={{ background: themeBg }}>
          <div className="absolute top-[-80px] right-[-60px] w-[200px] h-[200px] rounded-full bg-white/10" />
          <div className="flex justify-between items-center relative z-10">
            <Link to="/people" className="text-white/70 text-sm hover:text-white">← Back</Link>
            <div className="flex gap-2">
              <button className="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>

        <div className="flex justify-center -mt-12 relative z-10">
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-sa-bg font-bold text-4xl border-4 border-sa-bg animate-breathe"
            style={{ background: themeBg }}>
            {person.name.charAt(0)}
          </div>
        </div>

        <div className="px-7">
          <div className="text-center mt-5 animate-fade-up">
            <h1 className="font-body font-bold text-[28px]">{person.name}</h1>
            <div className="flex gap-2 justify-center mt-2 font-mono text-[10px] tracking-wider uppercase">
              <span className="px-2.5 py-1 border border-sa-life text-sa-life">FAMILY</span>
              {person.gender && <span className="px-2.5 py-1 border border-sa-line text-sa-ink-soft">{person.gender.toUpperCase()}{person.mbti && ` · ${person.mbti}`}</span>}
            </div>
          </div>

          <section className="mt-10 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <div className="section-title mb-4">Info · 基本信息</div>
            <div className="border-t border-sa-line">
              <Row label="Birthday">{person.birthday || '—'}</Row>
              {person.mbti && <Row label="MBTI"><span className="font-mono px-2.5 py-1 bg-sa-life-soft text-sa-life tracking-[0.15em] text-xs">{person.mbti}</span></Row>}
              <Row label="Theme">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full" style={{ background: person.themeColor }} />
                  <span className="font-mono text-xs">{person.themeColor}</span>
                </div>
              </Row>
            </div>
          </section>

          {person.impression && (
            <section className="mt-10 animate-fade-up" style={{ animationDelay: '0.2s' }}>
              <div className="section-title mb-4">Impression · 个人印象</div>
              <div className="border-l-2 border-sa-life pl-5 py-4 font-display italic text-base leading-[1.9]">
                {person.impression}
              </div>
            </section>
          )}

          {person.sharedMemories && person.sharedMemories.length > 0 && (
            <section className="mt-10 animate-fade-up" style={{ animationDelay: '0.3s' }}>
              <div className="flex justify-between items-center mb-4">
                <span className="section-title">Memories · 共同经历</span>
                <button className="font-mono text-[10px] text-sa-life tracking-wider">+ ADD</button>
              </div>
              {person.sharedMemories.map((m, i) => (
                <div key={m.id} className="border-l-2 pl-5 py-5" style={{ borderColor: i % 2 === 0 ? 'var(--life)' : 'var(--green)' }}>
                  <div className="font-mono text-[10px] tracking-wider text-sa-ink-faint uppercase mb-2">{m.date || '—'}</div>
                  <div className="font-display italic text-[15px] leading-[1.85]">{m.content}</div>
                </div>
              ))}
            </section>
          )}

          {person.importantDates && person.importantDates.length > 0 && (
            <section className="mt-10 animate-fade-up" style={{ animationDelay: '0.4s' }}>
              <div className="flex justify-between items-center mb-4">
                <span className="section-title">Dates · 重要日期</span>
                <button className="font-mono text-[10px] text-sa-life tracking-wider">+ ADD</button>
              </div>
              {person.importantDates.map(d => (
                <div key={d.id} className="flex items-center gap-3 py-4 border-b border-sa-line">
                  <div className="w-9 h-9 bg-sa-life-soft text-sa-life flex items-center justify-center flex-shrink-0">📅</div>
                  <div className="flex-1">
                    <div className="text-sm">{d.label}</div>
                    <div className="font-mono text-[11px] text-sa-ink-faint tracking-wider mt-0.5">{d.date}{d.isLunar ? ' (农历)' : ''}</div>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-4 border-b border-sa-line text-sm">
      <span className="text-sa-ink-soft font-mono text-[11px] tracking-wider uppercase">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

function darken(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = Math.max(0, parseInt(m[1]!, 16) - 30);
  const g = Math.max(0, parseInt(m[2]!, 16) - 30);
  const b = Math.max(0, parseInt(m[3]!, 16) - 30);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
