import mongoose from 'mongoose';

export const reference = (model, required = true) => ({ type: mongoose.Schema.Types.ObjectId, ref: model, required });

export const fileSchema = new mongoose.Schema({
  originalName: { type: String, required: true, maxlength: 255 },
  storageKey: { type: String, required: true, match: /^[a-zA-Z0-9_-]+\.(pdf|docx)$/ },
  mimeType: {
    type: String,
    required: true,
    enum: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
  size: { type: Number, required: true, min: 1 },
}, { _id: false });

export const modelOptions = { timestamps: true, strict: 'throw', autoCreate: false, autoIndex: false };
