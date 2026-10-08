import { useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { api, fmtTime } from '../api';
import { useLoad, Loading, PageHeader, Empty, Table } from '../components/ui';

export default function Audit() {
  const [page, setPage] = useState(1); const [q, setQ] = useState(''); const [a, setA] = useState('');
  const { data, loading } = useLoad(() => api.get('/audit', { params: { page, q, action: a } }).then((r) => r.data), [page, q, a]);
  const v = useLoad(() => api.get('/audit/verify').then((r) => r.data), []);
  return (<><PageHeader title="Audit log" subtitle="Sign-ins, approvals and fee transactions. Entries are hash-chained so tampering is detectable." actions={v.data && <span className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold ring-1 ${v.data.ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200'}`}>{v.data.ok ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}{v.data.ok ? `Chain intact · ${v.data.total} entries` : `Broken at entry ${v.data.brokenAt}`}</span>} />
    <div className="mb-4 flex flex-wrap gap-3"><input className="input max-w-xs" placeholder="Filter by user" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /><input className="input max-w-xs" placeholder="Filter by action (e.g. LOGIN, FEE)" value={a} onChange={(e) => { setA(e.target.value); setPage(1); }} /></div>
    {loading ? <Loading /> : <Table head={['#', 'When', 'User', 'Action', 'Entity', 'Detail']} empty={data.items.length ? null : <Empty title="No entries" />}>
      {data.items.map((l) => <tr key={l._id}><td className="td text-slate-400">{l.seq}</td><td className="td whitespace-nowrap">{fmtTime(l.at)}</td><td className="td">{l.actorName || '-'}</td><td className="td font-mono text-xs font-semibold">{l.action}</td><td className="td">{l.entity}</td><td className="td max-w-xs truncate font-mono text-xs text-slate-500" title={JSON.stringify(l.detail)}>{JSON.stringify(l.detail)}</td></tr>)}</Table>}
    <div className="mt-4 flex items-center justify-end gap-3 text-sm"><span className="text-slate-500">Page {page} of {Math.max(1, Math.ceil((data?.total || 0) / 50))}</span><button className="btn-outline !py-1.5" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="btn-outline !py-1.5" disabled={page * 50 >= (data?.total || 0)} onClick={() => setPage(page + 1)}>Next</button></div></>);
}
