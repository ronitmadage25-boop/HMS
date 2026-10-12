import { useState } from 'react';
import {
  Wand2,
  Download,
  ReceiptText,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';

import { api, msg, fmtDate, download } from '../api';

import {
  useLoad,
  Loading,
  PageHeader,
  Badge,
  Empty,
  Modal,
  Field,
  toast,
  Table,
  Tabs,
} from '../components/ui';

export default function Allocation() {
  const [tab, setTab] = useState('queue');

  const apps = useLoad(
    () => api.get('/allocations/unallocated').then((r) => r.data),
    []
  );

  const rooms = useLoad(
    () => api.get('/rooms').then((r) => r.data),
    []
  );

  const list = useLoad(
    () =>
      api
        .get('/allocations', { params: { active: 1 } })
        .then((r) => r.data),
    []
  );

  const [manual, setManual] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [bed, setBed] = useState('');
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(null);

  const all = () => {
    apps.reload();
    rooms.reload();
    list.reload();
  };

  const assign = async () => {
    if (!manual || !roomId) {
      toast.err('Please select an applicant and room.');
      return;
    }

    setBusy(true);

    try {
      await api.post('/allocations', {
        applicationId: manual._id,
        roomId,
        bed: bed || undefined,
      });

      toast.ok('Room allotted and student notified.');

      setManual(null);
      setRoomId('');
      setBed('');

      all();
    } catch (e) {
      toast.err(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const preview = async () => {
    setBusy(true);

    try {
      setPlan((await api.get('/allocations/auto/preview')).data);
    } catch (e) {
      toast.err(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!plan) return;

    setBusy(true);

    try {
      const r = await api.post('/allocations/auto/confirm', {
        assignments: plan.assignments,
      });

      toast.ok(`${r.data.done} room(s) allotted.`);

      const bad = r.data.results?.find((x) => !x.ok);

      if (bad) {
        toast.err(`${bad.student}: ${bad.message}`);
      }

      setPlan(null);
      all();
    } catch (e) {
      toast.err(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const generateInvoice = async (allocation) => {
    if (!allocation?._id || invoiceBusy) return;

    if (allocation.roomConfirmationStatus !== 'Accepted') {
      toast.err('The student must accept the room before invoicing.');
      return;
    }

    const confirmed = window.confirm(
      `Generate and send the invoice for ${allocation.student?.name || 'this student'}?`
    );

    if (!confirmed) return;

    setInvoiceBusy(allocation._id);

    try {
      // This endpoint must be implemented in server/routes/fees.js.
      // await api.post(`/invoices/${allocation._id}/generate`);
      await api.post(`/fees/invoices/${allocation._id}/generate`);
      toast.ok('Invoice generated successfully.');

      await list.reload();
    } catch (e) {
      toast.err(msg(e));
    } finally {
      setInvoiceBusy(null);
    }
  };

  if (apps.loading || rooms.loading || !list.data) {
    return <Loading />;
  }

  const allocations = Array.isArray(list.data)
    ? list.data
    : list.data?.allocations || [];

  const applicants = Array.isArray(apps.data)
    ? apps.data
    : apps.data?.applications || [];

  const roomList = Array.isArray(rooms.data)
    ? rooms.data
    : rooms.data?.rooms || [];

  const fit = manual
    ? roomList.filter(
        (r) => r.available > 0 && r.status === 'Active'
      )
    : [];

  const chosen = roomList.find((r) => r._id === roomId);

  return (
    <>
      <PageHeader
        title="Room allocation"
        subtitle="Allot beds to approved applicants. Students must accept their room before an invoice can be generated."
        actions={
          <button
            className="btn-primary"
            disabled={busy || !applicants.length}
            onClick={preview}
          >
            <Wand2 size={16} />
            Auto-allocate
          </button>
        }
      />

      <Tabs
        tabs={[
          {
            id: 'queue',
            label: 'Awaiting a room',
            count: applicants.length,
          },
          {
            id: 'done',
            label: 'Allotted',
            count: allocations.length,
          },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'queue' ? (
        <Table
          head={['Applicant', 'Preference', 'Type', 'Approved', '']}
          empty={
            applicants.length ? null : (
              <Empty
                title="Nobody is waiting"
                hint="Approved applications appear here until a room is allotted."
              />
            )
          }
        >
          {applicants.map((a) => (
            <tr key={a._id}>
              <td className="td">
                <p className="font-semibold">
                  {a.student?.name}{' '}
                  <span className="font-normal text-slate-500">
                    #{a.number}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  {a.student?.username?.toUpperCase()}
                </p>
              </td>

              <td className="td">
                {a.roomTypePref} · {a.category}
              </td>

              <td className="td">
                {a.studentType === 'continuing' ? 'Continuing' : 'New'}
              </td>

              <td className="td">{fmtDate(a.decidedAt)}</td>

              <td className="td text-right">
                <button
                  className="btn-soft !py-1.5"
                  onClick={() => {
                    setManual(a);
                    setRoomId('');
                    setBed('');
                  }}
                >
                  Choose room
                </button>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Table
          head={[
            'Student',
            'Room / Bed',
            'Allotted',
            'Room confirmation',
            'Invoice',
            'Actions',
          ]}
          empty={
            allocations.length ? null : (
              <Empty title="No active allocations" />
            )
          }
        >
          {allocations.map((a) => {
            const confirmation =
              a.roomConfirmationStatus || 'Pending';

            const invoice = a.invoice || null;

            const hasInvoice =
              Boolean(a.invoiceId) ||
              Boolean(invoice?._id) ||
              Boolean(a.invoiceNo);

            const invoicePaid =
              invoice?.status === 'Paid' ||
              a.invoiceStatus === 'Paid';

            const canGenerate =
              confirmation === 'Accepted' &&
              !hasInvoice &&
              ['Allocated', 'CheckedIn'].includes(a.status);

            return (
              <tr key={a._id}>
                <td className="td">
                  <p className="font-semibold">
                    {a.student?.name || 'Unknown student'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.student?.username?.toUpperCase()}
                  </p>
                </td>

                <td className="td">
                  <p className="font-medium">
                    {a.room?.block}-{a.room?.number}
                  </p>
                  <p className="text-xs text-slate-500">
                    Floor {a.room?.floor} · Bed {a.bed}
                  </p>
                </td>

                <td className="td">{fmtDate(a.allocatedAt)}</td>

                <td className="td">
                  {confirmation === 'Accepted' ? (
                    <Badge color="green">
                      <CheckCircle2
                        size={13}
                        className="mr-1 inline"
                      />
                      Accepted
                    </Badge>
                  ) : confirmation === 'ChangeRequested' ? (
                    <div>
                      <Badge color="amber">Change requested</Badge>
                      {a.roomChangeReason && (
                        <p
                          className="mt-1 max-w-40 truncate text-xs text-slate-500"
                          title={a.roomChangeReason}
                        >
                          {a.roomChangeReason}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Badge color="amber">
                      <Clock size={13} className="mr-1 inline" />
                      Awaiting acceptance
                    </Badge>
                  )}
                </td>

                <td className="td">
                  {invoicePaid ? (
                    <Badge color="green">Paid</Badge>
                  ) : hasInvoice ? (
                    <Badge color="amber">
                      {invoice?.status || a.invoiceStatus || 'Generated'}
                    </Badge>
                  ) : (
                    <span className="text-sm text-slate-500">
                      Not generated
                    </span>
                  )}
                </td>

                <td className="td">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      className="btn-outline !py-1.5"
                      onClick={() =>
                        download(
                          `/allocations/${a._id}/letter`,
                          `${a.letterNo || 'allocation-letter'}.pdf`
                        )
                      }
                    >
                      <Download size={15} />
                      Letter
                    </button>

                    {canGenerate && (
                      <button
                        className="btn-primary !py-1.5"
                        disabled={invoiceBusy !== null}
                        onClick={() => generateInvoice(a)}
                      >
                        <ReceiptText size={15} />
                        {invoiceBusy === a._id
                          ? 'Generating...'
                          : 'Generate invoice'}
                      </button>
                    )}

                    {confirmation === 'Pending' && (
                      <span className="self-center text-xs text-slate-500">
                        Waiting for student
                      </span>
                    )}

                    {confirmation === 'ChangeRequested' && (
                      <span className="self-center text-xs text-slate-500">
                        Review room change
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      <Modal
        open={!!manual}
        onClose={() => {
          setManual(null);
          setRoomId('');
          setBed('');
        }}
        title={manual ? `Allot a bed to ${manual.student?.name}` : ''}
        footer={
          <>
            <button
              className="btn-outline"
              onClick={() => setManual(null)}
              disabled={busy}
            >
              Cancel
            </button>

            <button
              className="btn-primary"
              disabled={!roomId || busy}
              onClick={assign}
            >
              {busy ? 'Allotting...' : 'Allot bed'}
            </button>
          </>
        }
      >
        {manual && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Prefers <b>{manual.roomTypePref}</b> · {manual.category}{' '}
              category.
            </p>

            <Field label="Room" required>
              <select
                className="input"
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  setBed('');
                }}
              >
                <option value="">Select a room</option>

                {fit
                  .sort(
                    (a, b) =>
                      Number(b.type === manual.roomTypePref) -
                      Number(a.type === manual.roomTypePref)
                  )
                  .map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.block}-{r.number} · {r.type} · floor {r.floor} ·{' '}
                      {r.available} free
                      {r.type === manual.roomTypePref ? ' · matches' : ''}
                    </option>
                  ))}
              </select>
            </Field>

            {chosen && (
              <Field
                label="Bed"
                hint="Leave blank to use the first free bed."
              >
                <select
                  className="input"
                  value={bed}
                  onChange={(e) => setBed(e.target.value)}
                >
                  <option value="">First free bed</option>

                  {Array.from(
                    { length: chosen.capacity },
                    (_, i) => i + 1
                  ).map((n) => {
                    const occupied = (chosen.occupants || []).some(
                      (o) => o.bed === n
                    );

                    return (
                      <option
                        key={n}
                        value={n}
                        disabled={occupied}
                      >
                        Bed {n}
                        {occupied ? ' (occupied)' : ''}
                      </option>
                    );
                  })}
                </select>
              </Field>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!plan}
        onClose={() => !busy && setPlan(null)}
        wide
        title="Proposed allocation"
        footer={
          <>
            <button
              className="btn-outline"
              onClick={() => setPlan(null)}
              disabled={busy}
            >
              Cancel
            </button>

            <button
              className="btn-primary"
              disabled={busy || !plan?.assignments?.length}
              onClick={confirm}
            >
              {busy
                ? 'Processing...'
                : `Confirm ${plan?.assignments?.length || 0} allotment(s)`}
            </button>
          </>
        }
      >
        {plan && (
          <div className="space-y-4">
            {plan.assignments.length ? (
              <Table head={['Applicant', 'Room', 'Type']}>
                {plan.assignments.map((a) => (
                  <tr key={a.applicationId}>
                    <td className="td font-semibold">
                      {a.student}{' '}
                      <span className="font-normal text-slate-500">
                        #{a.number}
                      </span>
                    </td>
                    <td className="td">{a.room}</td>
                    <td className="td">{a.type}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty
                title="No matches found"
                hint="No free beds match the approved applicants' preferences."
              />
            )}

            {(plan.skipped || []).length > 0 && (
              <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
                <p className="font-semibold">
                  Could not place {plan.skipped.length}
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {plan.skipped.map((s) => (
                    <li key={s.applicationId}>
                      {s.student} (#{s.number}): {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
