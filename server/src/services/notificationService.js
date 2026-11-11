import { Notification } from '../models/Notification.js';
import { createHash } from 'node:crypto';
import { AppError } from '../utils/AppError.js';

export async function notify(req, recipients, { title, message, project, type = 'system', eventKey, resourceType, resourceId }) {
  const unique = [...new Set(recipients.map(String))];
  if (!unique.length) return [];
  const key = eventKey || createHash('sha256').update(JSON.stringify([req.user._id, type, project, title, message, resourceId])).digest('hex');
  const records = [];
  try {
    for (const recipient of unique) {
      const filter = { recipient, eventKey: key };
      let created = false;
      try {
        const result = await Notification.updateOne(filter, { $setOnInsert: { recipient, eventKey: key, actor: req.user._id, title, message, project, type, resourceType: resourceType || (project ? 'project' : 'account'), resourceId } }, { upsert: true, runValidators: true });
        created = result.upsertedCount === 1;
      } catch (error) { if (error.code !== 11000) throw error; }
      const record = await Notification.findOne(filter);
      if (!record) throw new Error('Notification persistence failed.');
      records.push(record);
      if (created) {
        // Only persisted, new records are emitted. A disconnected client recovers
        // from MongoDB; a transport failure does not erase the stored notification.
        try { req.app.get('io')?.to(`user:${recipient}`).emit('notification', record.toJSON()); }
        catch { console.error('[notification] Live delivery unavailable; persisted notification retained.'); }
      }
    }
  } catch {
    throw new AppError(503, 'The operation was saved, but its notifications could not be persisted. Refresh to confirm the result before retrying.', 'NOTIFICATION_PERSISTENCE_FAILED');
  }
  return records;
}
