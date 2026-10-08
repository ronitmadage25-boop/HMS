import { Notification, User } from '../models/index.js';
import { sendMail } from './mailer.js';

const tpl = (name, title, message) => `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #E1E8F5;border-radius:12px;overflow:hidden">
<div style="background:#1D54D4;color:#fff;padding:16px 24px;font-size:16px;font-weight:600">Hostel Management System</div>
<div style="padding:24px;color:#0A1B3D"><p>Hi ${name},</p><p style="font-weight:600">${title}</p><p style="color:#41537a">${message}</p></div></div>`;

export async function notify(recipients, { type = 'system', title, message, link }) {
  const ids = [...new Set((Array.isArray(recipients) ? recipients : [recipients]).filter(Boolean).map(String))];
  if (!ids.length) return;
  await Notification.insertMany(ids.map((user) => ({ user, type, title, message, link })));
  const users = await User.find({ _id: { $in: ids } }).select('email name emailPrefs');
  for (const u of users) {
    const pref = u.emailPrefs?.[type];
    if (pref === true || (pref === undefined && type !== 'visitor')) {
      sendMail({ to: u.email, subject: title, html: tpl(u.name, title, message) }).catch((e) => console.error('mail failed:', e.message));
    }
  }
}
export const idsByRole = async (role, filter = {}) =>
  (await User.find({ role, active: true, ...filter }).select('_id')).map((u) => u._id);
