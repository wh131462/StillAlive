import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/context/theme';

export default function RegisterPage() {
  const { login, authApi, api } = useAuth();
  const { toggle, theme } = useTheme();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const handleSendCode = async () => {
    setError('');
    const res = await api.post<{ sent: boolean }>('/auth/send-sms', { phone, scene: 'register' });
    if (res.success) setCodeSent(true);
    else setError(res.message || '发送失败');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = tab === 'phone'
        ? { phone, smsCode: code, nickname: nickname || undefined }
        : { email, password, nickname: nickname || undefined };
      const res = await api.post<{ user: Parameters<typeof login>[1]; tokens: Parameters<typeof login>[0] }>('/auth/register', body);
      if (res.success && res.data) {
        login(res.data.tokens, res.data.user);
        navigate('/');
      } else {
        setError(res.message || '注册失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sa-bg transition-colors duration-500">
      <div className="max-w-[430px] mx-auto min-h-screen flex flex-col px-8">
        <header className="flex justify-between items-center pt-8">
          <Link to="/login" className="text-sa-ink-faint text-sm hover:text-sa-life">← Back</Link>
          <button onClick={toggle} className="w-9 h-9 rounded-full border border-sa-line bg-sa-surface text-sm">{theme === 'dark' ? '☀' : '🌙'}</button>
        </header>

        <div className="pt-12 pb-8">
          <h1 className="font-display italic text-[42px] leading-[1.1] animate-fade-up">
            New here
            <span className="block font-body not-italic font-bold text-[32px] mt-1">创建账号</span>
          </h1>
          <p className="font-display italic text-sm text-sa-ink-soft mt-4 animate-fade-up" style={{ animationDelay: '0.1s' }}>— begin recording your aliveness</p>
        </div>

        <div className="flex gap-8 border-b border-sa-line mb-8 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          {(['phone', 'email'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`pb-3 font-mono text-[13px] tracking-wider relative ${tab === t ? 'text-sa-ink' : 'text-sa-ink-faint'}`}>
              {t === 'phone' ? '手机号 · Phone' : '邮箱 · Email'}
              {tab === t && <span className="absolute bottom-[-1px] left-0 right-0 h-px bg-sa-life" />}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 animate-fade-up" style={{ animationDelay: '0.3s' }}>
          {tab === 'phone' ? (
            <>
              <Field label="手机号" labelEn="PHONE">
                <div className="flex items-center">
                  <span className="font-mono text-sa-ink-faint mr-2 text-sm">+86</span>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="your number" className="input-base flex-1" />
                </div>
              </Field>
              <Field label="验证码" labelEn="OTP">
                <div className="flex items-center">
                  <input type="text" value={code} onChange={e => setCode(e.target.value)} maxLength={6} placeholder="six digits" className="input-base flex-1" />
                  <button type="button" onClick={handleSendCode} disabled={codeSent} className="font-mono text-[11px] text-sa-life tracking-[0.15em] pl-3 border-l border-sa-line disabled:opacity-50">
                    {codeSent ? 'SENT ✓' : 'SEND →'}
                  </button>
                </div>
              </Field>
            </>
          ) : (
            <>
              <Field label="邮箱" labelEn="EMAIL">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="input-base w-full" />
              </Field>
              <Field label="密码" labelEn="PASSWORD · 至少6位含字母数字">
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="at least 6 chars" className="input-base w-full" />
              </Field>
            </>
          )}
          <Field label="昵称" labelEn="NICKNAME · OPTIONAL">
            <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="give yourself a name" maxLength={20} className="input-base w-full" />
          </Field>

          {error && <p className="text-sa-life text-xs font-mono tracking-wider mb-4">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary group mt-6">
            <span className="absolute inset-0 bg-sa-life translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <span className="relative z-10">{loading ? '...' : 'Create · 注册'}</span>
          </button>
          <p className="text-center text-xs text-sa-ink-faint mt-6 pb-10">已有账号？<Link to="/login" className="text-sa-life">去登录</Link></p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, labelEn, children }: { label: string; labelEn: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="field-label"><span>{label}</span><span>{labelEn}</span></div>
      <div className="field-input-wrap">{children}</div>
    </div>
  );
}
