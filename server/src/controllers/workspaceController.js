import { Project, Proposal, Submission, Evaluation, Feedback, User } from '../models/index.js';
import mongoose from 'mongoose';
import { accessibleProject, accessibleProjectIds, projectScope } from '../services/accessService.js';
import { text } from '../middleware/accountValidation.js';
import { notify } from '../services/notificationService.js';
import { AppError } from '../utils/AppError.js';
import { pagination, pageInfo } from '../utils/pagination.js';

export async function projects(req, res) {
  const { page, limit, skip } = pagination(req.query);
  const records = await Project.find(projectScope(req.user)).populate('supervisor', 'name email').populate('members', 'name email studentId department isActive').sort({ updatedAt: -1 }).skip(skip).limit(limit);
  res.json({ projects: records, pagination: pageInfo(await Project.countDocuments(projectScope(req.user)), page, limit) });
}

export async function project(req, res) {
  const record = await accessibleProject(req.user, req.params.id);
  await record.populate([{ path: 'supervisor', select: 'name email' }, { path: 'members', select: 'name email studentId department isActive' }]);
  res.json({ project: record });
}

export function scopedRecords(Model, key) {
  return async (req, res) => {
    const ids = await accessibleProjectIds(req.user);
    const { page, limit, skip } = pagination(req.query); const filter = { project: { $in: ids } };
    const query = Model.find(filter).select('-document.storageKey').sort({ createdAt: -1 }).skip(skip).limit(limit).populate('project', 'title teamName');
    if (Model.schema.path('author')) query.populate('author', 'name');
    if (Model.schema.path('submittedBy')) query.populate('submittedBy', 'name');
    if (Model.schema.path('reviewedBy')) query.populate('reviewedBy', 'name');
    if (Model.schema.path('submission')) query.populate('submission', 'document.originalName revision');
    const records = await query;
    res.json({ [key]: records, pagination: pageInfo(await Model.countDocuments(filter), page, limit) });
  };
}

export function scopedRecord(Model, key) {
  return async (req, res) => {
    const record = await Model.findById(req.params.id).select('-document.storageKey');
    if (!record) throw new AppError(404, 'This record was not found.', 'NOT_FOUND');
    await accessibleProject(req.user, record.project);
    await record.populate('project', 'title teamName');
    if (Model.schema.path('submittedBy')) await record.populate('submittedBy', 'name');
    res.json({ [key]: record });
  };
}

export async function createFeedback(req, res) {
  const project = await accessibleProject(req.user, req.body?.projectId);
  const message = text(req.body.message, 'Feedback', { max: 10000 });
  let submission;
  if (req.body.submissionId) {
    if (!mongoose.isObjectIdOrHexString(req.body.submissionId)) throw new AppError(400, 'Select a valid submission ID.', 'INVALID_ID');
    submission = await Submission.findOne({ _id: req.body.submissionId, project: project._id });
    if (!submission) throw new AppError(404, 'This submission was not found in the project.', 'NOT_FOUND');
  }
  const category = req.body.category || 'general';
  if (!['general', 'technical', 'documentation'].includes(category)) throw new AppError(400, 'Choose a valid feedback category.', 'VALIDATION_ERROR');
  const submissionStatus = req.body.submissionStatus;
  if (submissionStatus && (!submission || !['approved', 'revision_required', 'reviewed'].includes(submissionStatus))) throw new AppError(400, 'Select a submission and a valid review status.', 'VALIDATION_ERROR');
  const feedback = await Feedback.create({ project: project._id, submission: submission?._id, author: req.user._id, message, category, submissionStatus });
  if (submissionStatus) await Submission.updateOne({ _id: submission._id }, { $set: { reviewStatus: submissionStatus, reviewedBy: req.user._id, reviewedAt: new Date() } });
  await notify(req, project.members, { type: 'feedback', project: project._id, resourceType: 'feedback', resourceId: feedback._id, eventKey: `feedback:${feedback._id}:created`, title: submissionStatus === 'revision_required' ? 'Submission requires revision' : 'New supervisor feedback', message: `${req.user.name} provided feedback on ${project.title}.` });
  res.status(201).json({ feedback });
}

export async function updateFeedback(req, res) {
  const feedback = await Feedback.findById(req.params.id);
  if (!feedback) throw new AppError(404, 'This feedback was not found.', 'NOT_FOUND');
  await accessibleProject(req.user, feedback.project);
  if (String(feedback.author) !== String(req.user._id)) throw new AppError(403, 'Only the author may update this feedback.', 'FORBIDDEN');
  feedback.message = text(req.body?.message, 'Feedback', { max: 10000 });
  if (!['general', 'technical', 'documentation'].includes(req.body.category || feedback.category)) throw new AppError(400, 'Choose a valid category.', 'VALIDATION_ERROR');
  feedback.category = req.body.category || feedback.category;
  if (req.body.submissionStatus) {
    if (!feedback.submission || !['approved', 'revision_required', 'reviewed'].includes(req.body.submissionStatus)) throw new AppError(400, 'Choose a valid submission review status.', 'VALIDATION_ERROR');
    feedback.submissionStatus = req.body.submissionStatus;
    await Submission.updateOne({ _id: feedback.submission }, { $set: { reviewStatus: feedback.submissionStatus, reviewedBy: req.user._id, reviewedAt: new Date() } });
  }
  await feedback.save();
  const project = await accessibleProject(req.user, feedback.project);
  await notify(req, project.members, { type: 'feedback', project: project._id, resourceType: 'feedback', resourceId: feedback._id, eventKey: `feedback:${feedback._id}:updated:${feedback.updatedAt.toISOString()}`, title: 'Feedback updated', message: `${req.user.name} updated feedback on ${project.title}.` });
  res.json({ feedback });
}

export async function assignedStudents(req, res) {
  const members = await Project.find({ supervisor: req.user._id }).distinct('members');
  const students = await User.find({ _id: { $in: members }, role: 'student' }).select('name email studentId department isActive');
  res.json({ students });
}

export async function availableTeachers(req, res) {
  res.json({ teachers: await User.find({ role: 'teacher', isActive: true }).select('name email').sort({ name: 1 }).limit(100) });
}

export const proposals = scopedRecords(Proposal, 'proposals');
export const submissions = scopedRecords(Submission, 'submissions');
export const evaluations = scopedRecords(Evaluation, 'evaluations');
export const feedback = scopedRecords(Feedback, 'feedback');
