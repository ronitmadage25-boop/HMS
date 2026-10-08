import { useState } from 'react';
import { LogIn, LogOut, UserMinus, Search } from 'lucide-react';
import { api, msg, fmtTime, fmtDate } from '../api';
import { useAuth } from '../auth';
import { useLoad, Loading, PageHeader, Badge, Empty, Modal, Field, toast, Table, Tabs } from '../components/ui';

export default function Occupancy() {
  const { user } = useAuth(); const canVacate = ['warden', 'admin'].includes(user.role); const [tab, setTab] = useState('active'); const [q, setQ] = useState(''); const [vac, setVac] = useState(null); const [reason, setReason] = useState('Course completion');
  const { data, loading, reload } = useLoad(() => api.get('/allocations', { params: tab === 'active' ? { active: 1 } : { status: tab } }).then((r) => r.data), [tab], 15000);
  const act = async (a, what) => { try { await api.post(`/allocations/${a._id}/${what}`); toast.ok(what === 'checkin' ? 'Check-in recorded' : 'Check-out recorded'); reload(); } catch (e) { toast.err(msg(e)); } };
  const vacate = async () => { try { await api.post(`/allocations/${vac._id}/vacate`, { reason }); toast.ok('Bed vacated'); setVac(null); reload(); } catch (e) { toast.err(msg(e)); } };
  const rows = (data || []).filter((a) => `${a.student?.name} ${a.student?.username} ${a.room?.number}`.toLowerCase().includes(q.toLowerCase()));
  return (<>
    <PageHeader title={user.role === 'staff' ? 'Check-in and check-out' : 'Occupancy'} subtitle="Who is in which bed. Allocations not checked in within 7 days are flagged as no-shows and released." />
    <Tabs tabs={[{ id: 'active', label: 'Current' }, { id: 'NoShow', label: 'No-shows' }, { id: 'CheckedOut', label: 'Checked out' }, { id: 'Vacated', label: 'Vacated' }]} value={tab} onChange={setTab} />
    <div className="relative mb-4 max-w-sm"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-10" placeholder="Search student or room" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    {loading ? <Loading /> : <Table head={['Student', 'Room', 'Allotted', 'Check-in', 'Status', '']} empty={rows.length ? null : <Empty title="Nothing to show" />}>
      {rows.map((a) => <tr key={a._id}><td className="td"><p className="font-semibold">{a.student?.name}</p><p className="text-xs text-slate-500">{a.student?.username?.toUpperCase()}</p></td><td className="td">{a.room.block}-{a.room.number}, bed {a.bed}</td><td className="td">{fmtDate(a.allocatedAt)}</td><td className="td">{fmtTime(a.checkInAt)}</td><td className="td"><Badge>{a.status}</Badge></td>
        <td className="td"><div className="flex justify-end gap-2">{a.status === 'Allocated' && <button className="btn-primary !py-1.5" onClick={() => act(a, 'checkin')}><LogIn size={15} />Check in</button>}{a.status === 'CheckedIn' && <button className="btn-outline !py-1.5" onClick={() => act(a, 'checkout')}><LogOut size={15} />Check out</button>}{canVacate && ['Allocated', 'CheckedIn'].includes(a.status) && <button className="btn-outline !py-1.5 text-red-600" onClick={() => setVac(a)}><UserMinus size={15} />Vacate</button>}</div></td></tr>)}</Table>}
    <Modal open={!!vac} onClose={() => setVac(null)} title="Vacate bed" footer={<><button className="btn-outline" onClick={() => setVac(null)}>Cancel</button><button className="btn-danger" onClick={vacate}>Vacate</button></>}>
      <Field label={`Reason for vacating ${vac?.student?.name}`}><select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>{['Course completion', 'Withdrawal', 'Disciplinary action'].map((r) => <option key={r}>{r}</option>)}</select></Field></Modal></>);
}
