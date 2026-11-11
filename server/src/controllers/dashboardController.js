import { User, Project, Proposal, Submission, Feedback, Notification } from '../models/index.js';
import { projectScope } from '../services/accessService.js';

export async function dashboard(req, res) {
  const role = req.user.role;
  const allProjects = await Project.find(projectScope(req.user)).select('title status teamName members supervisor updatedAt createdAt').populate('supervisor', 'name').sort({ updatedAt: -1 }).lean();
  const projectIds = allProjects.map((project) => project._id);
  const scope = { project: { $in: projectIds } };
  const [pendingProposals, recentProposals, recentSubmissions, recentFeedback, notifications] = await Promise.all([
    Proposal.countDocuments({ ...scope, status: 'pending' }),
    Proposal.find(scope).select('title status updatedAt project').sort({ updatedAt: -1 }).limit(4).lean(),
    Submission.find(scope).select('document.originalName stage submittedAt project').sort({ submittedAt: -1 }).limit(4).lean(),
    Feedback.find(scope).select('message createdAt project').sort({ createdAt: -1 }).limit(4).lean(),
    Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(4).lean(),
  ]);
  let counts;
  if (role === 'admin') {
    const [students, teachers] = await Promise.all([User.countDocuments({ role: 'student' }), User.countDocuments({ role: 'teacher' })]);
    counts = { students, teachers, projects: allProjects.length, activeProjects: allProjects.filter((project) => project.status === 'active').length };
  } else if (role === 'teacher') {
    const reviewed = await Feedback.find({ ...scope, submission: { $exists: true } }).distinct('submission');
    const pendingReviews = await Submission.countDocuments({ ...scope, _id: { $nin: reviewed } });
    counts = { projects: allProjects.length, pendingProposals, pendingReviews, students: new Set(allProjects.flatMap((project) => project.members.map(String))).size };
  } else {
    const submittedProjects = await Submission.find({ ...scope, stage: 'final' }).distinct('project');
    counts = { projects: allProjects.length, pendingProposals,
      approvedProjects: allProjects.filter((project) => ['active', 'submitted', 'completed'].includes(project.status)).length,
      pendingSubmissions: allProjects.filter((project) => project.status !== 'completed' && !submittedProjects.some((id) => String(id) === String(project._id))).length };
  }
  const activity = [
    ...recentProposals.map((item) => ({ id: String(item._id), title: item.title, detail: `Proposal ${item.status.replaceAll('_', ' ')}`, date: item.updatedAt })),
    ...recentSubmissions.map((item) => ({ id: String(item._id), title: item.document.originalName, detail: `${item.stage} document submitted`, date: item.submittedAt })),
    ...recentFeedback.map((item) => ({ id: String(item._id), title: 'Supervisor feedback', detail: item.message.slice(0, 140), date: item.createdAt })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  if (role === 'admin') {
    const records = await Notification.find({ recipient: req.user._id, type: 'system', actor: { $exists: true } }).sort({ createdAt: -1 }).limit(6).lean();
    activity.splice(0, activity.length, ...records.map((item) => ({ id: String(item._id), title: item.title, detail: item.message, date: item.createdAt })));
  }
  res.json({ role, counts, projects: allProjects.slice(0, 6), activity, notifications });
}
