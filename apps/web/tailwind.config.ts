/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sa: {
          bg: 'var(--bg)',
          'bg-subtle': 'var(--bg-subtle)',
          surface: 'var(--surface)',
          ink: 'var(--ink)',
          'ink-soft': 'var(--ink-soft)',
          'ink-faint': 'var(--ink-faint)',
          line: 'var(--line)',
          life: 'var(--life)',
          'life-soft': 'var(--life-soft)',
          green: 'var(--green)',
          'green-soft': 'var(--green-soft)',
        },
      },
      fontFamily: {
        body: ['LXGW WenKai', 'Noto Serif SC', 'Georgia', 'serif'],
        display: ['Playfair Display', 'LXGW WenKai', 'serif'],
        mono: ['SF Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        breathe: 'breathe 1.5s cubic-bezier(0.45,0,0.15,1) infinite',
        'breathe-glow': 'breathe-glow 3s cubic-bezier(0.45,0,0.15,1) infinite',
        drift: 'drift 4s cubic-bezier(0.45,0,0.15,1) infinite',
        'fade-up': 'fade-up 0.8s cubic-bezier(0,0,0.2,1) both',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.06)', opacity: '1' },
        },
        'breathe-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 var(--life-glow)' },
          '50%': { boxShadow: '0 0 40px 10px var(--life-glow)' },
        },
        drift: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
