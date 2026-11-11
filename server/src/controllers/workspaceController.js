import { Project, Proposal, Submission, Evaluation, Feedback, Notification, User } from '../models/index.js';
import { accessibleProject, accessibleProjectIds, projectScope } from '../services/accessService.js';
import { text } from '../middleware/accountValidation.js';
import { notify } from '../services/notificationService.js';
import { AppError } from '../utils/AppError.js';

export async function projects(req, res) {
  const records = await Project.find(projectScope(req.user)).populate('supervisor', 'name email').populate('members', 'name email studentId department isActive').sort({ updatedAt: -1 }).limit(100);
  res.json({ projects: records });
}

export async function project(req, res) {
  const record = await accessibleProject(req.user, req.params.id);
  await record.populate([{ path: 'supervisor', select: 'name email' }, { path: 'members', select: 'name email studentId department isActive' }]);
  res.json({ project: record });
}

export function scopedRecords(Model, key) {
  return async (req, res) => {
    const ids = await accessibleProjectIds(req.user);
    const records = await Model.find({ project: { $in: ids } }).select('-document.storageKey').sort({ createdAt: -1 }).limit(100).populate('project', 'title');
    res.json({ [key]: records });
  };
}

export function scopedRecord(Model, key) {
  return async (req, res) => {
    const record = await Model.findById(req.params.id).select('-document.storageKey');
    if (!record) throw new AppError(404, 'This record was not found.', 'NOT_FOUND');
    await accessibleProject(req.user, record.project);
    res.json({ [key]: record });
  };
}

export async function createProposal(req, res) {
  const title = text(req.body?.title, 'Title', { max: 200 });
  const abstract = text(req.body?.abstract, 'Abstract', { max: 10000 });
  // Project creation and proposal approval UI belong to later phases. The role API
  // accepts proposals only for an existing, owned draft/proposed project.
  const project = await accessibleProject(req.user, req.body?.projectId);
  if (!['draft', 'proposed'].includes(project.status)) throw new AppError(409, 'This project is no longer accepting proposals.', 'INVALID_STATE');
  if (await Proposal.exists({ project: project._id, status: 'pending' })) throw new AppError(409, 'This project already has a pending proposal.', 'DUPLICATE_PROPOSAL');
  const proposal = await Proposal.create({ project: project._id, submittedBy: req.user._id, title, abstract, status: 'pending' });
  project.status = 'proposed';
  await project.save();
  await notify(req, project.supervisor ? [project.supervisor] : [], { type: 'proposal', project: project._id, title: 'New proposal to review', message: `${req.user.name} submitted ${title}.` });
  res.status(201).json({ proposal });
}

export async function reviewProposal(req, res) {
  const proposal = await Proposal.findById(req.params.id);
  if (!proposal) throw new AppError(404, 'This proposal was not found.', 'NOT_FOUND');
  const project = await accessibleProject(req.user, proposal.project);
  if (!['approved', 'rejected', 'revision_requested'].includes(req.body?.status)) throw new AppError(400, 'Choose approved, rejected, or revision_requested.', 'VALIDATION_ERROR');
  if (proposal.status !== 'pending') throw new AppError(409, 'This proposal has already been reviewed.', 'INVALID_STATE');
  proposal.status = req.body.status;
  proposal.reviewComment = text(req.body.comment, 'Review comment', { required: false, max: 5000 });
  proposal.reviewedBy = req.user._id;
  proposal.reviewedAt = new Date();
  await proposal.save();
  if (proposal.status === 'approved') { project.status = 'active'; await project.save(); }
  await notify(req, project.members, { type: 'proposal', project: project._id, title: 'Proposal reviewed', message: `${project.title}: ${proposal.status.replaceAll('_', ' ')}.` });
  res.json({ proposal });
}

export async function createFeedback(req, res) {
  const project = await accessibleProject(req.user, req.body?.projectId);
  const message = text(req.body.message, 'Feedback', { max: 10000 });
  let submission;
  if (req.body.submissionId) {
    submission = await Submission.findOne({ _id: req.body.submissionId, project: project._id });
    if (!submission) throw new AppError(404, 'This submission was not found in the project.', 'NOT_FOUND');
  }
  const feedback = await Feedback.create({ project: project._id, submission: submission?._id, author: req.user._id, message });
  await notify(req, project.members, { type: 'feedback', project: project._id, title: 'New supervisor feedback', message: `${req.user.name} provided feedback on ${project.title}.` });
  res.status(201).json({ feedback });
}

export async function notifications(req, res) {
  const records = await Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ notifications: records });
}

export async function readNotification(req, res) {
  const record = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { $set: { readAt: new Date() } }, { returnDocument: 'after' });
  if (!record) throw new AppError(404, 'This notification was not found.', 'NOT_FOUND');
  res.json({ notification: record });
}

export async function assignedStudents(req, res) {
  const members = await Project.find({ supervisor: req.user._id }).distinct('members');
  const students = await User.find({ _id: { $in: members }, role: 'student' }).select('name email studentId department isActive');
  res.json({ students });
}

export const proposals = scopedRecords(Proposal, 'proposals');
export const submissions = scopedRecords(Submission, 'submissions');
export const evaluations = scopedRecords(Evaluation, 'evaluations');
export const feedback = scopedRecords(Feedback, 'feedback');
