import { FeeStructure, Invoice, Application, Room } from '../models/index.js';
import { nextSeq, pad, money } from './helpers.js';
import { notify } from './notify.js';

export async function generateInvoice(allocation) {
  if (await Invoice.findOne({ allocation: allocation._id, status: { $ne: 'Cancelled' } })) return null;
  const room = await Room.findById(allocation.room);
  const app = allocation.application ? await Application.findById(allocation.application) : null;
  const structs = await FeeStructure.find({ session: allocation.session, roomType: room.type });
  const fs = structs.find((s) => s.category === app?.category) || structs.find((s) => s.category === 'All');
  if (!fs) return null;
  const n = fs.installments; const base = money(fs.amount / n);
  const inst = Array.from({ length: n }, (_, i) => (i === n - 1 ? money(fs.amount - base * (n - 1)) : base));
  const inv = await Invoice.create({
    invoiceNo: `INV-${new Date().getFullYear()}-${pad(await nextSeq('invoice'))}`, student: allocation.student, allocation: allocation._id, session: allocation.session,
    items: [{ label: `Hostel fee - ${room.type} room`, amount: fs.amount }], total: fs.amount, installments: inst, dueDate: fs.dueDate,
  });
  notify(allocation.student, { type: 'payment', title: 'Hostel fee invoice generated', message: `Your invoice ${inv.invoiceNo} of Rs. ${fs.amount} is due on ${fs.dueDate.toDateString()}.`, link: '/fees' });
  return inv;
}
export function nextInstallment(inv) {
  let cum = 0;
  for (const a of inv.installments) { cum += a; if (inv.paid + 0.001 < cum) return money(cum - inv.paid); }
  return inv.balance;
}
export const firstInstallmentPaid = (inv) => inv.paid + 0.001 >= (inv.installments[0] ?? inv.total);
