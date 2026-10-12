// import { Router } from 'express';
// import crypto from 'crypto';
// import Razorpay from 'razorpay';
// import { FeeStructure, Invoice, Payment, Receipt, Refund, Allocation, User } from '../models/index.js';
// import { protect, allow } from '../middleware/auth.js';
// import { HttpError, getSettings, nextSeq, pad, money } from '../utils/helpers.js';
// import { notify } from '../utils/notify.js';
// import { audit } from '../utils/audit.js';
// import { sendMail } from '../utils/mailer.js';
// import { generateInvoice, nextInstallment } from '../utils/fees.js';
// import { receiptPdf } from '../utils/pdf.js';

// const r = Router(); r.use(protect);
// const live = () => process.env.PAYMENT_MODE === 'razorpay' && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
// const rzp = () => new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });

// r.get('/config', (req, res) => res.json({ mode: live() ? 'razorpay' : 'test', keyId: live() ? process.env.RAZORPAY_KEY_ID : null }));

// r.get('/mine', allow('student'), async (req, res) => {
//   const s = await getSettings();
//   const invoices = await Invoice.find({ student: req.user._id, status: { $ne: 'Cancelled' } }).sort('-createdAt').lean();
//   for (const i of invoices) { i.nextInstallment = i.balance > 0 ? nextInstallment(i) : 0; }
//   const payments = await Payment.find({ student: req.user._id }).sort('-createdAt').limit(50);
//   const receipts = await Receipt.find({ student: req.user._id }).sort('-createdAt');
//   const previousOutstanding = invoices.filter((i) => i.session !== s.session).reduce((t, i) => t + i.balance, 0);
//   res.json({ invoices, payments, receipts, previousOutstanding: money(previousOutstanding), session: s.session });
// });

