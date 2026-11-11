import mongoose from 'mongoose';
import { modelOptions, reference } from './shared.js';

const feedbackSchema = new mongoose.Schema({
  project: reference('Project'),
  submission: reference('Submission', false),
  author: reference('User'),
  message: { type: String, required: true, trim: true, maxlength: 10000 },
}, modelOptions);
feedbackSchema.index({ project: 1, createdAt: -1 });

export const Feedback = mongoose.model('Feedback', feedbackSchema);
