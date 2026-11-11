import mongoose from 'mongoose';
import { modelOptions, reference } from './shared.js';

const proposalSchema = new mongoose.Schema({
  project: reference('Project'),
  submittedBy: reference('User'),
  title: { type: String, required: true, trim: true, maxlength: 200 },
  abstract: { type: String, required: true, trim: true, maxlength: 10000 },
  objectives: [{ type: String, trim: true, maxlength: 1000 }],
  problemStatement: { type: String, trim: true, maxlength: 10000 },
  methodology: { type: String, trim: true, maxlength: 10000 },
  domain: { type: String, trim: true, maxlength: 150 },
  technologies: [{ type: String, trim: true, maxlength: 100 }],
  teamName: String,
  teamMembers: [reference('User')],
  submittedAt: Date,
  auditTrail: [{ status: String, actor: reference('User'), at: { type: Date, default: Date.now }, comment: { type: String, maxlength: 5000 } }],
  preferredSupervisors: [reference('User')],
  status: { type: String, enum: ['draft', 'pending', 'approved', 'rejected', 'revision_requested'], default: 'draft' },
  reviewedBy: reference('User', false),
  reviewedAt: Date,
  reviewComment: { type: String, maxlength: 5000 },
}, modelOptions);
proposalSchema.index({ project: 1, createdAt: -1 });
proposalSchema.index({ project: 1 }, { unique: true, name: 'unique_open_project_proposal', partialFilterExpression: { status: { $in: ['draft', 'pending', 'approved', 'revision_requested'] } } });

export const Proposal = mongoose.model('Proposal', proposalSchema);
