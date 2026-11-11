import { Notification } from '../models/Notification.js';

export async function notify(req, recipients, { title, message, project, type = 'system' }) {
  const unique = [...new Set(recipients.map(String))];
  if (!unique.length) return;
  try {
    const records = await Notification.insertMany(unique.map((recipient) => ({ recipient, actor: req.user._id, title, message, project, type })));
    for (const record of records) req.app.get('io')?.to(`user:${record.recipient}`).emit('notification', record.toJSON());
  } catch {
    // A notification delivery failure must not turn a completed account change into a failed request.
    console.error('[notification] Could not persist or deliver an update.');
  }
}
