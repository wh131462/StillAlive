import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { StoryApi } from '@stillalive/api';
import type { StoryCategory } from '@stillalive/types';
import ThemeToggle from '@/components/ThemeToggle';

const CATS: Array<{ value: StoryCategory; label: string }> = [
  { value: 'accident', label: 'ACCIDENT 意外' },
  { value: 'illness', label: 'ILLNESS 疾病' },
  { value: 'mental', label: 'MENTAL 心理' },
  { value: 'nature', label: 'NATURE 自然' },
  { value: 'other', label: 'OTHER 其他' },
];

export default function StorySubmitPage() {
  const { api } = useAuth();
  const storyApi = useMemo(() => new StoryApi(api), [api]);
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [approxDate, setApproxDate] = useState('');
  const [category, setCategory] = useState<StoryCategory | ''>('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (content.length < 100 || content.length > 800) {
      setError('正文需 100~800 字');
      return;
    }
    setSubmitting(true);
    setError('');
    const res = await storyApi.submit({
      title: title || undefined,
      content,
      approximateDate: approxDate || undefined,
      category: category || undefined,
      contactEmail: email || undefined,
    });
    setSubmitting(false);
    if (res.success) {
      navigate('/stories');
    } else {
      setError(res.message || '提交失败');
    }
  };

  return (
    <div className="min-h-screen bg-sa-bg transition-colors duration-500">
      <div className="max-w-[430px] mx-auto min-h-screen flex flex-col px-7">
        <header className="flex justify-between items-center pt-8">
          <Link to="/stories" className="text-sa-ink-faint text-sm hover:text-sa-life">← Back</Link>
          <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-sa-ink">SUBMIT</span>
          <ThemeToggle />
        </header>

        <h1 className="font-display italic text-[36px] leading-[1.1] mt-8 animate-fade-up">
          Tell yours
          <span className="block font-body not-italic font-bold text-[24px] mt-1">讲述你的故事</span>
        </h1>

        <div className="mt-6 border-l-2 border-sa-life px-5 py-4 bg-sa-life-soft font-display italic text-[13px] text-sa-ink-soft leading-relaxed animate-fade-up" style={{ animationDelay: '0.1s' }}>
          这里收录"差点就没了，但我现在还活着"的瞬间。<br />
          关注活下来之后，不关注死亡本身。<br />
          故事完全匿名，经审核后发布。
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex-1 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <div className="mb-6">
            <div className="field-label"><span>标题 / 首句 · TITLE</span><span>OPTIONAL · ≤30</span></div>
            <div className="field-input-wrap">
              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={30} placeholder="为你的故事起一个开头" className="input-base w-full font-body" />
            </div>
          </div>

          <div className="mb-6">
            <div className="field-label"><span>正文 · BODY <span className="text-sa-life">*</span></span><span>{content.length} / 800</span></div>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={10} minLength={100} maxLength={800}
              placeholder="讲述那个你差点就没了，但现在还活着的瞬间..."
              className="w-full bg-transparent outline-none text-[17px] font-display italic leading-[1.85] resize-none border-b border-sa-line pb-4 placeholder:text-sa-ink-faint" />
          </div>

          <div className="mb-6">
            <div className="field-label"><span>大致时间 · WHEN</span></div>
            <div className="field-input-wrap">
              <input value={approxDate} onChange={e => setApproxDate(e.target.value)} placeholder="例：2024 年冬、三年前" className="input-base w-full" />
            </div>
          </div>

          <div className="mb-6">
            <div className="field-label"><span>故事类型 · CATEGORY</span></div>
            <div className="flex flex-wrap gap-2 mt-1">
              {CATS.map(c => (
                <button key={c.value} type="button" onClick={() => setCategory(category === c.value ? '' : c.value)}
                  className={`px-3.5 py-2 font-mono text-[10px] tracking-wider uppercase border transition-colors ${category === c.value ? 'bg-sa-ink text-sa-bg border-sa-ink' : 'border-sa-line text-sa-ink-soft'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <div className="field-label"><span>联系邮箱 · EMAIL</span></div>
            <div className="field-input-wrap">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="审核通知用，可不填" className="input-base w-full" />
            </div>
          </div>

          {error && <p className="text-sa-life text-xs font-mono tracking-wider mb-4">{error}</p>}

          <div className="sticky bottom-0 bg-gradient-to-t from-sa-bg via-sa-bg pt-4 pb-8 mt-8">
            <p className="font-mono text-[10px] tracking-wider text-sa-ink-faint text-center uppercase mb-3">REVIEW WITHIN 48 HOURS</p>
            <button type="submit" disabled={submitting} className="btn-primary group">
              <span className="absolute inset-0 bg-sa-life translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
              <span className="relative z-10">{submitting ? '...' : 'Submit · 提交故事'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
