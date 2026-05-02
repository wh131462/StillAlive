import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { PersonApi } from '@stillalive/api';
import type { Person, PersonGroup } from '@stillalive/types';
import BottomNav from '@/components/BottomNav';
import ThemeToggle from '@/components/ThemeToggle';

interface GroupWithCount extends PersonGroup {
  _count?: { persons: number };
}

export default function PersonListPage() {
  const { api } = useAuth();
  const personApi = useMemo(() => new PersonApi(api), [api]);
  const [people, setPeople] = useState<Person[]>([]);
  const [groups, setGroups] = useState<GroupWithCount[]>([]);
  const [birthdays, setBirthdays] = useState<Person[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    personApi.list().then(r => r.success && r.data && setPeople(r.data));
    personApi.groups().then(r => r.success && r.data && setGroups(r.data as GroupWithCount[]));
    personApi.todayBirthdays().then(r => r.success && r.data && setBirthdays(r.data));
  }, [personApi]);

  const filtered = people.filter(p => {
    if (activeGroup && p.groupId !== activeGroup) return false;
    if (search && !p.name.includes(search)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-sa-bg pb-24 transition-colors duration-500">
      <div className="max-w-[430px] mx-auto px-7">
        <header className="flex justify-between items-start pt-8">
          <div className="font-mono text-[10px] tracking-[0.2em] text-sa-ink-faint uppercase leading-relaxed animate-fade-up">
            PEOPLE · BONDS<br/>
            <span className="text-sa-life">{people.length} souls</span>
          </div>
          <div className="flex gap-2">
            <button className="w-9 h-9 rounded-full bg-sa-life text-sa-bg flex items-center justify-center hover:scale-105 transition-transform">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            <ThemeToggle />
          </div>
        </header>

        <h1 className="font-display italic text-[48px] leading-none mt-8 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          Bonds
          <span className="block font-body not-italic font-bold text-[32px] mt-1">人物</span>
        </h1>
        <p className="font-display italic text-sm text-sa-ink-soft mt-3 animate-fade-up" style={{ animationDelay: '0.15s' }}>— those who shape your aliveness</p>

        <div className="mt-8 flex items-center border-b border-sa-line pb-2 focus-within:border-sa-life transition-colors animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-sa-ink-faint mr-2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="search by name..." className="input-base flex-1" />
        </div>

        <div className="flex gap-2 overflow-x-auto pt-4 pb-1 animate-fade-up" style={{ animationDelay: '0.25s' }}>
          <button onClick={() => setActiveGroup(null)} className={`flex-shrink-0 px-4 py-2 font-mono text-[11px] tracking-wider uppercase border ${activeGroup === null ? 'bg-sa-ink text-sa-bg border-sa-ink' : 'border-sa-line text-sa-ink-faint'}`}>
            All · 全部 ({people.length})
          </button>
          {groups.map(g => (
            <button key={g.id} onClick={() => setActiveGroup(g.id)} className={`flex-shrink-0 px-4 py-2 font-mono text-[11px] tracking-wider uppercase border ${activeGroup === g.id ? 'bg-sa-ink text-sa-bg border-sa-ink' : 'border-sa-line text-sa-ink-faint'}`}>
              {g.name} ({g._count?.persons ?? 0})
            </button>
          ))}
        </div>

        {birthdays.length > 0 && (
          <section className="mt-6 animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <div className="border border-sa-line border-l-4 border-l-sa-life p-6 flex items-center gap-4 relative overflow-hidden">
              <span className="absolute -right-2 -top-2 text-[80px] opacity-10">🎂</span>
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-sa-bg font-bold text-xl flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${birthdays[0]?.themeColor}, var(--life))` }}>
                {birthdays[0]?.name.charAt(0)}
              </div>
              <div className="flex-1 relative z-10">
                <div className="font-mono text-[10px] text-sa-life tracking-[0.2em] uppercase">TODAY · 今日生日</div>
                <div className="font-bold text-base mt-1">{birthdays[0]?.name}</div>
                <div className="font-mono text-[11px] text-sa-ink-soft mt-0.5 tracking-wider uppercase">
                  {birthdays[0]?.mbti} · {birthdays[0]?.birthday}
                </div>
              </div>
              <Link to={`/people/${birthdays[0]?.id}`} className="px-3.5 py-2 bg-sa-life text-sa-bg font-display italic text-xs">Greet</Link>
            </div>
          </section>
        )}

        <section className="mt-8">
          <div className="section-title mb-3">All people · 全部 ({filtered.length})</div>
          {filtered.length > 0 ? (
            <div className="flex flex-col">
              {filtered.map(p => (
                <Link key={p.id} to={`/people/${p.id}`} className="py-5 border-t border-sa-line flex items-center gap-4 hover:pl-2 transition-all animate-fade-up">
                  <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-sa-bg font-bold text-[22px] flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${p.themeColor}, var(--life))` }}>
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[15px]">{p.name}</span>
                      {p.groupId && (
                        <span className="font-mono text-[9px] px-2 py-0.5 border border-sa-line text-sa-ink-soft tracking-wider uppercase">
                          {groups.find(g => g.id === p.groupId)?.name}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-sa-ink-faint tracking-wider mt-1 uppercase">
                      {p.mbti && `${p.mbti} · `}{p.birthday}
                    </div>
                  </div>
                  <span className="text-sa-ink-faint">→</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center font-display italic text-sm text-sa-ink-faint">
              — 还没有添加任何人物 —
            </div>
          )}
        </section>
      </div>
      <BottomNav active="person" />
    </div>
  );
}
