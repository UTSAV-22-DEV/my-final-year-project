import mongoose from 'mongoose';
import { modelOptions, reference } from './shared.js';

const proposalSchema = new mongoose.Schema({
  project: reference('Project'),
  submittedBy: reference('User'),
  title: { type: String, required: true, trim: true, maxlength: 200 },
  abstract: { type: String, required: true, trim: true, maxlength: 10000 },
  objectives: [{ type: String, trim: true, maxlength: 1000 }],
  preferredSupervisors: [reference('User')],
  status: { type: String, enum: ['draft', 'pending', 'approved', 'rejected', 'revision_requested'], default: 'draft' },
  reviewedBy: reference('User', false),
  reviewedAt: Date,
  reviewComment: { type: String, maxlength: 5000 },
}, modelOptions);
proposalSchema.index({ project: 1, createdAt: -1 });

export const Proposal = mongoose.model('Proposal', proposalSchema);
