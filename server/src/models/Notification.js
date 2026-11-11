import mongoose from 'mongoose';
import { modelOptions, reference } from './shared.js';

const notificationSchema = new mongoose.Schema({
  recipient: reference('User'),
  actor: reference('User', false),
  project: reference('Project', false),
  type: { type: String, enum: ['proposal', 'submission', 'feedback', 'evaluation', 'resource', 'group', 'grade', 'system'], required: true },
  eventKey: { type: String, maxlength: 200 },
  resourceType: { type: String, enum: ['project', 'proposal', 'submission', 'feedback', 'resource', 'evaluation', 'grade', 'account'] },
  resourceId: { type: mongoose.Schema.Types.ObjectId },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  readAt: { type: Date, default: null },
}, modelOptions);
notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, eventKey: 1 }, { unique: true, partialFilterExpression: { eventKey: { $type: 'string' } } });

export const Notification = mongoose.model('Notification', notificationSchema);
