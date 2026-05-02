import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { CheckInApi } from '@stillalive/api';
import type { CheckInStats } from '@stillalive/types';
import { MILESTONE_DAYS } from '@stillalive/core';
import BottomNav from '@/components/BottomNav';
import ThemeToggle from '@/components/ThemeToggle';

export default function ProfilePage() {
  const { user, api, logout } = useAuth();
  const checkinApi = useMemo(() => new CheckInApi(api), [api]);
  const [stats, setStats] = useState<CheckInStats | null>(null);

  useEffect(() => {
    checkinApi.stats().then(r => r.success && r.data && setStats(r.data));
  }, [checkinApi]);

  const streak = stats?.consecutiveDays ?? 0;

  return (
    <div className="min-h-screen bg-sa-bg pb-24 transition-colors duration-500">
      <div className="max-w-[430px] mx-auto px-7">
        <header className="flex justify-between items-start pt-8">
          <div className="font-mono text-[10px] tracking-[0.2em] text-sa-ink-faint uppercase leading-relaxed animate-fade-up">
            PROFILE · MINE<br/>
            <span className="text-sa-life">Day {stats?.totalDays ?? 0}</span>
          </div>
          <ThemeToggle />
        </header>

        <h1 className="font-display italic text-[48px] leading-none mt-8 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          Mine
          <span className="block font-body not-italic font-bold text-[32px] mt-1">我的</span>
        </h1>

        <div className="mt-8 py-6 border-y border-sa-line flex items-center gap-4 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sa-life to-sa-green flex items-center justify-center text-sa-bg font-bold text-[28px] animate-breathe">
            {(user?.nickname || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="font-body font-bold text-xl">{user?.nickname || user?.email || user?.phone}</div>
            <div className="font-mono text-[11px] text-sa-ink-soft mt-1 tracking-wider">
              已确认存活 <span className="font-display italic text-base text-sa-life">{stats?.totalDays ?? 0}</span> 天
            </div>
          </div>
          <span className="text-sa-ink-faint">→</span>
        </div>

        <section className="mt-8 animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <div className="section-title mb-4">Stats · 数据</div>
          <div className="grid grid-cols-3 border border-sa-line">
            <div className="py-5 text-center border-r border-sa-line">
              <div className="font-display text-[28px] text-sa-life">{stats?.totalDays ?? 0}</div>
              <div className="font-mono text-[9px] tracking-wider text-sa-ink-faint uppercase mt-1">DAYS · 生存</div>
            </div>
            <div className="py-5 text-center border-r border-sa-line">
              <div className="font-display text-[28px]">0</div>
              <div className="font-mono text-[9px] tracking-wider text-sa-ink-faint uppercase mt-1">PEOPLE · 人物</div>
            </div>
            <div className="py-5 text-center">
              <div className="font-display text-[28px]">{stats?.recordCount ?? 0}</div>
              <div className="font-mono text-[9px] tracking-wider text-sa-ink-faint uppercase mt-1">RECORDS · 记录</div>
            </div>
          </div>
        </section>

        <section className="mt-8 animate-fade-up" style={{ animationDelay: '0.35s' }}>
          <div className="section-title mb-4">Milestones · 成就</div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {MILESTONE_DAYS.map(d => {
              const done = streak >= d;
              const emojis: Record<number, string> = { 7: '🌱', 30: '🌿', 100: '🌳', 365: '🏔', 1000: '⭐' };
              return (
                <div key={d} className="flex-shrink-0 text-center">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-1.5 ${done ? 'bg-sa-green-soft' : 'bg-sa-bg-subtle opacity-40'} ${streak >= d && streak < (MILESTONE_DAYS[MILESTONE_DAYS.indexOf(d as typeof MILESTONE_DAYS[number]) + 1] ?? Infinity) ? 'ring-2 ring-sa-life ring-offset-2 ring-offset-sa-bg' : ''}`}>
                    {emojis[d]}
                  </div>
                  <div className={`font-mono text-[9px] tracking-wider uppercase ${done ? 'text-sa-green' : 'text-sa-ink-faint'}`}>{d} DAYS</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8 animate-fade-up" style={{ animationDelay: '0.4s' }}>
          <div className="section-title mb-3">Settings · 设置</div>
          <div className="flex flex-col border-t border-sa-line">
            <MenuItem href="/profile/death" icon="☠" label="死亡确认" sub="DEATH CONFIRMATION · NOTIFY KIN" danger />
            <MenuItem href="/stories/submit" icon="✍" label="我的投稿" sub="SUBMITTED STORIES" />
            <MenuItem href="/profile/settings" icon="⚙" label="设置" sub="REMINDERS · THEME · PRIVACY" />
            <MenuItem href="#" icon="ⓘ" label="关于我们" sub="YOUR DAYS DESERVE TO BE REMEMBERED" />
          </div>
        </section>

        <div className="mt-10 text-center pb-4">
          <button onClick={logout} className="font-mono text-[10px] tracking-[0.15em] text-sa-ink-faint uppercase hover:text-sa-life transition-colors">
            LOG OUT · 退出登录
          </button>
        </div>
      </div>
      <BottomNav active="profile" />
    </div>
  );
}

function MenuItem({ href, icon, label, sub, danger }: { href: string; icon: string; label: string; sub: string; danger?: boolean }) {
  return (
    <Link to={href} className="flex items-center gap-4 py-[18px] border-b border-sa-line hover:pl-2 transition-all">
      <div className={`w-9 h-9 flex items-center justify-center flex-shrink-0 text-base ${danger ? 'text-red-400' : 'text-sa-ink-soft'}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium">{label}</div>
        <div className="font-mono text-[10px] text-sa-ink-faint tracking-wider mt-0.5 uppercase truncate">{sub}</div>
      </div>
      <span className="text-sa-ink-faint text-xs">→</span>
    </Link>
  );
}
