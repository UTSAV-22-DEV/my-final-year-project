import { Router } from 'express';
import { health, readiness } from '../controllers/healthController.js';
import { rateLimit } from 'express-rate-limit';
import { currentUser, login, logout, register } from '../controllers/authController.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { databaseReady } from '../middleware/databaseReady.js';
import { validateObjectId } from '../middleware/validate.js';
import { clearSessionCookie } from '../services/sessionService.js';
import { dashboard } from '../controllers/dashboardController.js';
import * as workspace from '../controllers/workspaceController.js';
import * as admin from '../controllers/adminController.js';
import { Proposal, Submission, Feedback, Evaluation } from '../models/index.js';
import * as proposals from '../controllers/proposalController.js';
import * as groups from '../controllers/groupController.js';
import * as documents from '../controllers/documentController.js';
import { upload } from '../config/upload.js';

export const apiRouter = Router();
apiRouter.get('/health', health);
apiRouter.get('/health/ready', readiness);
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, skipSuccessfulRequests: true,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Please try again later.' } },
});
apiRouter.post('/auth/register', authLimiter, databaseReady, register);
apiRouter.post('/auth/login', authLimiter, databaseReady, login);
apiRouter.post('/auth/logout', (req, res, next) => authenticate(req, res, (error) => {
  if (error?.status === 401) { clearSessionCookie(res); return res.status(204).end(); }
  if (error) return next(error);
  next();
}), logout);
apiRouter.get('/auth/me', authenticate, currentUser);
apiRouter.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

for (const role of ['student', 'teacher', 'admin']) apiRouter.get(`/${role}/dashboard`, authenticate, allowRoles(role), dashboard);

apiRouter.get('/projects', authenticate, workspace.projects);
apiRouter.get('/projects/:id', authenticate, validateObjectId(), workspace.project);
apiRouter.get('/proposals', authenticate, workspace.proposals);
apiRouter.get('/proposals/:id', authenticate, validateObjectId(), workspace.scopedRecord(Proposal, 'proposal'));
apiRouter.post('/proposals', authenticate, allowRoles('student'), proposals.createProposal);
apiRouter.patch('/proposals/:id', authenticate, allowRoles('student'), validateObjectId(), proposals.editProposal);
apiRouter.post('/proposals/:id/submit', authenticate, allowRoles('student'), validateObjectId(), proposals.submitProposal);
apiRouter.patch('/proposals/:id/review', authenticate, allowRoles('teacher', 'admin'), validateObjectId(), proposals.reviewProposal);
apiRouter.get('/submissions', authenticate, workspace.submissions);
apiRouter.get('/submissions/:id', authenticate, validateObjectId(), workspace.scopedRecord(Submission, 'submission'));
apiRouter.get('/feedback', authenticate, workspace.feedback);
apiRouter.get('/feedback/:id', authenticate, validateObjectId(), workspace.scopedRecord(Feedback, 'feedback'));
apiRouter.post('/feedback', authenticate, allowRoles('teacher'), workspace.createFeedback);
apiRouter.patch('/feedback/:id', authenticate, allowRoles('teacher'), validateObjectId(), workspace.updateFeedback);
apiRouter.get('/evaluations', authenticate, workspace.evaluations);
apiRouter.get('/evaluations/:id', authenticate, validateObjectId(), workspace.scopedRecord(Evaluation, 'evaluation'));
apiRouter.get('/notifications', authenticate, workspace.notifications);
apiRouter.patch('/notifications/:id/read', authenticate, validateObjectId(), workspace.readNotification);
apiRouter.get('/teacher/students', authenticate, allowRoles('teacher'), workspace.assignedStudents);
apiRouter.get('/admin/users', authenticate, allowRoles('admin'), admin.users);
apiRouter.post('/admin/users', authenticate, allowRoles('admin'), admin.createUser);
apiRouter.patch('/admin/users/:id/status', authenticate, allowRoles('admin'), validateObjectId(), admin.setAccountStatus);
apiRouter.get('/admin/projects', authenticate, allowRoles('admin'), workspace.projects);
apiRouter.patch('/admin/projects/:id/supervisor', authenticate, allowRoles('admin'), validateObjectId(), admin.assignTeacher);
apiRouter.get('/groups', authenticate, workspace.projects);
apiRouter.get('/teachers', authenticate, workspace.availableTeachers);
apiRouter.post('/admin/projects', authenticate, allowRoles('admin'), groups.createGroup);
apiRouter.patch('/admin/projects/:id/group', authenticate, allowRoles('admin'), validateObjectId(), groups.updateGroup);
apiRouter.post('/projects/:id/submissions', authenticate, allowRoles('student'), validateObjectId(), documents.authorizeProjectUpload, upload.single('document'), documents.uploadSubmission);
apiRouter.post('/submissions/:id/replace', authenticate, allowRoles('student'), validateObjectId(), documents.authorizeReplacement, upload.single('document'), documents.uploadSubmission);
apiRouter.get('/submissions/:id/download', authenticate, validateObjectId(), documents.downloadSubmission);
apiRouter.get('/resources', authenticate, documents.resources);
apiRouter.post('/projects/:id/resources', authenticate, allowRoles('teacher'), validateObjectId(), documents.authorizeProjectUpload, upload.single('document'), documents.uploadResource);
apiRouter.get('/resources/:id/download', authenticate, validateObjectId(), documents.downloadResource);
