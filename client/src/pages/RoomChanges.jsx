import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeftRight,
} from 'lucide-react';

import { api, msg, fmtTime } from '../api';

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

export default function RoomChanges() {
  const [tab, setTab] = useState('Pending');
  const [sel, setSel] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const {
    data,
    loading,
    reload,
  } = useLoad(
    () =>
      api
        .get('/allocations/room-change/list', {
          params: { status: tab },
        })
        .then((r) => r.data),
    [tab]
  );

  const requests = Array.isArray(data)
    ? data
    : data?.requests || [];

  const decide = async (approve) => {
    if (!sel || busy) return;

    const confirmed = window.confirm(
      approve
        ? 'Approve this room change? The student will be moved to the requested room.'
        : 'Are you sure you want to deny this room-change request?'
    );

    if (!confirmed) return;

    setBusy(true);

    try {
      await api.post(
        `/allocations/room-change/${sel._id}/decide`,
        {
          approve,
          note: note.trim(),
        }
      );

      toast.ok(
        approve
          ? 'Room change approved.'
          : 'Room-change request denied.'
      );

      setSel(null);
      setNote('');

      await reload();
    } catch (e) {
      toast.err(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const closeModal = () => {
    if (busy) return;

    setSel(null);
    setNote('');
  };

  return (
    <>
      <PageHeader
        title="Room changes"
        subtitle="Review room-change requests. Only an authorized warden can approve or deny a request."
      />

      <Tabs
        tabs={['Pending', 'Approved', 'Denied'].map((t) => ({
          id: t,
          label: t,
        }))}
        value={tab}
        onChange={(nextTab) => {
          setTab(nextTab);
          setSel(null);
          setNote('');
        }}
      />

      {loading ? (
        <Loading />
      ) : (
        <Table
          head={[
            'Student',
            'Current room',
            'Requested room',
            'Reason',
            'Requested',
            'Status / Action',
          ]}
          empty={
            requests.length ? null : (
              <Empty
                title={`No ${tab.toLowerCase()} requests`}
                hint={
                  tab === 'Pending'
                    ? 'New room-change requests will appear here.'
                    : 'There are no requests in this category yet.'
                }
              />
            )
          }
        >
          {requests.map((c) => (
            <tr key={c._id}>
              <td className="td">
                <p className="font-semibold">
                  {c.student?.name || 'Unknown student'}
                </p>
                <p className="text-xs text-slate-500">
                  {c.student?.username || ''}
                </p>
              </td>

              <td className="td">
                {c.allocation?.room?.block || '—'}-
                {c.allocation?.room?.number || '—'}
              </td>

              <td className="td">
                {c.requestedRoom?.block || '—'}-
                {c.requestedRoom?.number || '—'}
              </td>

              <td
                className="td max-w-xs truncate"
                title={c.reason}
              >
                {c.reason}
              </td>

              <td className="td">
                {fmtTime(c.createdAt)}
              </td>

              <td className="td">
                {c.status === 'Pending' ? (
                  <button
                    className="btn-soft !py-1.5"
                    onClick={() => {
                      setSel(c);
                      setNote('');
                    }}
                  >
                    <ArrowLeftRight size={15} />
                    Review
                  </button>
                ) : (
                  <Badge
                    color={
                      c.status === 'Approved'
                        ? 'green'
                        : c.status === 'Denied'
                          ? 'red'
                          : 'amber'
                    }
                  >
                    {c.status}
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal
        open={!!sel}
        onClose={closeModal}
        title="Review room-change request"
        footer={
          <>
            <button
              className="btn-outline"
              onClick={closeModal}
              disabled={busy}
            >
              Cancel
            </button>

            <button
              className="btn-outline"
              onClick={() => decide(false)}
              disabled={busy}
            >
              <XCircle size={16} />
              Deny
            </button>

            <button
              className="btn-primary"
              onClick={() => decide(true)}
              disabled={busy}
            >
              <CheckCircle2 size={16} />
              {busy ? 'Processing...' : 'Approve move'}
            </button>
          </>
        }
      >
        {sel && (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl bg-mist p-4">
              <p className="font-semibold">
                {sel.student?.name || 'Unknown student'}
              </p>

              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 rounded-lg bg-white p-3">
                  <p className="text-xs text-slate-500">
                    Current room
                  </p>
                  <p className="mt-1 font-semibold">
                    {sel.allocation?.room?.block}-
                    {sel.allocation?.room?.number}
                  </p>
                </div>

                <ArrowLeftRight
                  size={18}
                  className="shrink-0 text-slate-500"
                />

                <div className="flex-1 rounded-lg bg-white p-3">
                  <p className="text-xs text-slate-500">
                    Requested room
                  </p>
                  <p className="mt-1 font-semibold">
                    {sel.requestedRoom?.block}-
                    {sel.requestedRoom?.number}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 font-semibold">Student's reason</p>
              <p className="rounded-xl border border-line p-3">
                {sel.reason || 'No reason provided.'}
              </p>
            </div>

            <Field
              label="Note to the student"
              hint="Optional. This note will be saved with the decision."
            >
              <textarea
                className="input"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add an explanation or instructions..."
                disabled={busy}
              />
            </Field>

            <p className="flex items-start gap-2 text-xs text-slate-500">
              <Clock size={15} className="mt-0.5 shrink-0" />
              Approval changes the student's room allocation. Confirm that
              the requested room has an available bed before approving.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
