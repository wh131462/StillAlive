import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/context/theme';
import { CheckInApi, PersonApi, StoryApi } from '@stillalive/api';
import type { CheckInStats, Person, Story } from '@stillalive/types';

export default function HomePage() {
  const { user, api, logout } = useAuth();
  const { toggle, theme } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState<CheckInStats | null>(null);
  const [todayChecked, setTodayChecked] = useState(false);
  const [birthdays, setBirthdays] = useState<Person[]>([]);
  const [story, setStory] = useState<Story | null>(null);
  const [quickContent, setQuickContent] = useState('');

  const checkinApi = new CheckInApi(api);
  const personApi = new PersonApi(api);
  const storyApi = new StoryApi(api);

  useEffect(() => {
    checkinApi.stats().then(r => r.success && r.data && setStats(r.data));
    const today = new Date().toISOString().slice(0, 10);
    checkinApi.byDate(today).then(r => r.success && setTodayChecked(!!r.data));
    personApi.todayBirthdays().then(r => r.success && r.data && setBirthdays(r.data));
    storyApi.random().then(r => r.success && r.data && setStory(r.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQuickCheckin = async () => {
    const res = await checkinApi.checkIn(quickContent ? { content: quickContent } : undefined);
    if (res.success) {
      setTodayChecked(true);
      const stat = await checkinApi.stats();
      if (stat.success && stat.data) setStats(stat.data);
    }
  };

  const today = new Date();
  const dateStr = `${today.getFullYear()} · ${String(today.getMonth() + 1).padStart(2, '0').toUpperCase()} ${String(today.getDate()).padStart(2, '0')} · ${['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][today.getDay()]}`;

  return (
    <div className="min-h-screen bg-sa-bg pb-24 transition-colors duration-500">
      <div className="max-w-[430px] mx-auto px-7">

        <header className="flex justify-between items-start pt-8">
          <div className="font-mono text-[10px] tracking-[0.2em] text-sa-ink-faint uppercase leading-relaxed animate-fade-up">
            {dateStr}<br/>
            <span className="text-sa-life">Day {stats?.totalDays ?? 0}</span>
          </div>
          <button onClick={toggle} className="w-9 h-9 rounded-full border border-sa-line bg-sa-surface text-sm">
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
        </header>

        <div className="text-center pt-14 pb-8">
          <h1 className="font-body font-bold text-[48px] leading-tight tracking-wide animate-fade-up" style={{ animationDelay: '0.1s' }}>
            还<span className="text-sa-life">活</span>着吗？
          </h1>
          <p className="font-display italic text-lg text-sa-ink-faint mt-3 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            Are you still alive?
          </p>

          <div className="flex flex-col items-center mt-10 animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <span className="font-display text-[96px] leading-none tracking-tighter animate-drift">{stats?.consecutiveDays ?? 0}</span>
            <span className="font-mono text-[10px] tracking-[0.3em] text-sa-ink-faint uppercase mt-2">consecutive days · 连续打卡</span>
          </div>
        </div>

        <svg className="w-full h-10 my-8 opacity-40 animate-fade-up" style={{ animationDelay: '0.3s' }} viewBox="0 0 600 40" preserveAspectRatio="none">
          <path d="M0 20 L100 20 L120 20 L130 5 L140 35 L150 2 L160 38 L170 20 L300 20 L320 20 L330 5 L340 35 L350 2 L360 38 L370 20 L600 20"
            stroke="var(--life)" strokeWidth="1.5" fill="none" />
        </svg>

        <button onClick={todayChecked ? () => navigate('/checkin/record') : handleQuickCheckin}
          className="w-full py-5 bg-sa-life text-sa-bg font-display italic text-lg tracking-wider animate-breathe-glow animate-fade-up"
          style={{ animationDelay: '0.4s' }}>
          {todayChecked ? '已打卡 · 继续记录' : 'Confirm · 确认存活，记下今天'}
        </button>

        {birthdays.length > 0 && (
          <section className="mt-14 animate-fade-up" style={{ animationDelay: '0.5s' }}>
            <div className="font-mono text-[10px] tracking-[0.2em] text-sa-ink-faint uppercase mb-4">TODAY · 今日提醒</div>
            {birthdays.map(person => (
              <Link key={person.id} to={`/people/${person.id}`} className="block border border-sa-line p-5 flex items-center gap-4 hover:border-sa-life transition-colors">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-sa-bg font-bold text-lg flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${person.themeColor}, var(--life))` }}>
                  {person.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm">今天是<span className="text-sa-life">「{person.name}」</span>的生日</div>
                  {person.birthday && <div className="text-xs text-sa-ink-soft mt-0.5 font-mono">{person.birthday}</div>}
                </div>
                <span className="text-sa-ink-faint">→</span>
              </Link>
            ))}
          </section>
        )}

        {!todayChecked && (
          <section className="mt-14 animate-fade-up" style={{ animationDelay: '0.5s' }}>
            <div className="font-mono text-[10px] tracking-[0.2em] text-sa-ink-faint uppercase mb-4 flex justify-between">
              <span>RECORD · 今天有意义的事</span>
              <span>{quickContent.length} / 200</span>
            </div>
            <div className="border border-sa-line p-5">
              <textarea value={quickContent} onChange={e => setQuickContent(e.target.value)}
                rows={3} maxLength={200}
                placeholder="What made today meaningful?  今天让你心头一动的瞬间..."
                className="w-full bg-transparent outline-none text-sm leading-relaxed resize-none placeholder:text-sa-ink-faint placeholder:font-display placeholder:italic" />
            </div>
          </section>
        )}

        {story && (
          <section className="mt-14 animate-fade-up" style={{ animationDelay: '0.6s' }}>
            <div className="font-mono text-[10px] tracking-[0.2em] text-sa-ink-faint uppercase mb-4 flex justify-between">
              <span>VOICES · 来自仍在的人</span>
              <Link to="/stories" className="text-sa-life">MORE →</Link>
            </div>
            <Link to={`/stories/${story.id}`} className="block border border-sa-line p-7 hover:border-sa-life transition-colors">
              <div className="font-mono text-[10px] tracking-[0.15em] text-sa-ink-faint uppercase mb-3">
                {story.approximateDate || ''} {story.category && `· ${story.category}`}
              </div>
              <p className="font-display italic text-[15px] leading-[1.85] line-clamp-3">
                {story.content}
              </p>
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-dashed border-sa-line">
                <span className="font-mono text-[11px] text-sa-ink-faint tracking-wider flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--life)" strokeWidth="2"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>
                  {story.resonanceCount}
                </span>
                <span className="font-mono text-[11px] text-sa-life tracking-wider uppercase">READ →</span>
              </div>
            </Link>
          </section>
        )}

        <div className="mt-16 text-center pb-4">
          <button onClick={logout} className="font-mono text-[10px] tracking-[0.15em] text-sa-ink-faint uppercase hover:text-sa-life">
            退出登录 · {user?.nickname || user?.phone || user?.email}
          </button>
        </div>
      </div>

      <BottomTabs active="home" />
    </div>
  );
}

function BottomTabs({ active }: { active: string }) {
  const tabs = [
    { id: 'home', name: '主页', href: '/', d: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10' },
    { id: 'checkin', name: '打卡', href: '/checkin', d: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4M9 15l2 2 4-4' },
    { id: 'person', name: '人物', href: '/people', d: 'M12 8a4 4 0 100-8 4 4 0 000 8zM4 21c1-4 4-6 8-6s7 2 8 6' },
    { id: 'profile', name: '我的', href: '/profile', d: 'M12 21a9 9 0 110-18 9 9 0 010 18zM12 13a3 3 0 100-6 3 3 0 000 6zM6 19c1-3 3-4 6-4s5 1 6 4' },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto h-[72px] flex justify-around items-center bg-sa-surface border-t border-sa-line backdrop-blur">
      {tabs.map(t => (
        <Link key={t.id} to={t.href} className={`flex flex-col items-center gap-1 text-[11px] tracking-wider ${active === t.id ? 'text-sa-life' : 'text-sa-ink-faint'}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active === t.id ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d={t.d} />
          </svg>
          <span>{t.name}</span>
        </Link>
      ))}
    </nav>
  );
}
