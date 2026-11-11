import mongoose from 'mongoose';
import { modelOptions, reference } from './shared.js';

const notificationSchema = new mongoose.Schema({
  recipient: reference('User'),
  actor: reference('User', false),
  project: reference('Project', false),
  type: { type: String, enum: ['proposal', 'submission', 'feedback', 'evaluation', 'system'], required: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  readAt: { type: Date, default: null },
}, modelOptions);
notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
