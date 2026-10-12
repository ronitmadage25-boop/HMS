import { useState } from 'react';
import { Download, ArrowLeftRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { api, msg, fmtDate, fmtTime, download } from '../api';
import {
  useLoad,
  Loading,
  PageHeader,
  Badge,
  Empty,
  Modal,
  Field,
  toast,
} from '../components/ui';

export default function MyRoom() {
  const {
    data,
    loading,
    reload,
  } = useLoad(
    () => api.get('/allocations/mine').then((r) => r.data),
    []
  );

  const { data: hist } = useLoad(
    () => api.get('/allocations/history').then((r) => r.data),
    []
  );

  const { data: avail } = useLoad(
    () => api.get('/rooms/available').then((r) => r.data),
    []
  );

  const {
    data: changes,
    reload: reloadChanges,
  } = useLoad(
    () => api.get('/allocations/room-change/list').then((r) => r.data),
    []
  );

  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ roomId: '', reason: '' });
  const [accepting, setAccepting] = useState(false);
  const [sending, setSending] = useState(false);

  if (loading) return <Loading />;

  const a = data?.allocation;
  const roommates = data?.roommates || [];
  const pendingChange = data?.pendingChange;

  const confirmationStatus = a?.roomConfirmationStatus || 'Pending';

  const acceptRoom = async () => {
    if (!a?._id || accepting) return;

    const confirmed = window.confirm(
      'Are you satisfied with this room allocation and ready to accept it?'
    );

    if (!confirmed) return;

    setAccepting(true);

    try {
      await api.post(`/allocations/${a._id}/confirm-room`);

      toast.ok('Room accepted successfully!');

      await reload();
      await reloadChanges();
    } catch (e) {
      toast.err(msg(e));
    } finally {
      setAccepting(false);
    }
  };

  const send = async () => {
    if (!f.roomId) {
      toast.err('Please select a room.');
      return;
    }

    if (f.reason.trim().length < 10) {
      toast.err('Please provide a reason of at least 10 characters.');
      return;
    }

    setSending(true);

    try {
      await api.post('/allocations/room-change', {
        roomId: f.roomId,
        reason: f.reason.trim(),
      });

      toast.ok('Room-change request sent to the warden.');

      setOpen(false);
      setF({ roomId: '', reason: '' });

      await reload();
      await reloadChanges();
    } catch (e) {
      toast.err(msg(e));
    } finally {
      setSending(false);
    }
  };

  const statusContent = {
    Pending: {
      title: 'Confirmation required',
      description:
        'Review your allotted room. Accept it if you are satisfied, or request a room change with a reason.',
      icon: Clock,
      className:
        'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
    },
    Accepted: {
      title: 'Room accepted',
      description:
        'You have accepted your room. The warden can now generate and send your invoice.',
      icon: CheckCircle2,
      className:
        'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
    },
    ChangeRequested: {
      title: 'Room change requested',
      description:
        'Your room-change request is being processed. Your warden will review it.',
      icon: AlertCircle,
      className:
        'bg-blue-50 text-blue-800 ring-1 ring-blue-200',
    },
  };

  const confirmation = statusContent[confirmationStatus] || statusContent.Pending;
  const ConfirmationIcon = confirmation.icon;

  return (
    <>
      <PageHeader
        title="My room"
        subtitle="Your allotment, roommates and room history."
        actions={
          a && (
            <>
              <button
                className="btn-outline"
                onClick={() =>
                  download(
                    `/allocations/${a._id}/letter`,
                    `${a.letterNo || 'allocation-letter'}.pdf`
                  )
                }
              >
                <Download size={16} />
                Allocation letter
              </button>

              {confirmationStatus !== 'Accepted' &&
                confirmationStatus !== 'ChangeRequested' &&
                !pendingChange &&
                a.status === 'Allocated' && (
                  <button
                    className="btn-outline"
                    onClick={() => setOpen(true)}
                  >
                    <ArrowLeftRight size={16} />
                    Request room change
                  </button>
                )}
            </>
          )
        }
      />

      {!a ? (
        <div className="card">
          <Empty
            title="No room allotted yet"
            hint="Once your application is approved and the warden allots a bed, your room details will appear here."
          />
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="card p-6 lg:col-span-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Allotted room</p>

                  <p className="mt-1 font-display text-4xl font-semibold">
                    {a.room?.block}-{a.room?.number}
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    Block {a.room?.block} · Floor {a.room?.floor} · Bed{' '}
                    {a.bed} · {a.room?.type}
                  </p>
                </div>

                <Badge
                  color={
                    a.status === 'CheckedIn'
                      ? 'green'
                      : a.status === 'CheckedOut' ||
                          a.status === 'Vacated'
                        ? 'red'
                        : 'amber'
                  }
                >
                  {a.status}
                </Badge>
              </div>

              <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-slate-500">Allotted on</dt>
                  <dd className="font-semibold">
                    {fmtDate(a.allocatedAt)}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Checked in</dt>
                  <dd className="font-semibold">
                    {a.checkInAt ? fmtTime(a.checkInAt) : 'Not yet'}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Letter no.</dt>
                  <dd className="font-semibold">
                    {a.letterNo || 'Not generated'}
                  </dd>
                </div>
              </dl>

              {a.status === 'Allocated' && (
                <div className={`mt-5 rounded-xl p-4 text-sm ${confirmation.className}`}>
                  <div className="flex items-start gap-2">
                    <ConfirmationIcon size={19} className="mt-0.5 shrink-0" />

                    <div>
                      <p className="font-semibold">{confirmation.title}</p>
                      <p className="mt-1">{confirmation.description}</p>
                    </div>
                  </div>
                </div>
              )}

              {a.status === 'Allocated' &&
                confirmationStatus === 'Pending' &&
                !pendingChange && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className="btn-primary"
                      disabled={accepting}
                      onClick={acceptRoom}
                    >
                      <CheckCircle2 size={16} />
                      {accepting ? 'Accepting...' : 'Accept Room'}
                    </button>

                    <button
                      className="btn-outline"
                      onClick={() => setOpen(true)}
                    >
                      <ArrowLeftRight size={16} />
                      Request Room Change
                    </button>
                  </div>
                )}

              {confirmationStatus === 'Accepted' && (
                <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200">
                  <p className="font-semibold">
                    <CheckCircle2 size={16} className="mr-2 inline" />
                    Room accepted successfully
                  </p>
                  <p className="mt-1">
                    Wait for the warden to generate your invoice. Follow the
                    invoice instructions to complete payment before check-in.
                  </p>
                </div>
              )}

              {confirmationStatus === 'ChangeRequested' && (
                <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-200">
                  <p className="font-semibold">Room change under review</p>
                  {a.roomChangeReason && (
                    <p className="mt-1">
                      Your reason: {a.roomChangeReason}
                    </p>
                  )}
                  <p className="mt-1">
                    You can continue using your current allocation details
                    while the warden reviews the request.
                  </p>
                </div>
              )}

              {pendingChange && (
                <div className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800 ring-1 ring-blue-200">
                  Your request to move to room{' '}
                  {pendingChange.requestedRoom?.block}-
                  {pendingChange.requestedRoom?.number} is waiting for the
                  warden.
                </div>
              )}

              {a.status === 'Allocated' &&
                confirmationStatus === 'Accepted' && (
                  <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
                    Check-in requires an invoice and payment of the first
                    installment. Please follow the instructions from your
                    warden.
                  </p>
                )}
            </div>

            <div className="card p-6">
              <h3 className="mb-3 font-semibold">Roommates</h3>

              {roommates.length ? (
                <ul className="space-y-3">
                  {roommates.map((m, i) => (
                    <li key={m._id || i} className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                        {m.name?.[0] || '?'}
                      </span>

                      <div>
                        <p className="text-sm font-semibold">{m.name}</p>
                        <p className="text-xs text-slate-500">
                          {m.department}
                          {m.phone ? ` · ${m.phone}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  No one else is assigned to this room yet.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {changes?.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 font-semibold">Room-change requests</h3>

          <div className="card divide-y divide-line">
            {changes.map((c) => (
              <div
                key={c._id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <div>
                  <p>
                    To {c.requestedRoom?.block}-{c.requestedRoom?.number}
                  </p>
                  <p className="text-slate-500">{c.reason}</p>

                  {c.decisionNote && (
                    <p className="mt-1 text-slate-500">
                      Warden: {c.decisionNote}
                    </p>
                  )}
                </div>

                <Badge>{c.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {hist?.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 font-semibold">Room history</h3>

          <div className="card divide-y divide-line">
            {hist.map((h) => (
              <div
                key={h._id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <span>
                  {h.session} · {h.room?.block}-{h.room?.number}, bed {h.bed}
                </span>

                <span className="flex items-center gap-3 text-slate-500">
                  {h.endReason || ''}
                  {fmtDate(h.endedAt || h.allocatedAt)}
                  <Badge>{h.status}</Badge>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Request a room change"
        footer={
          <>
            <button
              className="btn-outline"
              onClick={() => setOpen(false)}
              disabled={sending}
            >
              Cancel
            </button>

            <button
              className="btn-primary"
              onClick={send}
              disabled={sending || !f.roomId || f.reason.trim().length < 10}
            >
              {sending ? 'Sending...' : 'Send request'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Room you want" required>
            <select
              className="input"
              value={f.roomId}
              onChange={(e) =>
                setF({ ...f, roomId: e.target.value })
              }
            >
              <option value="">Choose a room with a free bed</option>

              {(avail || [])
                .filter((r) => r._id !== a?.room?._id)
                .map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.block}-{r.number} · {r.type} · floor {r.floor} ·{' '}
                    {r.available} free
                  </option>
                ))}
            </select>
          </Field>

          <Field
            label="Reason"
            required
            hint="Please explain why you need a room change. Minimum 10 characters."
          >
            <textarea
              rows={3}
              className="input"
              value={f.reason}
              onChange={(e) =>
                setF({ ...f, reason: e.target.value })
              }
              placeholder="Enter your reason..."
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
