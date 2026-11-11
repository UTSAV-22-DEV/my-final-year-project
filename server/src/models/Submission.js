import mongoose from 'mongoose';
import { fileSchema, modelOptions, reference } from './shared.js';

const submissionSchema = new mongoose.Schema({
  project: reference('Project'),
  submittedBy: reference('User'),
  document: { type: fileSchema, required: true },
  stage: { type: String, enum: ['draft', 'final'], default: 'draft' },
  revision: { type: Number, default: 1, min: 1, validate: Number.isInteger },
  submittedAt: { type: Date, default: Date.now },
}, modelOptions);
submissionSchema.index({ project: 1, createdAt: -1 });

export const Submission = mongoose.model('Submission', submissionSchema);
