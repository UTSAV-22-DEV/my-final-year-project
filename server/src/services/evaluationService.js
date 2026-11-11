import { randomUUID } from 'node:crypto';
import { Project, Submission, Evaluation } from '../models/index.js';
import { accessibleProject } from './accessService.js';
import { extractDocumentText } from './extractionService.js';
import { evaluateWithGroq, validateEvaluationResponse } from './groqService.js';
import { rubricVersion } from '../config/rubric.js';
import { notify } from './notificationService.js';
import { AppError } from '../utils/AppError.js';
import { config } from '../config/env.js';

export async function evaluateSubmission(req, submissionId) {
  const submission = await Submission.findById(submissionId);
  if (!submission) throw new AppError(404, 'This submission was not found.', 'NOT_FOUND');
  const accessible = await accessibleProject(req.user, submission.project);
  if (['submitted', 'completed'].includes(accessible.status)) throw new AppError(409, 'AI evaluation is locked after final submission.', 'PROJECT_FINALIZED');
  const lockId = randomUUID(); const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  const project = await Project.findOneAndUpdate({ _id: accessible._id, members: req.user._id,
    status: { $nin: ['submitted', 'completed'] },
    $or: [{ evaluationLock: { $exists: false } }, { 'evaluationLock.at': { $lt: staleBefore } }],
  }, { $set: { evaluationLock: { id: lockId, at: new Date() } } }, { returnDocument: 'after' });
  if (!project) throw new AppError(409, 'An evaluation is already running. Wait before trying again.', 'EVALUATION_IN_PROGRESS');
  let completed;
  try {
    // Persisted successful evaluations are the authoritative ledger. Counting it
    // under the project lock repairs counters after a process crash between writes.
    const previous = await Evaluation.find({ project: project._id, status: 'completed' }).sort({ attempt: 1 });
    if (previous.length >= 2) throw new AppError(409, 'This project has used both successful AI evaluation attempts.', 'ATTEMPT_LIMIT');
    const text = await extractDocumentText(submission.document);
    // Tests inject only the external API boundary; application requests always use Groq.
    const evaluator = req.app.get('evaluateReport') || evaluateWithGroq;
    const raw = await evaluator(text);
    const validated = validateEvaluationResponse(raw);
    completed = await Evaluation.create({ ...validated, project: project._id, submission: submission._id, requestedBy: req.user._id,
      attempt: previous.length + 1, status: 'completed', model: req.app.get('evaluationModel') || config.groqModel,
      rubricVersion, document: submission.document.toObject(), completedAt: new Date() });
    await notify(req, project.members, { type: 'evaluation', project: project._id, resourceType: 'evaluation', resourceId: completed._id, eventKey: `evaluation:${completed._id}:completed`, title: 'AI evaluation completed', message: `Attempt ${completed.attempt} is ready for ${project.teamName}. Scores are preliminary until teacher review.` });
    return completed;
  } finally {
    const count = await Evaluation.countDocuments({ project: project._id, status: 'completed' }).catch(() => null);
    try {
      await Project.updateOne({ _id: project._id, 'evaluationLock.id': lockId }, { $unset: { evaluationLock: 1 }, ...(count === null ? {} : { $set: { aiAttemptsUsed: count } }) });
    } catch {
      // A saved result remains a successful attempt. A five-minute lease expiry
      // lets the next request reconcile from the immutable successful records.
      console.error('[evaluation] Could not release the evaluation lease; retry after it expires.');
    }
  }
}
