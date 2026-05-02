import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { CheckInApi } from '@stillalive/api';
import type { CheckIn, CheckInStats } from '@stillalive/types';
import BottomNav from '@/components/BottomNav';
import ThemeToggle from '@/components/ThemeToggle';

export default function CheckInPage() {
  const { api } = useAuth();
  const checkinApi = useMemo(() => new CheckInApi(api), [api]);
  const [stats, setStats] = useState<CheckInStats | null>(null);
  const [records, setRecords] = useState<CheckIn[]>([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  useEffect(() => {
    checkinApi.stats().then(r => r.success && r.data && setStats(r.data));
    checkinApi.list().then(r => r.success && r.data && setRecords(r.data));
  }, [checkinApi]);

  const checkedDates = useMemo(() => new Set(records.map(r => r.date)), [records]);
  const retroDates = useMemo(() => new Set(records.filter(r => r.isRetroactive).map(r => r.date)), [records]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const recent = records.slice(0, 5);

  const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][month.m];
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const firstDay = new Date(month.y, month.m, 1).getDay();

  const cells: Array<{ day: number | null; date: string; checked: boolean; retro: boolean; today: boolean; future: boolean }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, date: '', checked: false, retro: false, today: false, future: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month.y}-${String(month.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      day: d,
      date,
      checked: checkedDates.has(date),
      retro: retroDates.has(date),
      today: date === todayStr,
      future: date > todayStr,
    });
  }

  const moveMonth = (dir: number) => {
    setMonth(m => {
      let y = m.y, mo = m.m + dir;
      if (mo < 0) { mo = 11; y -= 1; }
      else if (mo > 11) { mo = 0; y += 1; }
      return { y, m: mo };
    });
  };

  return (
    <div className="min-h-screen bg-sa-bg pb-24 transition-colors duration-500">
      <div className="max-w-[430px] mx-auto px-7">
        <header className="flex justify-between items-start pt-8">
          <div className="font-mono text-[10px] tracking-[0.2em] text-sa-ink-faint uppercase leading-relaxed animate-fade-up">
            {month.y} · {monthName.slice(0, 3).toUpperCase()}<br/>
            <span className="text-sa-life">Days alive</span>
          </div>
          <ThemeToggle />
        </header>

        <h1 className="font-display italic text-[48px] leading-none mt-8 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          Days
          <span className="block font-body not-italic font-bold text-[32px] mt-1">打卡</span>
        </h1>

        <div className="grid grid-cols-3 mt-10 border-y border-sa-line animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <div className="py-6 text-center border-r border-sa-line">
            <div className="font-display text-4xl text-sa-life">{stats?.totalDays ?? 0}</div>
            <div className="font-mono text-[9px] tracking-[0.2em] text-sa-ink-faint uppercase mt-1.5">Total · 总天数</div>
          </div>
          <div className="py-6 text-center border-r border-sa-line">
            <div className="font-display text-4xl">{stats?.consecutiveDays ?? 0}</div>
            <div className="font-mono text-[9px] tracking-[0.2em] text-sa-ink-faint uppercase mt-1.5">Streak · 连续</div>
          </div>
          <div className="py-6 text-center">
            <div className="font-display text-4xl">{stats?.recordCount ?? 0}</div>
            <div className="font-mono text-[9px] tracking-[0.2em] text-sa-ink-faint uppercase mt-1.5">Records · 记录</div>
          </div>
        </div>

        <section className="mt-10 animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex justify-between items-center mb-4">
            <span className="section-title">Calendar · 月度</span>
            <div className="flex gap-2">
              <button onClick={() => moveMonth(-1)} className="text-sa-ink-faint hover:text-sa-life">‹</button>
              <button onClick={() => moveMonth(1)} className="text-sa-ink-faint hover:text-sa-life">›</button>
            </div>
          </div>
          <div className="border border-sa-line p-5">
            <div className="text-center font-display italic text-lg mb-4">{monthName} {month.y}</div>
            <div className="grid grid-cols-7 text-center font-mono text-[10px] text-sa-ink-faint mb-1">
              {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(w => <span key={w} className="py-2">{w}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((c, i) => (
                <div key={i} className={`aspect-square flex items-center justify-center text-[13px] font-mono rounded-full ${
                  c.day == null ? 'invisible' :
                  c.today ? 'ring-2 ring-sa-life text-sa-life font-bold' :
                  c.checked ? 'bg-sa-life text-sa-bg' :
                  c.retro ? 'border border-dashed border-sa-life text-sa-life' :
                  c.future ? 'opacity-30 text-sa-ink-faint' :
                  'text-sa-ink-faint'
                }`}>
                  {c.day}
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-4 pt-4 border-t border-dashed border-sa-line font-mono text-[10px] text-sa-ink-faint">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sa-life" />已打卡</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border border-dashed border-sa-life" />补签</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full ring-2 ring-sa-life" />今天</span>
            </div>
          </div>
        </section>

        <section className="mt-10 animate-fade-up" style={{ animationDelay: '0.4s' }}>
          <div className="flex justify-between items-center mb-4">
            <span className="section-title">Recent · 近期记录</span>
            <Link to="/checkin/record" className="font-mono text-[10px] tracking-wider text-sa-life uppercase">RECORD →</Link>
          </div>
          <div>
            {recent.map(r => (
              <div key={r.id} className="py-6 border-t border-sa-line">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="font-mono text-[11px] tracking-wider text-sa-ink-faint uppercase">{r.date.slice(5).replace('-', ' / ')}</span>
                  <span className="font-mono text-[10px] px-2 py-0.5 bg-sa-life-soft text-sa-life tracking-wider uppercase">{r.isRetroactive ? 'RETRO' : 'CHECKED'}</span>
                </div>
                {r.content ? (
                  <p className="font-display italic text-[15px] leading-[1.85]">{r.content}</p>
                ) : (
                  <p className="font-display italic text-sa-ink-faint text-sm">— 纯粹打卡，没有记录 —</p>
                )}
                {r.moodTag && <span className="inline-block mt-3 font-mono text-[10px] px-2 py-1 bg-sa-bg-subtle text-sa-ink-soft tracking-wider uppercase">{r.moodTag}</span>}
              </div>
            ))}
            {recent.length === 0 && <p className="py-12 text-center text-sm text-sa-ink-faint font-display italic">— 还没有任何记录 —</p>}
          </div>
        </section>

        <section className="mt-10 mb-10 animate-fade-up" style={{ animationDelay: '0.5s' }}>
          <div className="border border-dashed border-sa-line p-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-sa-life-soft flex items-center justify-center text-sa-life flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 12a9 9 0 109-9 9 9 0 00-7 4M3 4v4h4M12 7v5l3 2"/></svg>
            </div>
            <div className="flex-1">
              <div className="text-sm">Retroactive · 补签</div>
              <div className="font-mono text-[10px] tracking-wider text-sa-ink-faint uppercase mt-1">7 DAYS WINDOW · 3 PER MONTH</div>
            </div>
            <span className="text-sa-ink-faint">→</span>
          </div>
        </section>
      </div>
      <BottomNav active="checkin" />
    </div>
  );
}