// // ---- Payments
// r.post('/pay/order', allow('student'), async (req, res) => {
//   const inv = await Invoice.findOne({ _id: req.body.invoiceId, student: req.user._id });
//   if (!inv || inv.status === 'Cancelled') throw new HttpError(404, 'Invoice not found');
//   if (inv.balance <= 0) throw new HttpError(400, 'This invoice is already paid');
//   const amount = req.body.mode === 'installment' ? nextInstallment(inv) : inv.balance;
//   const p = await Payment.create({ invoice: inv._id, student: req.user._id, amount });
//   if (live()) {
//     const order = await rzp().orders.create({ amount: Math.round(amount * 100), currency: 'INR', receipt: String(p._id).slice(-20), notes: { invoice: inv.invoiceNo } });
//     p.gatewayOrderId = order.id; await p.save();
//     return res.json({ mode: 'razorpay', paymentId: p._id, orderId: order.id, keyId: process.env.RAZORPAY_KEY_ID, amount, name: req.user.name, email: req.user.email, phone: req.user.phone });
//   }
//   res.json({ mode: 'test', paymentId: p._id, amount });
// });
// async function finalize(p, txnRef, method) {
//   if (p.status === 'Success') return;
//   p.status = 'Success'; p.txnRef = txnRef; p.method = method; p.paidAt = new Date(); await p.save();
//   const inv = await Invoice.findById(p.invoice); inv.paid = money(inv.paid + p.amount); await inv.save();
//   const rc = await Receipt.create({ number: `RCP-${new Date().getFullYear()}-${pad(await nextSeq('receipt'), 6)}`, payment: p._id, invoice: inv._id, student: p.student, amount: p.amount });
//   notify(p.student, { type: 'payment', title: 'Payment received', message: `Rs. ${p.amount} received against ${inv.invoiceNo}. Receipt ${rc.number} is ready.`, link: '/fees' });
//   audit({ _id: p.student }, 'FEE_PAID', 'Payment', p._id, { amount: p.amount, txnRef, invoice: inv.invoiceNo });
//   try {
//     const full = await Receipt.findById(rc._id).populate('student', 'name username email').populate('invoice').populate('payment');
//     const pdf = await receiptPdf(full, (await getSettings()).institution);
//     sendMail({ to: full.student.email, subject: `Receipt ${rc.number}`, html: `<p>Hi ${full.student.name}, your payment of Rs. ${p.amount} was received. Your receipt is attached.</p>`, attachments: [{ filename: `${rc.number}.pdf`, content: pdf }] }).catch(() => {});
//   } catch (e) { console.error('receipt mail failed', e.message); }
// }
// r.post('/pay/verify', allow('student'), async (req, res) => {
//   const p = await Payment.findOne({ _id: req.body.paymentId, student: req.user._id }); if (!p) throw new HttpError(404, 'Payment not found');
//   const { razorpay_payment_id: pid, razorpay_order_id: oid, razorpay_signature: sig } = req.body;
//   const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '').update(`${oid}|${pid}`).digest('hex');
//   if (!live() || oid !== p.gatewayOrderId || expected !== sig) { p.status = 'Failed'; p.failureReason = 'Signature verification failed'; await p.save(); throw new HttpError(400, 'Payment could not be verified'); }
//   let method = 'Razorpay'; try { method = (await rzp().payments.fetch(pid)).method || method; } catch { /* keep default */ }
//   await finalize(p, pid, method); res.json({ ok: true });
// });
// r.post('/pay/fail', allow('student'), async (req, res) => {
//   const p = await Payment.findOne({ _id: req.body.paymentId, student: req.user._id }); if (!p || p.status === 'Success') return res.json({ ok: true });
//   p.status = 'Failed'; p.failureReason = req.body.reason || 'Payment declined'; await p.save(); res.json({ ok: true });
// });
// r.post('/pay/test-confirm', allow('student'), async (req, res) => {
//   if (live()) throw new HttpError(400, 'Test gateway is disabled in Razorpay mode');
//   const p = await Payment.findOne({ _id: req.body.paymentId, student: req.user._id }); if (!p) throw new HttpError(404, 'Payment not found');
//   if (req.body.outcome !== 'success') { p.status = 'Failed'; p.failureReason = 'Declined by test gateway'; await p.save(); return res.json({ ok: false, reason: p.failureReason }); }
//   await finalize(p, 'TEST-' + crypto.randomBytes(5).toString('hex').toUpperCase(), req.body.method || 'Test card'); res.json({ ok: true });
// });

// // ---- Receipts
// r.get('/receipts/:id/pdf', async (req, res) => {
//   const rc = await Receipt.findById(req.params.id).populate('student', 'name username').populate('invoice').populate('payment');
//   if (!rc || (req.user.role === 'student' && String(rc.student._id) !== String(req.user._id))) throw new HttpError(404, 'Receipt not found');
//   const pdf = await receiptPdf(rc, (await getSettings()).institution);
//   res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${rc.number}.pdf"` }).send(pdf);
// });
// r.post('/receipts/:id/duplicate', allow('admin'), async (req, res) => {
//   const o = await Receipt.findById(req.params.id); if (!o) throw new HttpError(404, 'Receipt not found');
//   const d = await Receipt.create({ number: `${o.number}-D${(await Receipt.countDocuments({ duplicateOf: o._id })) + 1}`, payment: o.payment, invoice: o.invoice, student: o.student, amount: o.amount, isDuplicate: true, duplicateOf: o._id, issuedBy: req.user._id });
//   audit(req.user, 'RECEIPT_DUPLICATE', 'Receipt', d._id, { of: o.number }, req.ip); res.status(201).json(d);
// });

