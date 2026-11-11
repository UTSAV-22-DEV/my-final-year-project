import { Project, Submission, Evaluation } from '../models/index.js';
import { config } from '../config/env.js';
import { rubric, rubricVersion } from '../config/rubric.js';
import { accessibleProject } from '../services/accessService.js';
import { evaluateSubmission } from '../services/evaluationService.js';
import { notify } from '../services/notificationService.js';
import { text } from '../middleware/accountValidation.js';
import { AppError } from '../utils/AppError.js';
import mongoose from 'mongoose';

export async function evaluationConfig(req, res) {
  res.json({ configured: Boolean(config.groqApiKey && config.groqModel), model: config.groqModel || null, rubric, rubricVersion,
    simulated: false, attemptLimit: 2, maxCharacters: config.aiMaxTextChars, maxPages: 200, ocrSupported: false });
}
export async function evaluate(req, res) { res.status(201).json({ evaluation: await evaluateSubmission(req, req.params.id) }); }

export async function finalSubmit(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.body?.submissionId)) throw new AppError(400, 'Select a valid report.', 'INVALID_ID');
  const project = await accessibleProject(req.user, req.params.id);
  if (['submitted', 'completed'].includes(project.status)) throw new AppError(409, 'This project has already been finally submitted.', 'PROJECT_FINALIZED');
  const submission = await Submission.findOne({ _id: req.body?.submissionId, project: project._id });
  if (!submission) throw new AppError(400, 'Select a report from this project.', 'VALIDATION_ERROR');
  const successes = await Evaluation.countDocuments({ project: project._id, status: 'completed' });
  if (!successes) throw new AppError(409, 'Complete at least one AI-assisted review before final submission.', 'EVALUATION_REQUIRED');
  const updated = await Project.findOneAndUpdate({ _id: project._id, status: { $nin: ['submitted', 'completed'] },
    $or: [{ evaluationLock: { $exists: false } }, { 'evaluationLock.at': { $lt: new Date(Date.now() - 5 * 60 * 1000) } }],
  }, {
    $set: { status: 'submitted', finalSubmission: submission._id, finalSubmittedAt: new Date(), aiAttemptsUsed: successes }, $unset: { evaluationLock: 1 },
  }, { returnDocument: 'after' });
  if (!updated) throw new AppError(409, 'Wait for the running evaluation or refresh the project status.', 'INVALID_STATE');
  await Submission.updateOne({ _id: submission._id }, { $set: { stage: 'final' } });
  await notify(req, project.supervisor ? [project.supervisor] : [], { type: 'submission', project: project._id, resourceType: 'submission', resourceId: submission._id, eventKey: `final-submission:${project._id}:${submission._id}`, title: 'Final report submitted', message: `${project.teamName} submitted its final report for teacher assessment.` });
  res.json({ project: updated });
}

export async function finalizeGrade(req, res) {
  const project = await accessibleProject(req.user, req.params.id);
  if (project.status !== 'submitted' || !project.finalSubmission || project.finalGrade) throw new AppError(409, 'Only a pending final submission can be graded.', 'GRADE_LOCKED');
  const original = await Evaluation.findOne({ project: project._id, status: 'completed' }).sort({ attempt: -1 });
  if (!original) throw new AppError(409, 'An original AI evaluation is required for this review.', 'EVALUATION_REQUIRED');
  const submitted = req.body?.criteria;
  if (!Array.isArray(submitted) || submitted.length !== 10 || submitted.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry)) || new Set(submitted.map((entry) => entry.name)).size !== 10) throw new AppError(400, 'Provide all ten distinct teacher criterion scores.', 'VALIDATION_ERROR');
  const criteria = original.criteria.map((criterion) => {
    const adjusted = submitted.find((entry) => entry.name === criterion.name);
    if (!adjusted || typeof adjusted.marks !== 'number' || !Number.isFinite(adjusted.marks) || adjusted.marks < 0 || adjusted.marks > criterion.maxMarks) throw new AppError(400, 'Teacher marks must be within each criterion weight.', 'VALIDATION_ERROR');
    return { name: criterion.name, maxMarks: criterion.maxMarks, marks: Math.round(adjusted.marks * 100) / 100 };
  });
  const score = Math.round(criteria.reduce((total, criterion) => total + criterion.marks, 0) * 100) / 100;
  const comment = text(req.body.comment, 'Teacher comments', { max: 5000 });
  const updated = await Project.findOneAndUpdate({ _id: project._id, supervisor: req.user._id, status: 'submitted', finalGrade: { $exists: false } }, {
    $set: { status: 'completed', finalGrade: { score, criteria, comment, finalizedBy: req.user._id, finalizedAt: new Date(), evaluation: original._id, submission: project.finalSubmission } },
  }, { returnDocument: 'after', runValidators: true });
  if (!updated) throw new AppError(409, 'The grade was already finalized or the supervisor assignment changed.', 'GRADE_LOCKED');
  await notify(req, project.members, { type: 'grade', project: project._id, resourceType: 'grade', resourceId: project._id, eventKey: `grade:${project._id}:finalized`, title: 'Final grade available', message: `${project.teamName}: your teacher has finalized the assessment. View your project for the final grade.` });
  res.json({ project: updated });
}
