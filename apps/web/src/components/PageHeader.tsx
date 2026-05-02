import { Link } from 'react-router-dom';

export default function PageHeader({ title, back, right }: { title?: string; back?: string; right?: React.ReactNode }) {
  return (
    <header className="flex justify-between items-center pt-8">
      {back ? <Link to={back} className="text-sa-ink-faint text-sm hover:text-sa-life transition-colors">← Back</Link> : <div />}
      {title && <span className="font-mono text-[11px] tracking-[0.2em] text-sa-ink uppercase">{title}</span>}
      {right || <div />}
    </header>
  );
}