// // ---- Admin
// r.use(allow('admin'));
// r.get('/structures', async (req, res) => res.json(await FeeStructure.find().sort('-sessionStart roomType')));
// r.post('/structures', async (req, res) => {
//   const b = req.body; if (!b.session || !b.roomType || b.amount === undefined || !b.dueDate || !b.sessionStart) throw new HttpError(400, 'Session, room type, amount, due date and session start date are required');
//   if (new Date(b.sessionStart) <= new Date()) throw new HttpError(400, 'Fee structures can only be created for sessions that have not yet commenced');
//   const f = await FeeStructure.create({ session: b.session, roomType: b.roomType, category: b.category || 'All', amount: Number(b.amount), installments: Number(b.installments) || 1, dueDate: b.dueDate, sessionStart: b.sessionStart });
//   audit(req.user, 'FEE_STRUCTURE_CREATED', 'FeeStructure', f._id, b, req.ip); res.status(201).json(f);
// });
// r.put('/structures/:id', async (req, res) => {
//   const f = await FeeStructure.findById(req.params.id); if (!f) throw new HttpError(404, 'Not found');
//   if (f.sessionStart <= new Date()) throw new HttpError(409, 'This session has already commenced. Fee changes apply only to sessions that have not yet started.');
//   ['amount', 'installments', 'dueDate', 'sessionStart', 'category'].forEach((k) => { if (req.body[k] !== undefined) f[k] = req.body[k]; });
//   await f.save(); audit(req.user, 'FEE_STRUCTURE_UPDATED', 'FeeStructure', f._id, req.body, req.ip); res.json(f);
// });
// r.delete('/structures/:id', async (req, res) => {
//   const f = await FeeStructure.findById(req.params.id); if (!f) throw new HttpError(404, 'Not found');
//   if (f.sessionStart <= new Date()) throw new HttpError(409, 'This session has already commenced and its fee structure cannot be removed.');
//   await f.deleteOne(); audit(req.user, 'FEE_STRUCTURE_DELETED', 'FeeStructure', f._id, {}, req.ip); res.json({ ok: true });
// });
// r.get('/invoices', async (req, res) => {
//   const f = {}; if (req.query.status) f.status = req.query.status;
//   let list = await Invoice.find(f).populate('student', 'name username').sort('-createdAt').limit(500);
//   if (req.query.q) { const q = req.query.q.toLowerCase(); list = list.filter((i) => `${i.student?.name} ${i.student?.username} ${i.invoiceNo}`.toLowerCase().includes(q)); }
//   res.json(list);
// });
// r.post('/invoices/generate', async (req, res) => {
//   const allocs = await Allocation.find({ status: { $in: ['Allocated', 'CheckedIn'] } }); let created = 0;
//   for (const a of allocs) if (await generateInvoice(a)) created++;
//   audit(req.user, 'INVOICES_GENERATED', 'Invoice', null, { created }, req.ip); res.json({ created });
// });
// r.post('/refund', async (req, res) => {
//   const inv = await Invoice.findById(req.body.invoiceId); if (!inv) throw new HttpError(404, 'Invoice not found');
//   const amount = money(req.body.amount); if (!(amount > 0) || amount > inv.paid) throw new HttpError(400, `Refund must be between 0 and the amount paid (Rs. ${inv.paid})`);
//   if (!req.body.reason) throw new HttpError(400, 'Enter a reason for the refund');
//   const rf = await Refund.create({ invoice: inv._id, student: inv.student, amount, reason: req.body.reason, txnRef: 'RF-' + crypto.randomBytes(5).toString('hex').toUpperCase(), by: req.user._id });
//   inv.paid = money(inv.paid - amount); if (req.body.cancelInvoice) { inv.status = 'Cancelled'; } await inv.save();
//   notify(inv.student, { type: 'payment', title: 'Refund recorded', message: `Rs. ${amount} was refunded against ${inv.invoiceNo}. Reference ${rf.txnRef}.`, link: '/fees' });
//   audit(req.user, 'FEE_REFUND', 'Refund', rf._id, { amount, invoice: inv.invoiceNo }, req.ip); res.status(201).json(rf);
// });
// r.get('/refunds', async (req, res) => res.json(await Refund.find().populate('student', 'name username').populate('invoice', 'invoiceNo').sort('-createdAt').limit(200)));
// export default r;



