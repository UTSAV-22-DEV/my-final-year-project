import mongoose from 'mongoose';
import { modelOptions } from './shared.js';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  passwordHash: { type: String, required: true, select: false, match: /^\$2[aby]\$\d{2}\$.{53}$/ },
  role: { type: String, enum: ['student', 'teacher', 'admin'], required: true },
  department: { type: String, trim: true, maxlength: 120 },
  studentId: { type: String, trim: true, maxlength: 50 },
  isActive: { type: Boolean, default: true },
}, {
  ...modelOptions,
  toJSON: {
    transform(doc, result) {
      delete result.passwordHash;
      delete result.__v;
      return result;
    },
  },
});

export const User = mongoose.model('User', userSchema);
