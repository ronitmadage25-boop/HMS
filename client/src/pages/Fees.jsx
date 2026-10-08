import { useState } from 'react';
import { Download, CreditCard, CheckCircle2, XCircle } from 'lucide-react';
import { api, msg, inr, fmtDate, fmtTime, download } from '../api';
import { useLoad, Loading, PageHeader, Badge, Empty, Modal, toast, Table } from '../components/ui';

const loadRzp = () => new Promise((res, rej) => { if (window.Razorpay) return res(); const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load Razorpay')); document.body.appendChild(s); });

export default function Fees() {
  const { data, loading, reload } = useLoad(() => api.get('/fees/mine').then((r) => r.data), []);
  const [pay, setPay] = useState(null); const [busy, setBusy] = useState(false); const [fail, setFail] = useState('');
  if (loading) return <Loading />;
  const start = async (inv, mode) => {
    setBusy(true); setFail('');
    try {
      const { data: o } = await api.post('/fees/pay/order', { invoiceId: inv._id, mode });
      if (o.mode === 'test') { setPay({ ...o, inv }); return; }
      await loadRzp();
      const rz = new window.Razorpay({ key: o.keyId, order_id: o.orderId, amount: Math.round(o.amount * 100), currency: 'INR', name: 'Hostel Fee', description: inv.invoiceNo, prefill: { name: o.name, email: o.email, contact: o.phone }, theme: { color: '#1D54D4' },
        handler: async (r) => { try { await api.post('/fees/pay/verify', { paymentId: o.paymentId, ...r }); toast.ok('Payment successful'); reload(); } catch (e) { toast.err(msg(e)); } },
        modal: { ondismiss: () => api.post('/fees/pay/fail', { paymentId: o.paymentId, reason: 'Closed without paying' }) } });
      rz.on('payment.failed', (r) => { api.post('/fees/pay/fail', { paymentId: o.paymentId, reason: r.error?.description }); setFail(r.error?.description || 'Payment failed. You can retry.'); reload(); });
      rz.open();
    } catch (e) { toast.err(msg(e)); } finally { setBusy(false); }
  };
  const confirm = async (outcome, method) => {
    setBusy(true);
    try { const r = await api.post('/fees/pay/test-confirm', { paymentId: pay.paymentId, outcome, method }); if (r.data.ok) { toast.ok('Payment successful. Receipt generated.'); setPay(null); reload(); } else { setFail(r.data.reason + '. You can retry without creating a new invoice.'); setPay(null); reload(); } } catch (e) { toast.err(msg(e)); } finally { setBusy(false); }
  };
  return (<>
    <PageHeader title="Fees & receipts" subtitle={`Session ${data.session}`} />
    {data.previousOutstanding > 0 && <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-800 ring-1 ring-red-200">Outstanding from earlier sessions: {inr(data.previousOutstanding)}</div>}
    {fail && <div role="alert" className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-800 ring-1 ring-red-200">{fail}</div>}
    {data.invoices.length === 0 ? <div className="card"><Empty title="No fee invoice yet" hint="Your invoice is generated when a room is allotted to you." /></div> : data.invoices.map((i) => (
      <div key={i._id} className="card mb-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-slate-500">{i.invoiceNo} · {i.session}</p><p className="mt-1 font-display text-3xl font-semibold">{inr(i.balance)}<span className="ml-2 text-sm font-normal text-slate-500">outstanding</span></p></div><Badge>{i.status}</Badge></div>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-4"><div><dt className="text-slate-500">Fee</dt><dd className="font-semibold">{inr(i.total)}</dd></div><div><dt className="text-slate-500">Late fee</dt><dd className="font-semibold">{inr(i.lateFee)}</dd></div><div><dt className="text-slate-500">Paid</dt><dd className="font-semibold">{inr(i.paid)}</dd></div><div><dt className="text-slate-500">Due date</dt><dd className="font-semibold">{fmtDate(i.dueDate)}</dd></div></dl>
        {i.installments.length > 1 && <div className="mt-4 flex flex-wrap gap-2">{(() => { let c = 0; return i.installments.map((a, n) => { c += a; const done = i.paid + 0.001 >= c; return <span key={n} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${done ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-mist text-slate-600 ring-line'}`}>Installment {n + 1}: {inr(a)} {done ? '· paid' : ''}</span>; }); })()}</div>}
        {i.balance > 0 && <div className="mt-5 flex flex-wrap gap-3"><button className="btn-primary" disabled={busy} onClick={() => start(i, 'full')}><CreditCard size={16} />Pay {inr(i.balance)}</button>{i.installments.length > 1 && i.nextInstallment < i.balance && <button className="btn-soft" disabled={busy} onClick={() => start(i, 'installment')}>Pay next installment {inr(i.nextInstallment)}</button>}</div>}
      </div>))}
    <h3 className="mb-3 mt-8 font-semibold">Receipts</h3>
    <Table head={['Receipt', 'Date', 'Amount', '']} empty={data.receipts.length ? null : <Empty title="No receipts yet" hint="A receipt appears right after a successful payment." />}>
      {data.receipts.map((r) => <tr key={r._id}><td className="td font-semibold">{r.number}{r.isDuplicate && <span className="ml-2"><Badge color="amber">Duplicate</Badge></span>}</td><td className="td">{fmtTime(r.createdAt)}</td><td className="td">{inr(r.amount)}</td><td className="td text-right"><button className="btn-outline !py-1.5" onClick={() => download(`/fees/receipts/${r._id}/pdf`, `${r.number}.pdf`)}><Download size={15} />PDF</button></td></tr>)}
    </Table>
    <h3 className="mb-3 mt-8 font-semibold">Payment history</h3>
    <Table head={['Date', 'Amount', 'Method', 'Reference', 'Status']} empty={data.payments.length ? null : <Empty title="No payments yet" />}>
      {data.payments.map((p) => <tr key={p._id}><td className="td">{fmtTime(p.createdAt)}</td><td className="td">{inr(p.amount)}</td><td className="td">{p.method || '-'}</td><td className="td font-mono text-xs">{p.txnRef || p.failureReason || '-'}</td><td className="td"><Badge>{p.status}</Badge></td></tr>)}
    </Table>
    <Modal open={!!pay} onClose={() => setPay(null)} title="Sandbox payment gateway">
      {pay && <div className="space-y-4"><div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-800 ring-1 ring-brand-200">Test mode: no real money moves. Set <code>PAYMENT_MODE=razorpay</code> and your keys in <code>server/.env</code> for live payments.</div>
        <p className="text-center font-display text-3xl font-semibold">{inr(pay.amount)}</p>
        <div className="grid gap-3 sm:grid-cols-3">{['Credit card', 'Debit card', 'Net banking'].map((m) => <button key={m} disabled={busy} className="btn-outline flex-col !py-4" onClick={() => confirm('success', m)}><CheckCircle2 size={18} className="text-emerald-600" />Pay by {m.toLowerCase()}</button>)}</div>
        <button className="btn-outline w-full text-red-600" disabled={busy} onClick={() => confirm('failure')}><XCircle size={16} />Simulate a declined payment</button></div>}
    </Modal></>);
}