import { Router } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';

import {
  FeeStructure,
  Invoice,
  Payment,
  Receipt,
  Refund,
  Allocation,
  User,
  ACTIVE,
} from '../models/index.js';

import { protect, allow } from '../middleware/auth.js';
import {
  HttpError,
  getSettings,
  nextSeq,
  pad,
  money,
} from '../utils/helpers.js';

import { notify } from '../utils/notify.js';
import { audit } from '../utils/audit.js';
import { sendMail } from '../utils/mailer.js';
import { generateInvoice, nextInstallment } from '../utils/fees.js';
import { receiptPdf } from '../utils/pdf.js';

const r = Router();
r.use(protect);

const live = () =>
  process.env.PAYMENT_MODE === 'razorpay' &&
  process.env.RAZORPAY_KEY_ID &&
  process.env.RAZORPAY_KEY_SECRET;

const rzp = () =>
  new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

const wardenCanSee = (user, block) =>
  user.role === 'admin' ||
  !user.blocks?.length ||
  user.blocks.includes(block);


// =====================================================
// PAYMENT CONFIG
// =====================================================

r.get('/config', (_req, res) => {
  res.json({
    mode: live() ? 'razorpay' : 'test',
    keyId: live() ? process.env.RAZORPAY_KEY_ID : null,
  });
});


// =====================================================
// STUDENT: VIEW INVOICES, PAYMENTS AND RECEIPTS
// =====================================================

r.get('/mine', allow('student'), async (req, res) => {
  const settings = await getSettings();

  const invoices = await Invoice.find({
    student: req.user._id,
    status: { $ne: 'Cancelled' },
  })
    .sort('-createdAt')
    .lean();

  for (const invoice of invoices) {
    invoice.nextInstallment =
      invoice.balance > 0 ? nextInstallment(invoice) : 0;
  }

  const payments = await Payment.find({
    student: req.user._id,
  })
    .sort('-createdAt')
    .limit(50);

  const receipts = await Receipt.find({
    student: req.user._id,
  }).sort('-createdAt');

  const previousOutstanding = invoices
    .filter((invoice) => invoice.session !== settings.session)
    .reduce((total, invoice) => total + invoice.balance, 0);

  res.json({
    invoices,
    payments,
    receipts,
    previousOutstanding: money(previousOutstanding),
    session: settings.session,
  });
});


// =====================================================
// STUDENT: CREATE PAYMENT ORDER
// =====================================================

r.post('/pay/order', allow('student'), async (req, res) => {
  const invoice = await Invoice.findOne({
    _id: req.body.invoiceId,
    student: req.user._id,
  });

  if (!invoice || invoice.status === 'Cancelled') {
    throw new HttpError(404, 'Invoice not found');
  }

  if (invoice.balance <= 0) {
    throw new HttpError(400, 'This invoice is already paid');
  }

  const amount =
    req.body.mode === 'installment'
      ? nextInstallment(invoice)
      : invoice.balance;

  if (!(amount > 0) || amount > invoice.balance) {
    throw new HttpError(400, 'Invalid payment amount');
  }

  const payment = await Payment.create({
    invoice: invoice._id,
    student: req.user._id,
    amount,
  });

  if (live()) {
    const order = await rzp().orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: String(payment._id).slice(-20),
      notes: {
        invoice: invoice.invoiceNo,
      },
    });

    payment.gatewayOrderId = order.id;
    await payment.save();

    return res.json({
      mode: 'razorpay',
      paymentId: payment._id,
      orderId: order.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      amount,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
    });
  }

  res.json({
    mode: 'test',
    paymentId: payment._id,
    amount,
  });
});


// =====================================================
// FINALIZE SUCCESSFUL PAYMENT
// =====================================================

