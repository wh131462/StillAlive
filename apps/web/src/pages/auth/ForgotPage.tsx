import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/context/theme';

export default function ForgotPage() {
  const { api } = useAuth();
  const { toggle, theme } = useTheme();
  const [tab, setTab] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const handleSendCode = async () => {
    setError('');
    const endpoint = tab === 'phone' ? '/auth/send-sms' : '/auth/send-email-code';
    const body = tab === 'phone' ? { phone, scene: 'reset' } : { email, scene: 'reset' };
    const res = await api.post<{ sent: boolean }>(endpoint, body);
    if (res.success) setCodeSent(true);
    else setError(res.message || '发送失败');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (step === 1) {
      if (!codeSent) { setError('请先发送验证码'); return; }
      setStep(2);
      return;
    }
    const body = tab === 'phone'
      ? { phone, code, newPassword }
      : { email, code, newPassword };
    const res = await api.post<{ reset: boolean }>('/auth/reset-password', body);
    if (res.success) setSuccess(true);
    else setError(res.message || '重置失败');
  };

  if (success) {
    return (
      <div className="min-h-screen bg-sa-bg flex items-center justify-center px-8">
        <div className="text-center animate-fade-up">
          <div className="text-4xl mb-6">✓</div>
          <h2 className="font-body font-bold text-xl mb-2">密码已重置</h2>
          <p className="text-sm text-sa-ink-soft mb-8">其他设备将自动退出登录</p>
          <Link to="/login" className="font-mono text-sm text-sa-life tracking-wider">去登录 →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sa-bg transition-colors duration-500">
      <div className="max-w-[430px] mx-auto min-h-screen flex flex-col px-8">
        <header className="flex justify-between items-center pt-8">
          <Link to="/login" className="text-sa-ink-faint text-sm hover:text-sa-life">← Back</Link>
          <button onClick={toggle} className="w-9 h-9 rounded-full border border-sa-line bg-sa-surface text-sm">{theme === 'dark' ? '☀' : '🌙'}</button>
        </header>

        <div className="pt-12 pb-8">
          <h1 className="font-display italic text-[42px] leading-[1.1] animate-fade-up">
            Forgot
            <span className="block font-body not-italic font-bold text-[32px] mt-1">找回密码</span>
          </h1>
          <p className="font-display italic text-sm text-sa-ink-soft mt-4">— we all forget sometimes</p>
        </div>

        <div className="flex items-center gap-4 mb-8">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono ${step >= 1 ? 'bg-sa-life text-sa-bg' : 'border border-sa-line text-sa-ink-faint'}`}>1</div>
          <span className={`font-mono text-[11px] tracking-wider ${step >= 1 ? 'text-sa-ink' : 'text-sa-ink-faint'}`}>验证</span>
          <div className="flex-1 h-px bg-sa-line" />
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono ${step >= 2 ? 'bg-sa-life text-sa-bg' : 'border border-sa-line text-sa-ink-faint'}`}>2</div>
          <span className={`font-mono text-[11px] tracking-wider ${step >= 2 ? 'text-sa-ink' : 'text-sa-ink-faint'}`}>新密码</span>
        </div>

        {step === 1 && (
          <div className="flex gap-8 border-b border-sa-line mb-8">
            {(['phone', 'email'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`pb-3 font-mono text-[13px] tracking-wider relative ${tab === t ? 'text-sa-ink' : 'text-sa-ink-faint'}`}>
                {t === 'phone' ? '手机号' : '邮箱'}
                {tab === t && <span className="absolute bottom-[-1px] left-0 right-0 h-px bg-sa-life" />}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1">
          {step === 1 ? (
            <>
              <div className="mb-6">
                <div className="field-label"><span>{tab === 'phone' ? '手机号' : '邮箱'}</span></div>
                <div className="field-input-wrap">
                  {tab === 'phone' ? (
                    <div className="flex items-center">
                      <span className="font-mono text-sa-ink-faint mr-2 text-sm">+86</span>
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="registered number" className="input-base flex-1" />
                    </div>
                  ) : (
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="input-base w-full" />
                  )}
                </div>
              </div>
              <div className="mb-6">
                <div className="field-label"><span>验证码</span><span>OTP</span></div>
                <div className="field-input-wrap">
                  <div className="flex items-center">
                    <input type="text" value={code} onChange={e => setCode(e.target.value)} maxLength={6} placeholder="six digits" className="input-base flex-1" />
                    <button type="button" onClick={handleSendCode} disabled={codeSent} className="font-mono text-[11px] text-sa-life tracking-[0.15em] pl-3 border-l border-sa-line disabled:opacity-50">
                      {codeSent ? 'SENT ✓' : 'SEND →'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="mb-6">
              <div className="field-label"><span>新密码</span><span>NEW PASSWORD</span></div>
              <div className="field-input-wrap">
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="at least 6 chars with letters &amp; digits" className="input-base w-full" />
              </div>
            </div>
          )}

          {error && <p className="text-sa-life text-xs font-mono tracking-wider mb-4">{error}</p>}

          <button type="submit" className="btn-primary group mt-4">
            <span className="absolute inset-0 bg-sa-life translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <span className="relative z-10">{step === 1 ? 'Next · 下一步' : 'Reset · 重置密码'}</span>
          </button>
        </form>

        <div className="mt-8 border-l-2 border-sa-green p-4 bg-sa-green-soft text-xs text-sa-ink-soft leading-relaxed mb-10">
          密码重置成功后，其他设备将自动退出登录。
        </div>
      </div>
    </div>
  );
}
