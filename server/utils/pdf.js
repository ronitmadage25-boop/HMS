import PDFDocument from 'pdfkit';
const BLUE = '#1D54D4', INK = '#0A1B3D', MUTED = '#5B6B8C';
const rs = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const build = (opts, fn) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4', ...opts });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
  fn(doc); doc.end();
});
function header(doc, institution, title) {
  doc.rect(0, 0, doc.page.width, 90).fill(BLUE);
  doc.fillColor('#fff').fontSize(18).font('Helvetica-Bold').text(institution, 50, 28);
  doc.fontSize(11).font('Helvetica').text(title, 50, 54);
  doc.fillColor(INK).moveDown(4);
  doc.y = 120;
}
function rows(doc, list) {
  list.forEach(([k, v]) => {
    const y = doc.y;
    doc.fontSize(10).fillColor(MUTED).font('Helvetica').text(k, 50, y, { width: 170 });
    doc.fontSize(11).fillColor(INK).font('Helvetica-Bold').text(String(v ?? '-'), 230, y, { width: 310 });
    doc.moveDown(0.8);
  });
}
export const receiptPdf = (r, institution) => build({}, (doc) => {
  header(doc, institution, r.isDuplicate ? 'Fee Receipt - DUPLICATE' : 'Fee Receipt');
  rows(doc, [
    ['Receipt number', r.number], ['Issued on', fmt(r.createdAt)], ['Student', r.student?.name], ['Registration number', r.student?.username?.toUpperCase()],
    ['Session', r.invoice?.session], ['Amount paid', rs(r.amount)], ['Payment method', r.payment?.method], ['Transaction reference', r.payment?.txnRef],
    ['Payment date', fmt(r.payment?.paidAt)], ['Invoice balance after payment', rs(r.invoice?.balance)],
  ]);
  if (r.isDuplicate) doc.moveDown().fontSize(14).fillColor('#C2410C').font('Helvetica-Bold').text('DUPLICATE COPY', { align: 'center' });
  doc.fontSize(9).fillColor(MUTED).font('Helvetica').text('This is a computer-generated receipt and does not require a signature.', 50, 750, { align: 'center' });
});
export const allocationLetterPdf = (a, institution) => build({}, (doc) => {
  header(doc, institution, 'Room Allocation Letter');
  doc.fontSize(11).fillColor(INK).font('Helvetica').text(`Letter no. ${a.letterNo}    Date: ${fmt(a.allocatedAt)}`, 50, 120);
  doc.moveDown(1.5).text(`Dear ${a.student.name},`).moveDown().text(`We are pleased to confirm that you have been allotted a bed in the hostel for the session ${a.session}. The details are given below.`).moveDown();
  rows(doc, [['Block', a.room.block], ['Floor', a.room.floor], ['Room number', a.room.number], ['Bed', a.bed], ['Room type', a.room.type]]);
  doc.moveDown().text('Please complete the first fee payment and report to the hostel office within 7 days of this letter. Allocations not taken up within 7 days are cancelled and the bed returns to the available pool.');
});
export const tablePdf = (title, columns, data, summary, institution) => build({ layout: 'landscape', margin: 36 }, (doc) => {
  doc.rect(0, 0, doc.page.width, 60).fill(BLUE);
  doc.fillColor('#fff').fontSize(15).font('Helvetica-Bold').text(title, 36, 18);
  doc.fontSize(9).font('Helvetica').text(`${institution} | Generated ${fmt(new Date())}`, 36, 40);
  doc.fillColor(INK); let y = 76;
  if (summary?.length) { doc.fontSize(10).font('Helvetica-Bold').text(summary.map((s) => `${s.label}: ${s.value}`).join('     '), 36, y, { width: doc.page.width - 72 }); y = doc.y + 10; }
  const w = (doc.page.width - 72) / columns.length;
  const head = () => { doc.rect(36, y, doc.page.width - 72, 20).fill('#E8F0FE'); doc.fillColor(INK).font('Helvetica-Bold').fontSize(8); columns.forEach((c, i) => doc.text(c.label, 40 + i * w, y + 6, { width: w - 6, lineBreak: false })); y += 24; };
  head();
  doc.font('Helvetica').fontSize(8);
  data.forEach((row, ri) => {
    if (y > doc.page.height - 50) { doc.addPage({ layout: 'landscape', margin: 36 }); y = 40; head(); doc.font('Helvetica').fontSize(8); }
    if (ri % 2) doc.rect(36, y - 3, doc.page.width - 72, 16).fill('#F6F9FF');
    doc.fillColor(INK); columns.forEach((c, i) => doc.text(String(row[c.key] ?? '-'), 40 + i * w, y, { width: w - 6, height: 10, ellipsis: true, lineBreak: false }));
    y += 16;
  });
  if (!data.length) doc.text('No records for the selected filters.', 40, y);
});