async function finalize(payment, txnRef, method) {
  // Avoid duplicate receipts or charging an invoice twice
  // for the same payment record.
  if (payment.status === 'Success') return;

  const invoice = await Invoice.findById(payment.invoice);

  if (!invoice || invoice.status === 'Cancelled') {
    throw new HttpError(400, 'Invoice is unavailable');
  }

  if (payment.amount > invoice.balance) {
    throw new HttpError(
      400,
      'Payment amount exceeds the outstanding invoice balance',
    );
  }

  payment.status = 'Success';
  payment.txnRef = txnRef;
  payment.method = method;
  payment.paidAt = new Date();

  await payment.save();

  invoice.paid = money(invoice.paid + payment.amount);
  await invoice.save();

  const receipt = await Receipt.create({
    number: `RCP-${new Date().getFullYear()}-${pad(
      await nextSeq('receipt'),
      6,
    )}`,
    payment: payment._id,
    invoice: invoice._id,
    student: payment.student,
    amount: payment.amount,
  });

  notify(payment.student, {
    type: 'payment',
    title: 'Payment received',
    message: `Rs. ${payment.amount} received against ${invoice.invoiceNo}. Receipt ${receipt.number} is ready.`,
    link: '/fees',
  });

  audit(
    { _id: payment.student },
    'FEE_PAID',
    'Payment',
    payment._id,
    {
      amount: payment.amount,
      txnRef,
      invoice: invoice.invoiceNo,
    },
  );

  try {
    const fullReceipt = await Receipt.findById(receipt._id)
      .populate('student', 'name username email')
      .populate('invoice')
      .populate('payment');

    const pdf = await receiptPdf(
      fullReceipt,
      (await getSettings()).institution,
    );

    sendMail({
      to: fullReceipt.student.email,
      subject: `Receipt ${receipt.number}`,
      html: `<p>Hi ${fullReceipt.student.name}, your payment of Rs. ${payment.amount} was received. Your receipt is attached.</p>`,
      attachments: [
        {
          filename: `${receipt.number}.pdf`,
          content: pdf,
        },
      ],
    }).catch(() => {});
  } catch (error) {
    console.error('Receipt mail failed', error.message);
  }
}


// =====================================================
// RAZORPAY: VERIFY PAYMENT SIGNATURE
// =====================================================

r.post('/pay/verify', allow('student'), async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.body.paymentId,
    student: req.user._id,
  });

  if (!payment) {
    throw new HttpError(404, 'Payment not found');
  }

  if (payment.status === 'Success') {
    return res.json({ ok: true });
  }

  const {
    razorpay_payment_id: paymentId,
    razorpay_order_id: orderId,
    razorpay_signature: signature,
  } = req.body;

  const expected = crypto
    .createHmac(
      'sha256',
      process.env.RAZORPAY_KEY_SECRET || '',
    )
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const signaturesMatch =
    typeof signature === 'string' &&
    signature.length === expected.length &&
    crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );

  if (
    !live() ||
    orderId !== payment.gatewayOrderId ||
    !signaturesMatch
  ) {
    payment.status = 'Failed';
    payment.failureReason = 'Signature verification failed';
    await payment.save();

    throw new HttpError(
      400,
      'Payment could not be verified',
    );
  }

  // Fetch the payment from Razorpay and confirm it belongs
  // to the expected order and has been captured.
  let gatewayPayment;

  try {
    gatewayPayment = await rzp().payments.fetch(paymentId);
  } catch {
    throw new HttpError(
      400,
      'Could not verify payment with Razorpay',
    );
  }

  if (
    gatewayPayment.order_id !== orderId ||
    gatewayPayment.status !== 'captured' ||
    Number(gatewayPayment.amount) !==
      Math.round(payment.amount * 100)
  ) {
    throw new HttpError(
      400,
      'Razorpay payment details do not match the order',
    );
  }

  await finalize(
    payment,
    paymentId,
    gatewayPayment.method || 'Razorpay',
  );

  res.json({ ok: true });
});


