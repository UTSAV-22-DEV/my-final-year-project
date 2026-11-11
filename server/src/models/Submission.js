import mongoose from 'mongoose';
import { fileSchema, modelOptions, reference } from './shared.js';

const submissionSchema = new mongoose.Schema({
  project: reference('Project'),
  submittedBy: reference('User'),
  document: { type: fileSchema, required: true },
  stage: { type: String, enum: ['draft', 'final'], default: 'draft' },
  revision: { type: Number, default: 1, min: 1, validate: Number.isInteger },
  supersedes: reference('Submission', false),
  reviewStatus: { type: String, enum: ['pending', 'approved', 'revision_required', 'reviewed'], default: 'pending' },
  reviewedBy: reference('User', false),
  reviewedAt: Date,
  submittedAt: { type: Date, default: Date.now },
}, modelOptions);
submissionSchema.index({ project: 1, createdAt: -1 });
submissionSchema.index({ project: 1, revision: 1 }, { unique: true });

export const Submission = mongoose.model('Submission', submissionSchema);
