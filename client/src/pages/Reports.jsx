import { useState } from 'react';
import { FileDown, FileSpreadsheet, Trash2, CalendarClock } from 'lucide-react';
import { api, msg, download } from '../api';
import { useAuth } from '../auth';
import { useLoad, Loading, PageHeader, Empty, Table, Tabs, Field, toast, Badge } from '../components/ui';

const TYPES = [['occupancy', 'Occupancy'], ['fees', 'Fee collection'], ['complaints', 'Complaints'], ['visitors', 'Visitors']];
export default function Reports() {
  const { user } = useAuth(); const [type, setType] = useState('occupancy'); const [p, setP] = useState({ block: '', from: '', to: '', category: '', status: '' });
  const params = Object.fromEntries(Object.entries(p).filter(([, v]) => v));
  const rep = useLoad(() => api.get(`/reports/${type}`, { params }).then((r) => r.data), [type, JSON.stringify(p)]);
  const sch = useLoad(() => (user.role === 'admin' ? api.get('/reports/schedules').then((r) => r.data) : Promise.resolve([])), []);
  const [s, setS] = useState({ frequency: 'weekly', recipients: '' });
  const exp = (format) => download(`/reports/${type}/export?${new URLSearchParams({ ...params, format })}`, `${type}-report.${format}`).catch((e) => toast.err(msg(e)));
  const schedule = async () => { try { await api.post('/reports/schedules', { type, ...s, block: p.block, category: p.category }); toast.ok('Report scheduled'); setS({ ...s, recipients: '' }); sch.reload(); } catch (e) { toast.err(msg(e)); } };
  return (<>
    <PageHeader title="Reports" subtitle="Filter, review and export as PDF or Excel." actions={<><button className="btn-outline" onClick={() => exp('pdf')}><FileDown size={16} />PDF</button><button className="btn-primary" onClick={() => exp('xlsx')}><FileSpreadsheet size={16} />Excel</button></>} />
    <Tabs tabs={TYPES.map(([id, label]) => ({ id, label }))} value={type} onChange={(t) => { setType(t); setP({ block: '', from: '', to: '', category: '', status: '' }); }} />
    <div className="mb-5 flex flex-wrap items-end gap-3">
      {type === 'occupancy' && <Field label="Block"><input className="input !w-28" value={p.block} onChange={(e) => setP({ ...p, block: e.target.value })} /></Field>}
      <Field label={type === 'occupancy' ? 'As of date' : 'From'}>{type === 'occupancy' ? <input type="date" className="input" value={p.to} onChange={(e) => setP({ ...p, to: e.target.value })} /> : <input type="date" className="input" value={p.from} onChange={(e) => setP({ ...p, from: e.target.value })} />}</Field>
      {type !== 'occupancy' && <Field label="To"><input type="date" className="input" value={p.to} onChange={(e) => setP({ ...p, to: e.target.value })} /></Field>}
      {type === 'fees' && <><Field label="Category"><select className="input" value={p.category} onChange={(e) => setP({ ...p, category: e.target.value })}><option value="">All</option><option>General</option><option>Reserved</option></select></Field><Field label="Show"><select className="input" value={p.status} onChange={(e) => setP({ ...p, status: e.target.value })}><option value="">All invoices</option><option value="defaulters">Defaulters only</option></select></Field></>}
    </div>
    {rep.loading || !rep.data ? <Loading /> : <>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{rep.data.summary.map((x) => <div key={x.label} className="card p-4"><p className="text-xs text-slate-500">{x.label}</p><p className="font-display text-xl font-semibold">{x.value}</p></div>)}</div>
      <Table head={rep.data.columns.map((c) => c.label)} empty={rep.data.rows.length ? null : <Empty title="No records for these filters" />}>{rep.data.rows.map((r, i) => <tr key={i}>{rep.data.columns.map((c) => <td key={c.key} className="td">{r[c.key] ?? '-'}</td>)}</tr>)}</Table></>}
    {user.role === 'admin' && <div className="mt-10"><h3 className="mb-3 flex items-center gap-2 font-semibold"><CalendarClock size={18} />Scheduled reports</h3>
      <div className="card mb-4 flex flex-wrap items-end gap-3 p-5"><p className="w-full text-sm text-slate-600">E-mail the <b>{TYPES.find((t) => t[0] === type)[1].toLowerCase()}</b> report as Excel on a recurring basis (uses the filters above). Requires SMTP in <code>.env</code>.</p>
        <Field label="Frequency"><select className="input" value={s.frequency} onChange={(e) => setS({ ...s, frequency: e.target.value })}><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></Field><Field label="Recipients" className="min-w-[260px] flex-1"><input className="input" placeholder="name@college.edu, other@college.edu" value={s.recipients} onChange={(e) => setS({ ...s, recipients: e.target.value })} /></Field><button className="btn-primary" onClick={schedule}>Schedule</button></div>
      {sch.data?.length > 0 && <div className="card divide-y divide-line">{sch.data.map((x) => <div key={x._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm"><span><b className="capitalize">{x.type}</b> · <Badge color="blue">{x.frequency}</Badge> · {x.recipients.join(', ')} · next {new Date(x.nextRun).toLocaleDateString('en-IN')}</span><button className="text-slate-400 hover:text-red-600" aria-label="Delete" onClick={async () => { await api.delete(`/reports/schedules/${x._id}`); sch.reload(); }}><Trash2 size={16} /></button></div>)}</div>}</div>}
  </>);
}