// =====================================================
// PAYMENT FAILURE
// =====================================================

r.post('/pay/fail', allow('student'), async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.body.paymentId,
    student: req.user._id,
  });

  if (!payment || payment.status === 'Success') {
    return res.json({ ok: true });
  }

  payment.status = 'Failed';
  payment.failureReason =
    req.body.reason || 'Payment declined';

  await payment.save();

  res.json({ ok: true });
});


// =====================================================
// TEST GATEWAY CONFIRMATION
// =====================================================

r.post('/pay/test-confirm', allow('student'), async (req, res) => {
  if (live()) {
    throw new HttpError(
      400,
      'Test gateway is disabled in Razorpay mode',
    );
  }

  const payment = await Payment.findOne({
    _id: req.body.paymentId,
    student: req.user._id,
  });

  if (!payment) {
    throw new HttpError(404, 'Payment not found');
  }

  if (payment.status === 'Success') {
    return res.json({ ok: true });
  }

  if (req.body.outcome !== 'success') {
    payment.status = 'Failed';
    payment.failureReason = 'Declined by test gateway';

    await payment.save();

    return res.json({
      ok: false,
      reason: payment.failureReason,
    });
  }

  await finalize(
    payment,
    `TEST-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
    req.body.method || 'Test card',
  );

  res.json({ ok: true });
});


// =====================================================
// RECEIPTS
// =====================================================

r.get('/receipts/:id/pdf', async (req, res) => {
  const receipt = await Receipt.findById(req.params.id)
    .populate('student', 'name username')
    .populate('invoice')
    .populate('payment');

  if (
    !receipt ||
    (
      req.user.role === 'student' &&
      String(receipt.student._id) !== String(req.user._id)
    )
  ) {
    throw new HttpError(404, 'Receipt not found');
  }

  if (
    req.user.role === 'warden' &&
    receipt.invoice?.allocation
  ) {
    const allocation = await Allocation.findById(
      receipt.invoice.allocation,
    ).populate('room');

    if (
      allocation &&
      !wardenCanSee(req.user, allocation.room.block)
    ) {
      throw new HttpError(403, 'Access denied');
    }
  }

  const pdf = await receiptPdf(
    receipt,
    (await getSettings()).institution,
  );

  res
    .set({
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        `attachment; filename="${receipt.number}.pdf"`,
    })
    .send(pdf);
});

r.post('/receipts/:id/duplicate', allow('admin'), async (req, res) => {
  const original = await Receipt.findById(req.params.id);

  if (!original) {
    throw new HttpError(404, 'Receipt not found');
  }

  const duplicate = await Receipt.create({
    number: `${original.number}-D${
      (await Receipt.countDocuments({
        duplicateOf: original._id,
      })) + 1
    }`,
    payment: original.payment,
    invoice: original.invoice,
    student: original.student,
    amount: original.amount,
    isDuplicate: true,
    duplicateOf: original._id,
    issuedBy: req.user._id,
  });

  audit(
    req.user,
    'RECEIPT_DUPLICATE',
    'Receipt',
    duplicate._id,
    { of: original.number },
    req.ip,
  );

  res.status(201).json(duplicate);
});


// =====================================================
// WARDEN + ADMIN: GENERATE ONE INVOICE
// POST /invoices/:allocationId/generate
//
// Must be declared BEFORE r.use(allow('admin')).
// =====================================================

r.post(
  '/invoices/:allocationId/generate',
  allow('warden', 'admin'),
  async (req, res) => {
    const allocation = await Allocation.findById(
      req.params.allocationId,
    ).populate('room');

    if (!allocation) {
      throw new HttpError(404, 'Allocation not found');
    }

    if (!ACTIVE.includes(allocation.status)) {
      throw new HttpError(
        400,
        'An invoice can only be generated for an active allocation',
      );
    }

    if (
      req.user.role === 'warden' &&
      !wardenCanSee(req.user, allocation.room.block)
    ) {
      throw new HttpError(
        403,
        "This allocation belongs to another warden's block",
      );
    }

    if (
      allocation.roomConfirmationStatus !== 'Accepted'
    ) {
      throw new HttpError(
        409,
        'The student must accept the allocated room before an invoice can be generated',
      );
    }

    const existingInvoice = await Invoice.findOne({
      allocation: allocation._id,
      status: { $ne: 'Cancelled' },
    });

    if (existingInvoice) {
      throw new HttpError(
        409,
        'An active invoice already exists for this allocation',
      );
    }

    const created = await generateInvoice(allocation);

    // Re-query because generateInvoice's return value may be
    // a boolean rather than the created Invoice document.
    const invoice = await Invoice.findOne({
      allocation: allocation._id,
      status: { $ne: 'Cancelled' },
    });

    if (!invoice) {
      throw new HttpError(
        400,
        'Invoice could not be generated. Check the fee structure for this session and room type.',
      );
    }

    audit(
      req.user,
      'INVOICE_GENERATED',
      'Invoice',
      invoice._id,
      {
        allocation: allocation._id,
        student: allocation.student,
        created: Boolean(created),
      },
      req.ip,
    );

    notify(allocation.student, {
      type: 'payment',
      title: 'Hostel fee invoice generated',
      message: `Your hostel fee invoice ${invoice.invoiceNo} is ready. Please review it and complete the required payment before check-in.`,
      link: '/fees',
    });

    res.status(201).json({
      message: 'Invoice generated successfully',
      invoice,
    });
  },
);


// =====================================================
// ADMIN-ONLY ROUTES START HERE
// =====================================================

r.use(allow('admin'));


// =====================================================
// FEE STRUCTURES
// =====================================================

r.get('/structures', async (_req, res) => {
  res.json(
    await FeeStructure.find().sort('-sessionStart roomType'),
  );
});

r.post('/structures', async (req, res) => {
  const body = req.body;

  if (
    !body.session ||
    !body.roomType ||
    body.amount === undefined ||
    !body.dueDate ||
    !body.sessionStart
  ) {
    throw new HttpError(
      400,
      'Session, room type, amount, due date and session start date are required',
    );
  }

  if (new Date(body.sessionStart) <= new Date()) {
    throw new HttpError(
      400,
      'Fee structures can only be created for sessions that have not yet commenced',
    );
  }

  const structure = await FeeStructure.create({
    session: body.session,
    roomType: body.roomType,
    category: body.category || 'All',
    amount: Number(body.amount),
    installments: Number(body.installments) || 1,
    dueDate: body.dueDate,
    sessionStart: body.sessionStart,
  });

  audit(
    req.user,
    'FEE_STRUCTURE_CREATED',
    'FeeStructure',
    structure._id,
    body,
    req.ip,
  );

  res.status(201).json(structure);
});

r.put('/structures/:id', async (req, res) => {
  const structure = await FeeStructure.findById(req.params.id);

  if (!structure) {
    throw new HttpError(404, 'Not found');
  }

  if (structure.sessionStart <= new Date()) {
    throw new HttpError(
      409,
      'This session has already commenced. Fee changes apply only to sessions that have not yet started.',
    );
  }

  [
    'amount',
    'installments',
    'dueDate',
    'sessionStart',
    'category',
  ].forEach((key) => {
    if (req.body[key] !== undefined) {
      structure[key] = req.body[key];
    }
  });

  await structure.save();

  audit(
    req.user,
    'FEE_STRUCTURE_UPDATED',
    'FeeStructure',
    structure._id,
    req.body,
    req.ip,
  );

  res.json(structure);
});

r.delete('/structures/:id', async (req, res) => {
  const structure = await FeeStructure.findById(req.params.id);

  if (!structure) {
    throw new HttpError(404, 'Not found');
  }

  if (structure.sessionStart <= new Date()) {
    throw new HttpError(
      409,
      'This session has already commenced and its fee structure cannot be removed.',
    );
  }

  await structure.deleteOne();

  audit(
    req.user,
    'FEE_STRUCTURE_DELETED',
    'FeeStructure',
    structure._id,
    {},
    req.ip,
  );

  res.json({ ok: true });
});


// =====================================================
// ADMIN: LIST INVOICES
// =====================================================

r.get('/invoices', async (req, res) => {
  const filter = {};

  if (req.query.status) {
    filter.status = req.query.status;
  }

  let invoices = await Invoice.find(filter)
    .populate('student', 'name username')
    .sort('-createdAt')
    .limit(500);

  if (req.query.q) {
    const query = req.query.q.toLowerCase();

    invoices = invoices.filter((invoice) =>
      `${invoice.student?.name} ${invoice.student?.username} ${invoice.invoiceNo}`
        .toLowerCase()
        .includes(query),
    );
  }

  res.json(invoices);
});


// =====================================================
// ADMIN: BULK GENERATE INVOICES
// Only accepted rooms are eligible.
// =====================================================

r.post('/invoices/generate', async (req, res) => {
  const allocations = await Allocation.find({
    status: { $in: ['Allocated', 'CheckedIn'] },
    roomConfirmationStatus: 'Accepted',
  });

  let created = 0;
  let skipped = 0;

  for (const allocation of allocations) {
    const existingInvoice = await Invoice.exists({
      allocation: allocation._id,
      status: { $ne: 'Cancelled' },
    });

    if (existingInvoice) {
      skipped++;
      continue;
    }

    try {
      const result = await generateInvoice(allocation);

      if (result) {
        created++;
      } else {
        skipped++;
      }
    } catch (error) {
      skipped++;
      console.error(
        `Invoice generation failed for allocation ${allocation._id}:`,
        error.message,
      );
    }
  }

  audit(
    req.user,
    'INVOICES_GENERATED',
    'Invoice',
    null,
    { created, skipped },
    req.ip,
  );

  res.json({ created, skipped });
});


// =====================================================
// ADMIN: REFUND
// =====================================================

r.post('/refund', async (req, res) => {
  const invoice = await Invoice.findById(
    req.body.invoiceId,
  );

  if (!invoice) {
    throw new HttpError(404, 'Invoice not found');
  }

  const amount = money(req.body.amount);

  if (!(amount > 0) || amount > invoice.paid) {
    throw new HttpError(
      400,
      `Refund must be between 0 and the amount paid (Rs. ${invoice.paid})`,
    );
  }

  if (!req.body.reason) {
    throw new HttpError(
      400,
      'Enter a reason for the refund',
    );
  }

  const refund = await Refund.create({
    invoice: invoice._id,
    student: invoice.student,
    amount,
    reason: req.body.reason,
    txnRef:
      'RF-' +
      crypto.randomBytes(5).toString('hex').toUpperCase(),
    by: req.user._id,
  });

  invoice.paid = money(invoice.paid - amount);

  if (req.body.cancelInvoice) {
    invoice.status = 'Cancelled';
  }

  await invoice.save();

  notify(invoice.student, {
    type: 'payment',
    title: 'Refund recorded',
    message: `Rs. ${amount} was refunded against ${invoice.invoiceNo}. Reference ${refund.txnRef}.`,
    link: '/fees',
  });

  audit(
    req.user,
    'FEE_REFUND',
    'Refund',
    refund._id,
    {
      amount,
      invoice: invoice.invoiceNo,
    },
    req.ip,
  );

  res.status(201).json(refund);
});

r.get('/refunds', async (_req, res) => {
  res.json(
    await Refund.find()
      .populate('student', 'name username')
      .populate('invoice', 'invoiceNo')
      .sort('-createdAt')
      .limit(200),
  );
});

export default r;
