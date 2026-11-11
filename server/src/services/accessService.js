import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import { AppError } from '../utils/AppError.js';

export function projectScope(user) {
  if (user.role === 'admin') return {};
  return user.role === 'teacher' ? { supervisor: user._id } : { members: user._id };
}

export async function accessibleProject(user, id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw new AppError(400, 'A valid project ID is required.', 'INVALID_ID');
  const project = await Project.findOne({ _id: id, ...projectScope(user) });
  if (!project) throw new AppError(404, 'This project was not found.', 'NOT_FOUND');
  return project;
}

export async function accessibleProjectIds(user) { return Project.find(projectScope(user)).distinct('_id'); }
