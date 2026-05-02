import { useTheme } from '@/context/theme';

export default function ThemeToggle() {
  const { toggle, theme } = useTheme();
  return (
    <button onClick={toggle} aria-label="theme" className="w-9 h-9 rounded-full border border-sa-line bg-sa-surface text-sm hover:scale-105 transition-transform">
      {theme === 'dark' ? '☀' : '🌙'}
    </button>
  );
}
