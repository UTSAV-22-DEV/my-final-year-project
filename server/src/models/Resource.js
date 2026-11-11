import mongoose from 'mongoose';
import { fileSchema, modelOptions, reference } from './shared.js';

const resourceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 5000 },
  uploadedBy: reference('User'),
  project: reference('Project', false),
  audience: { type: String, enum: ['all', 'project'], default: 'all' },
  document: { type: fileSchema, required: true },
}, modelOptions);
resourceSchema.pre('validate', function () {
  if (this.audience === 'project' && !this.project) this.invalidate('project', 'A project is required for a project resource.');
});
resourceSchema.index({ project: 1, createdAt: -1 });

export const Resource = mongoose.model('Resource', resourceSchema);
