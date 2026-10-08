import { useEffect, useState } from 'react';
import { X, Loader2, Inbox } from 'lucide-react';

const tone = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', blue: 'bg-brand-50 text-brand-700 ring-brand-200', amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200', gray: 'bg-slate-100 text-slate-600 ring-slate-200', violet: 'bg-violet-50 text-violet-700 ring-violet-200',
};
const map = {
  Approved: 'green', Allocated: 'blue', Rejected: 'red', Waitlisted: 'amber', Submitted: 'blue', 'Under Review': 'violet', Draft: 'gray', Withdrawn: 'gray', Forfeited: 'red',
  Registered: 'blue', Assigned: 'violet', 'In Progress': 'amber', Resolved: 'green', Closed: 'gray', Open: 'blue', Completed: 'green',
  Paid: 'green', Partial: 'amber', Pending: 'amber', Overdue: 'red', Cancelled: 'gray', Success: 'green', Failed: 'red', Created: 'gray',
  Vacant: 'green', Full: 'red', 'Under Maintenance': 'amber', Blocked: 'red', Active: 'green',
  CheckedIn: 'green', CheckedOut: 'gray', Vacated: 'gray', NoShow: 'red', Inside: 'amber', Exited: 'gray', Denied: 'red',
  Urgent: 'red', High: 'amber', Medium: 'blue', Low: 'gray',
};
export const Badge = ({ children, color }) => <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone[color || map[children] || 'gray']}`}>{children}</span>;

export const Spinner = ({ className = '' }) => <Loader2 className={`animate-spin text-brand-600 ${className}`} size={20} />;
export const Loading = () => <div className="flex justify-center py-20"><Spinner /></div>;
export const Empty = ({ title, hint, action }) => (
  <div className="flex flex-col items-center px-6 py-14 text-center">
    <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Inbox size={22} /></div>
    <p className="font-semibold">{title}</p>{hint && <p className="mt-1 max-w-sm text-sm text-slate-500">{hint}</p>}{action && <div className="mt-4">{action}</div>}
  </div>
);
export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-2xl font-semibold">{title}</h1>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>
    <div className="flex flex-wrap gap-2">{actions}</div>
  </div>
);
export const Field = ({ label, hint, required, error, children, className = '' }) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block text-sm font-medium">{label}{required && <span className="ml-0.5 text-brand-600">*</span>}</span>
    {children}
    {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
  </label>
);
export const Stat = ({ label, value, sub, icon: Icon }) => (
  <div className="card p-5">
    <div className="flex items-start justify-between"><p className="text-sm text-slate-500">{label}</p>{Icon && <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon size={18} /></span>}</div>
    <p className="mt-2 font-display text-2xl font-semibold">{value}</p>{sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
  </div>
);
export const Table = ({ head, children, empty }) => (
  <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[640px]">
    <thead className="border-b border-line bg-mist"><tr>{head.map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
    <tbody className="divide-y divide-line">{children}</tbody></table></div>{empty}</div>
);
export function Modal({ open, onClose, title, children, wide, footer }) {
  useEffect(() => { if (!open) return; const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div className={`pop flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-lift sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-6 py-4"><h2 className="text-lg font-semibold">{title}</h2><button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-mist" aria-label="Close"><X size={18} /></button></div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
export const Tabs = ({ tabs, value, onChange }) => (
  <div className="mb-5 inline-flex flex-wrap gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
    {tabs.map((t) => <button key={t.id} onClick={() => onChange(t.id)} className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${value === t.id ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-brand-50'}`}>{t.label}{t.count ? <span className="ml-1.5 rounded-full bg-white/25 px-1.5 text-xs">{t.count}</span> : null}</button>)}
  </div>
);

// Toasts
let push = () => {};
export const toast = { ok: (m) => push({ m, t: 'ok' }), err: (m) => push({ m, t: 'err' }) };
export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => { push = (n) => { const id = Math.random(); setItems((s) => [...s, { ...n, id }]); setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4500); }; return () => { push = () => {}; }; }, []);
  return <div className="fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2">{items.map((i) => (
    <div key={i.id} role="status" className={`pop rounded-xl px-4 py-3 text-sm font-medium shadow-lift ${i.t === 'ok' ? 'bg-ink text-white' : 'bg-red-600 text-white'}`}>{i.m}</div>))}</div>;
}
export const useLoad = (fn, deps = [], every) => {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
  const run = () => fn().then((d) => { setData(d); setError(null); }).catch((e) => setError(e)).finally(() => setLoading(false));
  useEffect(() => { setLoading(true); run(); if (every) { const t = setInterval(run, every); return () => clearInterval(t); } }, deps); // eslint-disable-line
  return { data, loading, error, reload: run, setData };
};
export const Confirm = ({ open, title, text, onYes, onNo, yes = 'Confirm', danger }) => (
  <Modal open={open} onClose={onNo} title={title} footer={<><button className="btn-outline" onClick={onNo}>Cancel</button><button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onYes}>{yes}</button></>}><p className="text-sm text-slate-600">{text}</p></Modal>
);
