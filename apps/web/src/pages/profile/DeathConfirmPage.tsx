import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import type { DeathConfirmation } from '@stillalive/types';
import PageHeader from '@/components/PageHeader';
import ThemeToggle from '@/components/ThemeToggle';

const DAYS_OPTIONS = [3, 7, 14, 30];

export default function DeathConfirmPage() {
  const { api, user } = useAuth();
  const [data, setData] = useState<DeathConfirmation | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [days, setDays] = useState(7);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<DeathConfirmation>('/profile/death-confirmation').then(r => {
      if (r.success && r.data) {
        setData(r.data);
        setEnabled(r.data.enabled);
        setDays(r.data.triggerDays);
        setEmail(r.data.emergencyEmail);
      }
    });
  }, [api]);

  const save = async (next: Partial<DeathConfirmation>) => {
    setSaving(true);
    const body = { enabled, triggerDays: days, emergencyEmail: email, ...next };
    const res = await api.put<DeathConfirmation>('/profile/death-confirmation', body);
    setSaving(false);
    if (res.success && res.data) {
      setData(res.data);
      setEnabled(res.data.enabled);
      setDays(res.data.triggerDays);
      setEmail(res.data.emergencyEmail);
    }
  };

  return (
    <div className="min-h-screen bg-sa-bg pb-10 transition-colors duration-500">
      <div className="max-w-[430px] mx-auto px-7">
        <PageHeader title="DEATH" back="/profile" right={<ThemeToggle />} />

        <h1 className="font-display italic text-[36px] leading-[1.1] mt-8 animate-fade-up">
          Memento
          <span className="block font-body not-italic font-bold text-[24px] mt-1">死亡确认</span>
        </h1>

        <div className="mt-6 border-l-2 border-red-400 px-5 py-4 bg-red-400/[0.06] font-display italic text-[13px] text-sa-ink-soft leading-relaxed animate-fade-up" style={{ animationDelay: '0.1s' }}>
          当你连续多天未打卡时，系统将向你设定的紧急联系人发送一封"死亡确认"邮件。这不是诅咒，只是一种温柔的牵挂。
        </div>

        <div className="section-title mt-8 mb-3">SWITCH · 开关</div>
        <div className="border-y border-sa-line py-5 flex justify-between items-center animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <div>
            <h3 className="text-[15px] font-medium">启用死亡确认</h3>
            <p className="font-mono text-[10px] text-sa-ink-soft tracking-wider mt-1">ENABLE DEATH CONFIRMATION</p>
          </div>
          <button onClick={() => { setEnabled(!enabled); save({ enabled: !enabled }); }}
            className={`w-11 h-6 rounded-full relative transition-colors ${enabled ? 'bg-sa-life' : 'bg-sa-line'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-sa-bg rounded-full transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div className="section-title mt-8 mb-3">DAYS · 触发天数</div>
        <div className="grid grid-cols-4 gap-2 animate-fade-up" style={{ animationDelay: '0.3s' }}>
          {DAYS_OPTIONS.map(d => (
            <button key={d} onClick={() => { setDays(d); save({ triggerDays: d }); }}
              className={`py-3.5 text-center font-mono text-[13px] tracking-wider border ${days === d ? 'bg-sa-ink text-sa-bg border-sa-ink' : 'border-sa-line text-sa-ink-soft hover:border-sa-life'}`}>
              {d}
            </button>
          ))}
        </div>
        <p className="font-mono text-[10px] text-sa-ink-faint mt-2 tracking-wider">连续 {days} 天未打卡后触发通知</p>

        <div className="section-title mt-8 mb-2">CONTACT · 紧急联系人</div>
        <div className="border-b border-sa-line pb-2 focus-within:border-sa-life transition-colors animate-fade-up" style={{ animationDelay: '0.4s' }}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={() => save({ emergencyEmail: email })}
            placeholder="family@example.com" className="input-base w-full" />
        </div>
        <p className="font-mono text-[10px] text-sa-ink-faint mt-2 tracking-wider">此邮箱将收到确认邮件</p>

        <div className="section-title mt-8 mb-3">PREVIEW · 邮件预览</div>
        <div className="border border-dashed border-sa-line p-5 font-display italic text-[13px] text-sa-ink-soft leading-[1.85] animate-fade-up" style={{ animationDelay: '0.5s' }}>
          <p className="font-body not-italic font-bold text-sm text-sa-ink mb-3">主题：关于 {user?.nickname || '你'} 的生存确认</p>
          <p>你好，</p>
          <p className="mt-2">用户 <strong>{user?.nickname || '你'}</strong> 已连续 {days} 天未在"还活着"应用中确认存活。</p>
          <p className="mt-2">这封邮件并不意味着什么，但如果方便的话，请确认 TA 是否安好。</p>
          <p className="mt-2 text-sa-ink-faint">—— 来自「还活着」</p>
        </div>

        {saving && <p className="text-center text-xs text-sa-ink-faint mt-4 font-mono tracking-wider animate-breathe">SAVING...</p>}
      </div>
    </div>
  );
}
