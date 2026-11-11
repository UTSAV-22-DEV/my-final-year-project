import { Notification } from '../models/Notification.js';
import { pagination, pageInfo } from '../utils/pagination.js';
import { AppError } from '../utils/AppError.js';

const countUnread = (user) => Notification.countDocuments({ recipient: user._id, readAt: null });
function changed(req) { req.app.get('io')?.to(`user:${req.user._id}`).emit('notifications:changed'); }

export async function list(req, res) {
  const { page, limit, skip } = pagination(req.query);
  const filter = { recipient: req.user._id };
  if (req.query.unread !== undefined && !['true', 'false'].includes(req.query.unread)) throw new AppError(400, 'unread must be true or false.', 'VALIDATION_ERROR');
  if (req.query.unread === 'true') filter.readAt = null;
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit), Notification.countDocuments(filter), countUnread(req.user),
  ]);
  res.json({ notifications, unreadCount, pagination: pageInfo(total, page, limit) });
}
export async function unreadCount(req, res) { res.json({ unreadCount: await countUnread(req.user) }); }
export async function markRead(req, res) {
  const notification = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
  if (!notification) throw new AppError(404, 'This notification was not found.', 'NOT_FOUND');
  if (!notification.readAt) { notification.readAt = new Date(); await notification.save(); }
  changed(req); res.json({ notification, unreadCount: await countUnread(req.user) });
}
export async function markAllRead(req, res) {
  const result = await Notification.updateMany({ recipient: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  changed(req); res.json({ updatedCount: result.modifiedCount, unreadCount: await countUnread(req.user) });
}
export async function remove(req, res) {
  const result = await Notification.deleteOne({ _id: req.params.id, recipient: req.user._id });
  if (!result.deletedCount) throw new AppError(404, 'This notification was not found.', 'NOT_FOUND');
  changed(req); res.json({ deleted: true, unreadCount: await countUnread(req.user) });
}
