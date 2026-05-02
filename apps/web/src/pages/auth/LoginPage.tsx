import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/context/theme';

export default function LoginPage() {
  const { login, authApi } = useAuth();
  const { toggle, theme } = useTheme();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const handleSendCode = async () => {
    setError('');
    const res = await authApi['http'].post<{sent: boolean}>('/auth/send-sms', { phone, scene: 'login' });
    if (res.success) setCodeSent(true);
    else setError(res.message || '发送失败');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let res;
      if (tab === 'phone') {
        res = await authApi.loginByPhone({ phone, code });
      } else {
        res = await authApi.loginByEmail({ email, password });
      }
      if (res.success && res.data) {
        const data = res.data as unknown as { user: Parameters<typeof login>[1]; tokens: Parameters<typeof login>[0] };
        login(data.tokens, data.user);
        navigate('/');
      } else {
        setError(res.message || '登录失败');
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

        <header className="flex justify-between pt-8">
          <div className="font-mono text-[10px] tracking-[0.2em] text-sa-ink-faint uppercase leading-relaxed animate-fade-up">
            STILL ALIVE<br/>
            <span className="text-sa-life">Login</span>
          </div>
          <button onClick={toggle} className="w-9 h-9 rounded-full border border-sa-line bg-sa-surface text-sm">
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
        </header>

        <div className="pt-16 pb-8">
          <div className="w-14 h-14 rounded-full bg-sa-life flex items-center justify-center mb-8 animate-breathe animate-breathe-glow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h4l3-9 4 18 3-9h4"/>
            </svg>
          </div>
          <h1 className="font-display italic text-[56px] leading-[0.95] font-normal tracking-tight animate-fade-up" style={{ animationDelay: '0.1s' }}>
            Hello,
            <span className="block font-body not-italic font-bold text-[44px] mt-1 tracking-wide">
              还<span className="text-sa-life">活</span>着吗？
            </span>
          </h1>
          <p className="font-display italic text-sm text-sa-ink-soft mt-6 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            — today asks the same gentle question
          </p>
        </div>

        <div className="flex gap-8 border-b border-sa-line mb-8 animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <button onClick={() => setTab('phone')} className={`pb-3 font-mono text-[13px] tracking-wider relative ${tab === 'phone' ? 'text-sa-ink' : 'text-sa-ink-faint'}`}>
            手机号 · Phone
            {tab === 'phone' && <span className="absolute bottom-[-1px] left-0 right-0 h-px bg-sa-life" />}
          </button>
          <button onClick={() => setTab('email')} className={`pb-3 font-mono text-[13px] tracking-wider relative ${tab === 'email' ? 'text-sa-ink' : 'text-sa-ink-faint'}`}>
            邮箱 · Email
            {tab === 'email' && <span className="absolute bottom-[-1px] left-0 right-0 h-px bg-sa-life" />}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 animate-fade-up" style={{ animationDelay: '0.4s' }}>
          {tab === 'phone' ? (
            <>
              <div className="mb-6">
                <div className="font-mono text-[10px] tracking-[0.2em] text-sa-ink-faint uppercase mb-2 flex justify-between">
                  <span>手机号</span><span>PHONE</span>
                </div>
                <div className="flex items-center border-b border-sa-line pb-2 focus-within:border-sa-life transition-colors">
                  <span className="font-mono text-sa-ink-faint mr-2 text-sm">+86</span>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="your number"
                    className="flex-1 bg-transparent outline-none text-base font-display italic placeholder:text-sa-ink-faint" />
                </div>
              </div>
              <div className="mb-6">
                <div className="font-mono text-[10px] tracking-[0.2em] text-sa-ink-faint uppercase mb-2 flex justify-between">
                  <span>验证码</span><span>OTP</span>
                </div>
                <div className="flex items-center border-b border-sa-line pb-2 focus-within:border-sa-life transition-colors">
                  <input type="text" value={code} onChange={e => setCode(e.target.value)} maxLength={6} placeholder="six digits"
                    className="flex-1 bg-transparent outline-none text-base font-display italic placeholder:text-sa-ink-faint" />
                  <button type="button" onClick={handleSendCode} disabled={codeSent}
                    className="font-mono text-[11px] text-sa-life tracking-[0.15em] pl-3 border-l border-sa-line disabled:opacity-50">
                    {codeSent ? 'SENT ✓' : 'SEND →'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6">
                <div className="font-mono text-[10px] tracking-[0.2em] text-sa-ink-faint uppercase mb-2">邮箱 · EMAIL</div>
                <div className="flex items-center border-b border-sa-line pb-2 focus-within:border-sa-life transition-colors">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
                    className="flex-1 bg-transparent outline-none text-base font-display italic placeholder:text-sa-ink-faint" />
                </div>
              </div>
              <div className="mb-6">
                <div className="font-mono text-[10px] tracking-[0.2em] text-sa-ink-faint uppercase mb-2">密码 · PASSWORD</div>
                <div className="flex items-center border-b border-sa-line pb-2 focus-within:border-sa-life transition-colors">
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="your password"
                    className="flex-1 bg-transparent outline-none text-base font-display italic placeholder:text-sa-ink-faint" />
                </div>
              </div>
            </>
          )}

          {error && <p className="text-sa-life text-xs font-mono tracking-wider mb-4">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-[18px] bg-sa-ink text-sa-bg font-display italic text-[17px] tracking-wider relative overflow-hidden group disabled:opacity-50 mt-6">
            <span className="absolute inset-0 bg-sa-life translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <span className="relative z-10">
              {loading ? 'Confirming...' : 'Confirm I\'m here · 确认存活'}
            </span>
          </button>

          <div className="flex justify-between mt-6 text-xs text-sa-ink-faint">
            <Link to="/register" className="hover:text-sa-life transition-colors">注册账号 · New here</Link>
            <Link to="/forgot" className="hover:text-sa-life transition-colors">忘记密码 · Forgot</Link>
          </div>
        </form>

        <footer className="py-10 text-center font-mono text-[10px] text-sa-ink-faint tracking-[0.15em] uppercase">
          v3.0 · your days deserve to be remembered
        </footer>
      </div>
    </div>
  );
}
