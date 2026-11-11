import mongoose from 'mongoose';
import { Proposal, Project, User } from '../models/index.js';
import { accessibleProject } from '../services/accessService.js';
import { text } from '../middleware/accountValidation.js';
import { notify } from '../services/notificationService.js';
import { AppError } from '../utils/AppError.js';

function list(value, name, max = 1000) {
  const values = typeof value === 'string' ? value.split('\n').filter((entry) => entry.trim()) : value;
  if (!Array.isArray(values) || !values.length || values.length > 30) throw new AppError(400, `${name} must have 1–30 entries.`, 'VALIDATION_ERROR');
  return values.map((value) => text(value, name, { max }));
}
async function fields(body, project) {
  let preferredSupervisors = [];
  if (body.preferredSupervisorId) {
    if (!mongoose.isObjectIdOrHexString(body.preferredSupervisorId)) throw new AppError(400, 'Invalid preferred supervisor ID.', 'INVALID_ID');
    const teacher = await User.findOne({ _id: body.preferredSupervisorId, role: 'teacher', isActive: true });
    if (!teacher) throw new AppError(400, 'The preferred supervisor is not available.', 'VALIDATION_ERROR');
    preferredSupervisors = [teacher._id];
  }
  return { title: text(body.title, 'Title', { max: 200 }), abstract: text(body.abstract, 'Abstract', { max: 10000 }),
    problemStatement: text(body.problemStatement, 'Problem statement', { max: 10000 }),
    objectives: list(body.objectives, 'Objectives'), methodology: text(body.methodology, 'Methodology', { max: 10000 }),
    domain: text(body.domain, 'Domain', { max: 150 }), technologies: list(body.technologies, 'Technologies', 100),
    teamName: project.teamName, teamMembers: project.members, preferredSupervisors };
}

export async function createProposal(req, res) {
  const project = await accessibleProject(req.user, req.body?.projectId);
  if (!['draft', 'proposed'].includes(project.status)) throw new AppError(409, 'This project is not accepting a new proposal.', 'INVALID_STATE');
  const input = await fields(req.body, project);
  const status = req.body.submit === false ? 'draft' : 'pending';
  const proposal = await Proposal.create({ ...input, project: project._id, submittedBy: req.user._id, status,
    submittedAt: status === 'pending' ? new Date() : undefined, auditTrail: [{ status, actor: req.user._id }] });
  if (status === 'pending') {
    await Project.updateOne({ _id: project._id }, { $set: { status: 'proposed' } });
    await notify(req, project.supervisor ? [project.supervisor] : [], { type: 'proposal', project: project._id, title: 'New proposal to review', message: `${project.teamName}: ${proposal.title}.` });
  }
  res.status(201).json({ proposal });
}

export async function editProposal(req, res) {
  const proposal = await Proposal.findById(req.params.id);
  if (!proposal) throw new AppError(404, 'This proposal was not found.', 'NOT_FOUND');
  const project = await accessibleProject(req.user, proposal.project);
  if (String(proposal.submittedBy) !== String(req.user._id)) throw new AppError(403, 'Only the proposal creator may edit it.', 'FORBIDDEN');
  if (!['draft', 'revision_requested'].includes(proposal.status)) throw new AppError(409, 'Only drafts and proposals requiring revision can be edited.', 'INVALID_STATE');
  const input = await fields(req.body, project);
  const updated = await Proposal.findOneAndUpdate({ _id: proposal._id, status: proposal.status }, { $set: input }, { returnDocument: 'after', runValidators: true });
  if (!updated) throw new AppError(409, 'The proposal changed. Reload before editing.', 'INVALID_STATE');
  res.json({ proposal: updated });
}

export async function submitProposal(req, res) {
  const existing = await Proposal.findById(req.params.id);
  if (!existing) throw new AppError(404, 'This proposal was not found.', 'NOT_FOUND');
  const project = await accessibleProject(req.user, existing.project);
  if (String(existing.submittedBy) !== String(req.user._id)) throw new AppError(403, 'Only the proposal creator may submit it.', 'FORBIDDEN');
  if (!['draft', 'revision_requested'].includes(existing.status)) throw new AppError(409, 'This proposal cannot be submitted again.', 'INVALID_STATE');
  // Validate full content again when an old draft enters review.
  await fields({ ...existing.toObject(), preferredSupervisorId: existing.preferredSupervisors[0] ? String(existing.preferredSupervisors[0]) : '' }, project);
  const proposal = await Proposal.findOneAndUpdate({ _id: existing._id, status: existing.status }, {
    $set: { status: 'pending', submittedAt: new Date() }, $push: { auditTrail: { status: 'pending', actor: req.user._id, at: new Date(), comment: 'Submitted for review' } },
  }, { returnDocument: 'after', runValidators: true });
  if (!proposal) throw new AppError(409, 'The proposal changed. Reload to continue.', 'INVALID_STATE');
  await Project.updateOne({ _id: project._id }, { $set: { status: 'proposed' } });
  await notify(req, project.supervisor ? [project.supervisor] : [], { type: 'proposal', project: project._id, title: 'Proposal submitted', message: `${project.teamName}: ${proposal.title}.` });
  res.json({ proposal });
}

export async function reviewProposal(req, res) {
  const existing = await Proposal.findById(req.params.id);
  if (!existing) throw new AppError(404, 'This proposal was not found.', 'NOT_FOUND');
  const project = await accessibleProject(req.user, existing.project);
  if (!['approved', 'rejected', 'revision_requested'].includes(req.body?.status)) throw new AppError(400, 'Choose an approval, rejection or revision decision.', 'VALIDATION_ERROR');
  const comment = text(req.body.comment, 'Review comment', { max: 5000 });
  const proposal = await Proposal.findOneAndUpdate({ _id: existing._id, status: 'pending' }, {
    $set: { status: req.body.status, reviewComment: comment, reviewedBy: req.user._id, reviewedAt: new Date() },
    $push: { auditTrail: { status: req.body.status, actor: req.user._id, at: new Date(), comment } },
  }, { returnDocument: 'after', runValidators: true });
  if (!proposal) throw new AppError(409, 'This proposal is not pending review.', 'INVALID_STATE');
  await Project.updateOne({ _id: project._id }, { $set: proposal.status === 'approved' ? { status: 'active', title: proposal.title } : { status: 'proposed' } });
  await notify(req, project.members, { type: 'proposal', project: project._id, title: 'Proposal reviewed', message: `${project.teamName}: ${proposal.status.replaceAll('_', ' ')}.` });
  res.json({ proposal });
}
