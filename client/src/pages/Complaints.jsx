import { useState } from 'react';
import { Plus, Star, Paperclip, Send, AlertTriangle } from 'lucide-react';
import { api, msg, fmtTime } from '../api';
import { useAuth } from '../auth';
import { useLoad, Loading, PageHeader, Badge, Empty, Modal, Field, toast, Table } from '../components/ui';

const CATS = ['Maintenance', 'Mess/Food', 'Discipline', 'Security', 'Other'];
const STATUS = ['Registered', 'Assigned', 'In Progress', 'Resolved', 'Closed'];

export default function Complaints() {
  const { user } = useAuth(); const role = user.role; const [flt, setFlt] = useState({ status: '', category: '', block: '', overdue: '', from: '', to: '' });
  const { data, loading, reload } = useLoad(() => api.get('/complaints', { params: Object.fromEntries(Object.entries(flt).filter(([, v]) => v)) }).then((r) => r.data), [JSON.stringify(flt)]);
  const [sel, setSel] = useState(null); const [open, setOpen] = useState(false);
  const view = async (id) => setSel((await api.get(`/complaints/${id}`)).data);
  return (<>
    <PageHeader title="Complaints" subtitle={role === 'student' ? 'Raise an issue and follow it to resolution.' : 'Track, assign and resolve complaints.'} actions={role === 'student' && <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} />New complaint</button>} />
    <div className="mb-4 flex flex-wrap gap-3">
      <select className="input !w-auto" value={flt.status} onChange={(e) => setFlt({ ...flt, status: e.target.value })}><option value="">All statuses</option>{STATUS.map((s) => <option key={s}>{s}</option>)}</select>
      <select className="input !w-auto" value={flt.category} onChange={(e) => setFlt({ ...flt, category: e.target.value })}><option value="">All categories</option>{CATS.map((s) => <option key={s}>{s}</option>)}</select>
      {role !== 'student' && <><input className="input !w-28" placeholder="Block" value={flt.block} onChange={(e) => setFlt({ ...flt, block: e.target.value })} /><input type="date" className="input !w-auto" value={flt.from} onChange={(e) => setFlt({ ...flt, from: e.target.value })} aria-label="From" /><input type="date" className="input !w-auto" value={flt.to} onChange={(e) => setFlt({ ...flt, to: e.target.value })} aria-label="To" /><label className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm"><input type="checkbox" className="accent-brand-600" checked={!!flt.overdue} onChange={(e) => setFlt({ ...flt, overdue: e.target.checked ? '1' : '' })} />Overdue only</label></>}
    </div>
    {loading ? <Loading /> : <Table head={['#', 'Category', 'Raised by', 'Room', 'Registered', 'Status']} empty={data.length ? null : <Empty title="No complaints found" hint={role === 'student' ? 'Use New complaint to report a problem.' : 'Try clearing the filters.'} />}>
      {data.map((c) => <tr key={c._id} className="cursor-pointer hover:bg-mist" onClick={() => view(c._id)}><td className="td font-semibold">#{c.number}</td><td className="td">{c.category}{c.overdue && <span className="ml-2"><Badge color="red">Overdue</Badge></span>}</td><td className="td">{c.hidden ? <span className="text-slate-400">Anonymous</span> : c.student?.name}</td><td className="td">{c.room ? `${c.room.block}-${c.room.number}` : '-'}</td><td className="td">{fmtTime(c.createdAt)}</td><td className="td"><Badge>{c.status}</Badge></td></tr>)}</Table>}
    <NewComplaint open={open} onClose={() => setOpen(false)} done={() => { setOpen(false); reload(); }} />
    {sel && <Detail c={sel} role={role} close={() => setSel(null)} refresh={async () => { reload(); setSel((await api.get(`/complaints/${sel._id}`)).data); }} />}
  </>);
}
function NewComplaint({ open, onClose, done }) {
  const [f, setF] = useState({ category: 'Maintenance', description: '', anonymous: false }); const [files, setFiles] = useState([]); const [similar, setSimilar] = useState([]);
  const cat = async (c) => { setF({ ...f, category: c, anonymous: false }); const r = await api.get('/complaints/duplicate-check', { params: { category: c } }); setSimilar(r.data.similar); };
  const send = async () => { const fd = new FormData(); fd.append('category', f.category); fd.append('description', f.description); fd.append('anonymous', f.anonymous); files.forEach((x) => fd.append('photos', x)); try { const r = await api.post('/complaints', fd); toast.ok(`Complaint #${r.data.number} registered`); setF({ category: 'Maintenance', description: '', anonymous: false }); setFiles([]); done(); } catch (e) { toast.err(msg(e)); } };
  return <Modal open={open} onClose={onClose} title="New complaint" footer={<><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={send}>Submit complaint</button></>}>
    <div className="space-y-4"><Field label="Category" required><select className="input" value={f.category} onChange={(e) => cat(e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
      {similar.length > 0 && <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200"><p className="flex items-center gap-2 font-semibold"><AlertTriangle size={15} />A similar complaint from your room is still open</p><ul className="mt-1 list-disc pl-5">{similar.map((s) => <li key={s._id}>#{s.number} · {s.status}</li>)}</ul><p className="mt-1">You can still submit if this is a different issue.</p></div>}
      <Field label="Description" required hint="At least 10 characters."><textarea rows={4} className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field label="Photos" hint="Up to 3 images (JPEG or PNG, 2 MB each)."><label className="btn-outline cursor-pointer"><Paperclip size={16} />{files.length ? `${files.length} selected` : 'Attach photos'}<input type="file" multiple accept="image/jpeg,image/png" className="sr-only" onChange={(e) => setFiles([...e.target.files].slice(0, 3))} /></label></Field>
      {['Discipline', 'Security'].includes(f.category) && <label className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={f.anonymous} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} /><span><b>Submit anonymously</b><br /><span className="text-slate-500">Your name is hidden from wardens and staff. Only the administrator can see it.</span></span></label>}</div></Modal>;
}
function Detail({ c, role, close, refresh }) {
  const [text, setText] = useState(''); const [rem, setRem] = useState(''); const [staff, setStaff] = useState([]); const [pick, setPick] = useState(''); const [note, setNote] = useState('');
  useLoad(async () => { if (['warden', 'admin'].includes(role)) setStaff((await api.get('/users/staff')).data); return 1; }, []);
  const run = (p, body, ok) => async () => { try { await api.post(`/complaints/${c._id}/${p}`, body); if (ok) toast.ok(ok); setText(''); setRem(''); refresh(); } catch (e) { toast.err(msg(e)); } };
  const mine = role === 'student'; const open = !['Resolved', 'Closed'].includes(c.status);
  return <Modal open onClose={close} wide title={`Complaint #${c.number} · ${c.category}`}>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2"><Badge>{c.status}</Badge>{c.overdue && <Badge color="red">Overdue</Badge>}{c.anonymous && <Badge color="violet">Anonymous</Badge>}<span className="text-xs text-slate-500">{c.hidden ? 'Identity hidden' : c.student?.name} · {fmtTime(c.createdAt)}{c.room ? ` · Room ${c.room.block}-${c.room.number}` : ''}</span></div>
      <p className="whitespace-pre-wrap rounded-xl bg-mist p-4 text-sm">{c.description}</p>
      {c.photos?.length > 0 && <div className="flex gap-2">{c.photos.map((p) => <a key={p} href={p} target="_blank" rel="noreferrer"><img src={p} alt="Attachment" className="h-24 w-24 rounded-xl object-cover ring-1 ring-line" /></a>)}</div>}
      {c.assignedTo && <p className="text-sm text-slate-600">Assigned to <b>{c.assignedTo.name}</b>{c.workOrder ? ` · Work order #${c.workOrder.number} (${c.workOrder.status})` : ''}</p>}
      {c.resolution?.remarks && <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200"><b>Resolution:</b> {c.resolution.remarks}</div>}
      {mine && c.status === 'Resolved' && <div className="rounded-xl bg-brand-50 p-4 ring-1 ring-brand-200"><p className="text-sm font-semibold">Is the issue fixed?</p><p className="text-xs text-slate-600">It closes automatically 5 days after resolution if you do not respond.</p><textarea rows={2} className="input mt-3" placeholder="If not, tell us what is still wrong" value={note} onChange={(e) => setNote(e.target.value)} /><div className="mt-3 flex gap-2"><button className="btn-primary" onClick={run('respond', { action: 'confirm' }, 'Thanks. Complaint closed.')}>Yes, close it</button><button className="btn-outline" onClick={run('respond', { action: 'dispute', note }, 'Complaint reopened')}>No, reopen</button></div></div>}
      {mine && c.status === 'Closed' && <div className="flex items-center gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={run('rate', { rating: n }, 'Thanks for rating')} aria-label={`${n} stars`}><Star size={22} className={n <= (c.rating || 0) ? 'fill-brand-500 text-brand-500' : 'text-slate-300'} /></button>)}<span className="ml-2 text-sm text-slate-500">{c.rating ? 'Your rating' : 'Rate the resolution'}</span></div>}
      {!mine && open && <div className="space-y-3 rounded-xl border border-line p-4">
        {['warden', 'admin'].includes(role) && <div className="flex gap-2"><select className="input" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Assign to staff…</option>{staff.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select><button className="btn-soft" disabled={!pick} onClick={run('assign', { staffId: pick }, 'Assigned')}>Assign</button></div>}
        <div className="flex flex-wrap gap-2">{c.status !== 'In Progress' && <button className="btn-outline" onClick={run('status', {}, 'Marked in progress')}>Mark in progress</button>}</div>
        <div className="flex gap-2"><input className="input" placeholder="Resolution remarks" value={rem} onChange={(e) => setRem(e.target.value)} /><button className="btn-primary" onClick={run('resolve', { remarks: rem }, 'Marked resolved')}>Resolve</button></div></div>}
      <div><h4 className="mb-2 text-sm font-semibold">Discussion</h4><div className="space-y-2">{c.comments.map((m, i) => <div key={i} className="rounded-xl bg-mist px-4 py-2.5 text-sm"><span className="font-semibold">{m.name}</span> <span className="text-xs text-slate-500">{m.role} · {fmtTime(m.at)}</span><p>{m.text}</p></div>)}{!c.comments.length && <p className="text-sm text-slate-500">No comments yet.</p>}</div>
        {c.status !== 'Closed' && <div className="mt-3 flex gap-2"><input className="input" placeholder="Write a comment" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && text && run('comment', { text })()} /><button className="btn-soft" disabled={!text} onClick={run('comment', { text })}><Send size={16} /></button></div>}</div>
      <div><h4 className="mb-2 text-sm font-semibold">History</h4><ol className="space-y-1.5 border-l-2 border-brand-100 pl-4">{c.history.map((h, i) => <li key={i} className="text-sm"><b>{h.status}</b> <span className="text-xs text-slate-500">{fmtTime(h.at)} · {h.byName}</span>{h.note && <p className="text-slate-600">{h.note}</p>}</li>)}</ol></div>
    </div></Modal>;
}
