import { User, Project } from '../models/index.js';
import mongoose from 'mongoose';
import { accountInput, text } from '../middleware/accountValidation.js';
import { hashPassword } from '../services/passwordService.js';
import { safeUser } from '../services/sessionService.js';
import { notify } from '../services/notificationService.js';
import { AppError } from '../utils/AppError.js';

async function notifyAdmins(req, title, message, project) {
  const admins = await User.find({ role: 'admin', isActive: true }).distinct('_id');
  await notify(req, admins, { title, message, project });
}

export async function users(req, res) {
  const filter = {};
  if (req.query.role !== undefined) {
    if (!['student', 'teacher', 'admin'].includes(req.query.role)) throw new AppError(400, 'Invalid user role.', 'VALIDATION_ERROR');
    filter.role = req.query.role;
  }
  if (req.query.search) {
    const search = text(req.query.search, 'Search', { max: 100 }).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
  }
  const records = await User.find(filter).sort({ createdAt: -1 }).limit(100);
  res.json({ users: records.map(safeUser), total: await User.countDocuments(filter) });
}

export async function createUser(req, res) {
  if (!['student', 'teacher'].includes(req.body?.role)) throw new AppError(400, 'Administrators can create student or teacher accounts here.', 'VALIDATION_ERROR');
  const input = accountInput(req.body, req.body.role);
  const passwordHash = await hashPassword(req.body.password);
  if (await User.exists({ email: input.email })) throw new AppError(409, 'An account with this email already exists.', 'DUPLICATE_RECORD');
  const user = await User.create({ ...input, passwordHash });
  await notifyAdmins(req, 'Account created', `${req.user.name} created ${user.name}'s ${user.role} account.`);
  res.status(201).json({ user: safeUser(user) });
}

export async function setAccountStatus(req, res) {
  if (typeof req.body?.isActive !== 'boolean') throw new AppError(400, 'isActive must be true or false.', 'VALIDATION_ERROR');
  const target = await User.findById(req.params.id);
  if (!target) throw new AppError(404, 'This user was not found.', 'NOT_FOUND');
  if (target.role === 'admin') throw new AppError(403, 'Administrator accounts cannot be deactivated from this operation.', 'FORBIDDEN');
  const user = await User.findOneAndUpdate({ _id: target._id }, { $set: { isActive: req.body.isActive }, $inc: { tokenVersion: 1 } }, { returnDocument: 'after', runValidators: true });
  req.app.get('io')?.in(`user:${user._id}`).disconnectSockets(true);
  await notifyAdmins(req, 'Account status updated', `${req.user.name} ${user.isActive ? 'activated' : 'deactivated'} ${user.name}'s account.`);
  res.json({ user: safeUser(user) });
}

export async function assignTeacher(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.body?.teacherId)) throw new AppError(400, 'Select a valid teacher ID.', 'INVALID_ID');
  const project = await Project.findById(req.params.id);
  if (!project) throw new AppError(404, 'This project was not found.', 'NOT_FOUND');
  const teacher = await User.findOne({ _id: req.body?.teacherId, role: 'teacher', isActive: true });
  if (!teacher) throw new AppError(400, 'Select an active teacher.', 'VALIDATION_ERROR');
  project.supervisor = teacher._id;
  await project.save();
  await notifyAdmins(req, 'Teacher assigned', `${req.user.name} assigned ${teacher.name} to ${project.title}.`, project._id);
  await notify(req, [teacher._id, ...project.members], { title: 'Supervisor assignment', message: `${teacher.name} is assigned to ${project.title}.`, project: project._id });
  res.json({ project: await project.populate('supervisor', 'name email') });
}
