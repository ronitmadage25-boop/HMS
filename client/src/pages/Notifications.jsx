import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Megaphone } from 'lucide-react';
import { api, fmtTime, msg } from '../api';
import { useAuth } from '../auth';
import { useLoad, Loading, PageHeader, Empty, Modal, Field, toast, Tabs } from '../components/ui';

export default function Notifications() {
  const { user } = useAuth(); const [tab, setTab] = useState('recent'); const [open, setOpen] = useState(false); const [f, setF] = useState({ title: '', message: '', block: '' });
  const { data, loading, reload } = useLoad(() => api.get('/notifications', { params: { archived: tab === 'archived' } }).then((r) => r.data), [tab]);
  const { data: blocks } = useLoad(() => (user.role === 'admin' ? api.get('/rooms/summary').then((r) => r.data.blocks.map((b) => b.block)) : Promise.resolve([])), []);
  const mark = async (n) => { if (!n.read) { await api.post(`/notifications/${n._id}/read`); reload(); } };
  const send = async () => { try { const r = await api.post('/notifications/broadcast', f); toast.ok(`Announcement sent to ${r.data.sent} students`); setOpen(false); setF({ title: '', message: '', block: '' }); } catch (e) { toast.err(msg(e)); } };
  return (<>
    <PageHeader title="Notifications" subtitle="Newest first. Items are archived after 90 days." actions={<>
      {user.role === 'admin' && <button className="btn-soft" onClick={() => setOpen(true)}><Megaphone size={16} />New announcement</button>}
      <button className="btn-outline" onClick={async () => { await api.post('/notifications/read-all'); reload(); }}><CheckCheck size={16} />Mark all read</button></>} />
    <Tabs tabs={[{ id: 'recent', label: 'Recent' }, { id: 'archived', label: 'Archived' }]} value={tab} onChange={setTab} />
    {loading ? <Loading /> : <div className="card divide-y divide-line">{data.items.length ? data.items.map((n) => (
      <div key={n._id} onClick={() => mark(n)} className={`flex gap-4 px-5 py-4 ${n.read ? '' : 'bg-brand-50/50'}`}>
        <span className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${n.read ? 'bg-mist text-slate-400' : 'bg-brand-600 text-white'}`}><Bell size={16} /></span>
        <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className={`text-sm ${n.read ? 'font-medium' : 'font-semibold'}`}>{n.title}</p><span className="shrink-0 text-xs text-slate-400">{fmtTime(n.createdAt)}</span></div><p className="mt-0.5 text-sm text-slate-600">{n.message}</p>{n.link && <Link to={n.link} className="mt-1 inline-block text-xs font-semibold text-brand-600">Open</Link>}</div>
      </div>)) : <Empty title="You're all caught up" hint="Updates about applications, payments, complaints and visitors will show here." />}</div>}
    <Modal open={open} onClose={() => setOpen(false)} title="New announcement" footer={<><button className="btn-outline" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" onClick={send}>Send</button></>}>
      <div className="space-y-4"><Field label="Audience"><select className="input" value={f.block} onChange={(e) => setF({ ...f, block: e.target.value })}><option value="">All students</option>{(blocks || []).map((b) => <option key={b} value={b}>Block {b}</option>)}</select></Field>
        <Field label="Title" required><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field><Field label="Message" required><textarea rows={4} className="input" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field></div>
    </Modal></>);
}
