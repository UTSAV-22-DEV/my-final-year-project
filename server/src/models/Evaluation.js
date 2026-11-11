import mongoose from 'mongoose';
import { fileSchema, modelOptions, reference } from './shared.js';

const criterionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  maxMarks: { type: Number, required: true, min: 0, max: 100 },
  marks: {
    type: Number, required: true, min: 0,
    validate: { validator(value) { return value <= this.maxMarks; }, message: 'Marks cannot exceed criterion weight.' },
  },
  suggestions: { type: String, maxlength: 5000 },
  explanation: { type: String, maxlength: 5000 },
  strengths: [{ type: String, maxlength: 2000 }],
  weaknesses: [{ type: String, maxlength: 2000 }],
  improvements: [{ type: String, maxlength: 2000 }],
}, { _id: false });

const evaluationSchema = new mongoose.Schema({
  project: reference('Project'),
  submission: reference('Submission'),
  requestedBy: reference('User'),
  attempt: { type: Number, required: true, enum: [1, 2] },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  model: { type: String, trim: true, maxlength: 100 },
  criteria: { type: [criterionSchema], default: [] },
  totalScore: { type: Number, min: 0, max: 100 },
  suggestions: { type: String, maxlength: 10000 },
  failureCode: { type: String, maxlength: 100 },
  rubricVersion: String,
  document: { type: fileSchema },
  completedAt: Date,
}, modelOptions);

evaluationSchema.pre('validate', function () {
  if (this.status !== 'completed') return;
  const weight = this.criteria.reduce((total, criterion) => total + criterion.maxMarks, 0);
  const marks = this.criteria.reduce((total, criterion) => total + criterion.marks, 0);
  const names = new Set(this.criteria.map((criterion) => criterion.name));
  if (this.criteria.length !== 10 || names.size !== 10 || Math.abs(weight - 100) > 0.001) {
    this.invalidate('criteria', 'A completed evaluation needs ten distinct criteria weighted to 100.');
  }
  if (this.totalScore == null || Math.abs(marks - this.totalScore) > 0.001) {
    this.invalidate('totalScore', 'The total score must match the criterion scores.');
  }
  if (!this.model) this.invalidate('model', 'Record the model used for the completed evaluation.');
});
evaluationSchema.index({ project: 1, attempt: 1 }, { unique: true });

export const Evaluation = mongoose.model('Evaluation', evaluationSchema);
