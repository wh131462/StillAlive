import { Link } from 'react-router-dom';

const tabs = [
  { id: 'home', name: '主页', href: '/', d: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10' },
  { id: 'checkin', name: '打卡', href: '/checkin', d: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4M9 15l2 2 4-4' },
  { id: 'person', name: '人物', href: '/people', d: 'M12 8a4 4 0 100-8 4 4 0 000 8zM4 21c1-4 4-6 8-6s7 2 8 6' },
  { id: 'profile', name: '我的', href: '/profile', d: 'M12 21a9 9 0 110-18 9 9 0 010 18zM12 13a3 3 0 100-6 3 3 0 000 6zM6 19c1-3 3-4 6-4s5 1 6 4' },
];

export default function BottomNav({ active }: { active: string }) {
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
