import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/context/theme';
import PageHeader from '@/components/PageHeader';
import ThemeToggle from '@/components/ThemeToggle';

export default function SettingsPage() {
  const { logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [reminders, setReminders] = useState(true);
  const [birthday, setBirthday] = useState(true);
  const [milestone, setMilestone] = useState(true);
  const [storyReview, setStoryReview] = useState(false);
  const [reminderTime] = useState('21:00');

  return (
    <div className="min-h-screen bg-sa-bg pb-10 transition-colors duration-500">
      <div className="max-w-[430px] mx-auto px-7">
        <PageHeader title="SETTINGS" back="/profile" right={<ThemeToggle />} />

        <h1 className="font-display italic text-[36px] leading-[1.1] mt-8 animate-fade-up">
          Settings
          <span className="block font-body not-italic font-bold text-[24px] mt-1">设置</span>
        </h1>

        <Group title="REMINDER · 打卡提醒" delay={0.1}>
          <ToggleRow label="每日提醒" sub="DAILY NOTIFICATION" value={reminders} onChange={setReminders} />
          <ValueRow label="提醒时间" sub="PUSH · LOCAL / WECHAT / BROWSER" value={reminderTime} />
        </Group>

        <Group title="APPEARANCE · 外观" delay={0.2}>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <ThemeOpt icon="☀" label="LIGHT" active={theme === 'light'} />
            <ThemeOpt icon="🌙" label="DARK" active={theme === 'dark'} />
            <ThemeOpt icon="◐" label="SYSTEM" active={false} />
          </div>
        </Group>

        <Group title="NOTIFICATIONS · 通知" delay={0.3}>
          <ToggleRow label="生日提醒" value={birthday} onChange={setBirthday} />
          <ToggleRow label="里程碑通知" value={milestone} onChange={setMilestone} />
          <ToggleRow label="投稿审核" value={storyReview} onChange={setStoryReview} />
        </Group>

        <Group title="DATA & PRIVACY · 数据" delay={0.4}>
          <MenuRow label="数据备份" sub="EXPORT ALL DATA" />
          <MenuRow label="清除缓存" sub="12.3 MB" />
        </Group>

        <Group title="HELP · 帮助" delay={0.5}>
          <MenuRow label="帮助与反馈" />
          <MenuRow label="用户协议" />
          <MenuRow label="隐私政策" />
        </Group>

        <button onClick={() => { logout(); navigate('/login'); }}
          className="w-full mt-8 py-4 border border-red-400 text-red-400 font-mono text-xs tracking-[0.15em] uppercase hover:bg-red-400 hover:text-sa-bg transition-colors animate-fade-up" style={{ animationDelay: '0.6s' }}>
          LOG OUT · 退出登录
        </button>

        <p className="text-center mt-4 font-mono text-[10px] tracking-[0.15em] text-sa-ink-faint uppercase">
          v3.0 · YOUR DAYS DESERVE TO BE REMEMBERED
        </p>
      </div>
    </div>
  );
}

function Group({ title, delay, children }: { title: string; delay: number; children: React.ReactNode }) {
  return (
    <section className="mt-8 animate-fade-up" style={{ animationDelay: `${delay}s` }}>
      <div className="section-title mb-3">{title}</div>
      <div className="border-t border-sa-line">{children}</div>
    </section>
  );
}

function ToggleRow({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex justify-between items-center py-4 border-b border-sa-line">
      <div>
        <div className="text-[14px]">{label}</div>
        {sub && <div className="font-mono text-[10px] text-sa-ink-faint tracking-wider mt-0.5 uppercase">{sub}</div>}
      </div>
      <button onClick={() => onChange(!value)} className={`w-11 h-6 rounded-full relative transition-colors ${value ? 'bg-sa-life' : 'bg-sa-line'}`}>
        <span className={`absolute top-0.5 w-5 h-5 bg-sa-bg rounded-full transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function ValueRow({ label, sub, value }: { label: string; sub?: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-4 border-b border-sa-line">
      <div>
        <div className="text-[14px]">{label}</div>
        {sub && <div className="font-mono text-[10px] text-sa-ink-faint tracking-wider mt-0.5 uppercase">{sub}</div>}
      </div>
      <span className="font-mono text-[13px] text-sa-life tracking-wider">{value}</span>
    </div>
  );
}

function MenuRow({ label, sub }: { label: string; sub?: string }) {
  return (
    <a href="#" className="flex justify-between items-center py-[18px] border-b border-sa-line hover:pl-2 transition-all">
      <div>
        <div className="text-[14px]">{label}</div>
        {sub && <div className="font-mono text-[10px] text-sa-ink-faint tracking-wider mt-0.5 uppercase">{sub}</div>}
      </div>
      <span className="text-sa-ink-faint text-xs">→</span>
    </a>
  );
}

function ThemeOpt({ icon, label, active }: { icon: string; label: string; active: boolean }) {
  return (
    <div className={`py-3.5 px-2 text-center font-mono text-[10px] tracking-wider uppercase border flex flex-col items-center gap-1.5 ${active ? 'bg-sa-life-soft border-sa-life text-sa-life' : 'border-sa-line text-sa-ink-soft'}`}>
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
