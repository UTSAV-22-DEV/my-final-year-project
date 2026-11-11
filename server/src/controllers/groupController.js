import mongoose from 'mongoose';
import { Project, User } from '../models/index.js';
import { text } from '../middleware/accountValidation.js';
import { AppError } from '../utils/AppError.js';
import { notify } from '../services/notificationService.js';

async function groupInput(body, current) {
  const teamName = text(body?.teamName, 'Group name');
  if (!Array.isArray(body.members) || !body.members.length || body.members.length > 20 || body.members.some((id) => !mongoose.isObjectIdOrHexString(id)) || new Set(body.members).size !== body.members.length) {
    throw new AppError(400, 'Select between 1 and 20 unique student accounts.', 'VALIDATION_ERROR');
  }
  const students = await User.countDocuments({ _id: { $in: body.members }, role: 'student', isActive: true });
  if (students !== body.members.length) throw new AppError(400, 'Every group member must be an active student.', 'VALIDATION_ERROR');
  if (await Project.exists({ _id: { $ne: current?._id }, members: { $in: body.members }, status: { $ne: 'completed' } })) {
    throw new AppError(409, 'A selected student already belongs to an active project group.', 'GROUP_CONFLICT');
  }
  if (await Project.exists({ _id: { $ne: current?._id }, teamName, status: { $ne: 'completed' } })) throw new AppError(409, 'This active group name is already in use.', 'DUPLICATE_GROUP');
  return { teamName, members: body.members, title: text(body.title || current?.title || `${teamName} project`, 'Project title', { max: 200 }),
    summary: text(body.summary, 'Summary', { required: false, max: 5000 }),
    createdBy: body.members.includes(String(current?.createdBy)) ? current.createdBy : body.members[0] };
}

export async function createGroup(req, res) {
  const input = await groupInput(req.body);
  let supervisor;
  if (req.body.teacherId) {
    if (!mongoose.isObjectIdOrHexString(req.body.teacherId)) throw new AppError(400, 'Select a valid supervisor.', 'INVALID_ID');
    supervisor = await User.findOne({ _id: req.body.teacherId, role: 'teacher', isActive: true });
    if (!supervisor) throw new AppError(400, 'Select an active teacher.', 'VALIDATION_ERROR');
  }
  const project = await Project.create({ ...input, supervisor: supervisor?._id });
  await notify(req, [...project.members, ...(supervisor ? [supervisor._id] : [])], { project: project._id, title: 'Project group assigned', message: `You have been assigned to ${project.teamName}.` });
  res.status(201).json({ project });
}

export async function updateGroup(req, res) {
  const project = await Project.findById(req.params.id);
  if (!project) throw new AppError(404, 'This group was not found.', 'NOT_FOUND');
  if (['submitted', 'completed'].includes(project.status)) throw new AppError(409, 'Group membership is locked after final submission.', 'GROUP_LOCKED');
  const oldMembers = project.members.map(String);
  Object.assign(project, await groupInput(req.body, project));
  await project.save();
  const added = project.members.filter((id) => !oldMembers.includes(String(id)));
  const removed = oldMembers.filter((id) => !project.members.some((member) => String(member) === id));
  await notify(req, added, { project: project._id, title: 'Added to project group', message: `You have joined ${project.teamName}.` });
  await notify(req, removed, { title: 'Group membership updated', message: `You have been removed from ${project.teamName}.` });
  res.json({ project });
}
