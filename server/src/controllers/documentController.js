import { Project, Submission, Resource } from '../models/index.js';
import { accessibleProject, accessibleProjectIds } from '../services/accessService.js';
import { discardUpload, downloadDocument, inspectDocument } from '../services/documentService.js';
import { text } from '../middleware/accountValidation.js';
import { AppError } from '../utils/AppError.js';
import { notify } from '../services/notificationService.js';
import { pagination, pageInfo } from '../utils/pagination.js';

export async function authorizeProjectUpload(req, res, next) {
  try {
    req.project = await accessibleProject(req.user, req.params.id);
    if (req.user.role === 'student' && ['submitted', 'completed'].includes(req.project.status)) throw new AppError(409, 'Uploads are locked after final submission.', 'PROJECT_LOCKED');
    next();
  } catch (error) { next(error); }
}
export async function authorizeReplacement(req, res, next) {
  try {
    req.previous = await Submission.findById(req.params.id);
    if (!req.previous) throw new AppError(404, 'This submission was not found.', 'NOT_FOUND');
    req.project = await accessibleProject(req.user, req.previous.project);
    if (['submitted', 'completed'].includes(req.project.status)) throw new AppError(409, 'Uploads are locked after final submission.', 'PROJECT_LOCKED');
    next();
  } catch (error) { next(error); }
}
export async function uploadSubmission(req, res) {
  try {
    const document = await inspectDocument(req.file);
    const counter = await Project.findOneAndUpdate({ _id: req.project._id, status: { $nin: ['submitted', 'completed'] } }, { $inc: { submissionCount: 1 } }, { returnDocument: 'after' });
    if (!counter) throw new AppError(409, 'Uploads are locked after final submission.', 'PROJECT_LOCKED');
    const submission = await Submission.create({ project: req.project._id, submittedBy: req.user._id, document, revision: counter.submissionCount, supersedes: req.previous?._id });
    await notify(req, req.project.supervisor ? [req.project.supervisor] : [], { type: 'submission', project: req.project._id, title: req.previous ? 'Document resubmitted' : 'Document submitted', message: `${req.project.teamName} uploaded report revision ${submission.revision}.` });
    res.status(201).json({ submission });
  } catch (error) { await discardUpload(req.file); throw error; }
}
export async function downloadSubmission(req, res) {
  const submission = await Submission.findById(req.params.id);
  if (!submission) throw new AppError(404, 'This submission was not found.', 'NOT_FOUND');
  await accessibleProject(req.user, submission.project);
  await downloadDocument(res, submission.document);
}
export async function uploadResource(req, res) {
  try {
    const document = await inspectDocument(req.file);
    const resource = await Resource.create({ project: req.project._id, uploadedBy: req.user._id, audience: 'project', document,
      title: text(req.body?.title, 'Resource title', { max: 200 }), description: text(req.body.description, 'Description', { required: false, max: 5000 }) });
    await notify(req, req.project.members, { type: 'system', project: req.project._id, title: 'New learning resource', message: `${req.user.name} shared ${resource.title}.` });
    res.status(201).json({ resource });
  } catch (error) { await discardUpload(req.file); throw error; }
}
export async function resources(req, res) {
  const ids = await accessibleProjectIds(req.user);
  const filter = req.user.role === 'admin' ? {} : { $or: [{ audience: 'all' }, { project: { $in: ids } }] };
  const { page, limit, skip } = pagination(req.query);
  const [resources, total] = await Promise.all([Resource.find(filter).select('-document.storageKey').populate('project', 'title teamName').sort({ createdAt: -1 }).skip(skip).limit(limit), Resource.countDocuments(filter)]);
  res.json({ resources, pagination: pageInfo(total, page, limit) });
}
export async function downloadResource(req, res) {
  const resource = await Resource.findById(req.params.id);
  if (!resource) throw new AppError(404, 'This resource was not found.', 'NOT_FOUND');
  if (resource.audience === 'project') await accessibleProject(req.user, resource.project);
  await downloadDocument(res, resource.document);
}
