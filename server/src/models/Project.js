import mongoose from 'mongoose';
import { modelOptions, reference } from './shared.js';

const finalGradeSchema = new mongoose.Schema({
  score: { type: Number, required: true, min: 0, max: 100 },
  finalizedBy: reference('User'),
  finalizedAt: { type: Date, required: true },
  comment: { type: String, maxlength: 5000 },
}, { _id: false });

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  summary: { type: String, trim: true, maxlength: 5000 },
  teamName: { type: String, trim: true, maxlength: 100 },
  createdBy: reference('User'),
  members: {
    type: [reference('User')],
    validate: {
      validator(members) {
        const ids = members.map(String);
        return ids.length > 0 && new Set(ids).size === ids.length && ids.includes(String(this.createdBy));
      },
      message: 'A project must include its creator and unique student members.',
    },
  },
  supervisor: reference('User', false),
  academicYear: { type: String, trim: true, maxlength: 20 },
  status: { type: String, enum: ['draft', 'proposed', 'active', 'submitted', 'completed'], default: 'draft' },
  // Project-level ownership prevents resetting attempts by replacing a document.
  // The later evaluation service must reserve attempts atomically and authorize membership.
  aiAttemptsUsed: { type: Number, default: 0, min: 0, max: 2, validate: Number.isInteger },
  submissionCount: { type: Number, default: 0, min: 0 },
  finalGrade: { type: finalGradeSchema, default: undefined },
}, modelOptions);
projectSchema.index({ members: 1, status: 1 });
projectSchema.index({ supervisor: 1, status: 1 });
projectSchema.index({ members: 1 }, { unique: true, name: 'unique_active_student_group', partialFilterExpression: { status: { $in: ['draft', 'proposed', 'active', 'submitted'] } } });

export const Project = mongoose.model('Project', projectSchema);
