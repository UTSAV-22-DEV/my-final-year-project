import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi, dataChanged } from '../lib/useApi.js';
import { apiRequest } from '../lib/api.js';
import { Badge, DateLabel, EmptyState, PageHeading, ProjectCards, SkeletonCards } from '../components/WorkspaceUI.jsx';
import { ErrorState } from '../components/ErrorState.jsx';

const labels = { projects: 'Projects', proposals: 'Proposals', submissions: 'Documents', feedback: 'Feedback', evaluations: 'AI evaluation', notifications: 'Notifications' };
export function RecordsPage({ kind }) {
  const { user } = useAuth(); const { data, loading, error, refresh } = useApi(`/${kind}`);
  const [failure, setFailure] = useState('');
  async function markRead(id) { try { await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' }); dataChanged(); } catch (error) { setFailure(error.message); } }
  return <div className="page-stack"><PageHeading eyebrow={`${user.role.toUpperCase()} WORKSPACE`} title={kind === 'projects' ? user.role === 'teacher' ? 'Assigned projects' : user.role === 'student' ? 'My projects' : 'All projects' : labels[kind]} subtitle="Your authorized academic records, directly from the workspace." />{failure && <p className="form-error" role="alert">{failure}</p>}{loading ? <SkeletonCards /> : error ? <ErrorState message={error} onRetry={refresh} /> : kind === 'projects' ? <ProjectCards projects={data.projects} role={user.role} /> : <section className="panel dashboard-section">{!data[kind].length ? <EmptyState title={`No ${labels[kind].toLowerCase()} yet`} message={kind === 'evaluations' ? 'AI grading is reserved for Phase 4. No evaluation requests are enabled.' : 'Records will appear here when your project has activity.'} /> : <div className="record-list">{data[kind].map((record) => <article key={record._id}><div className="section-heading"><h3>{record.title || record.project?.title || record.document?.originalName || 'Project update'}</h3>{record.status && <Badge status={record.status} />}{record.stage && <Badge status={record.stage} />}</div><p>{record.abstract || record.message || record.reviewComment || record.document?.originalName || record.suggestions}</p>{record.reviewComment && <p><strong>Review:</strong> {record.reviewComment}</p>}<DateLabel value={record.updatedAt || record.createdAt} />{kind === 'notifications' && !record.readAt && <button className="button secondary small" onClick={() => markRead(record._id)}>Mark as read</button>}</article>)}</div>}</section>}</div>;
}

export function ProjectDetailPage() {
  const { id } = useParams(); const { user } = useAuth(); const { data, loading, error, refresh } = useApi(`/projects/${id}`);
  if (loading) return <SkeletonCards />; if (error) return <ErrorState message={error} onRetry={refresh} />;
  const project = data.project;
  return <div className="page-stack"><PageHeading title={project.title} subtitle={project.teamName || 'Academic project'}><Badge status={project.status} /></PageHeading><section className="panel dashboard-section"><h2>Project overview</h2><p className="body-copy">{project.summary || 'No project summary has been added yet.'}</p><p className="body-copy">Supervisor: <strong>{project.supervisor?.name || 'Not assigned'}</strong></p><h2>Group members</h2><div className="table-scroll"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Student ID</th></tr></thead><tbody>{project.members.map((member) => <tr key={member._id}><td>{member.name}</td><td>{member.email}</td><td>{member.studentId || '—'}</td></tr>)}</tbody></table></div><div className="preview-actions"><Link className="button secondary" to={`/${user.role}/proposals`}>View proposals</Link><Link className="button primary" to={`/${user.role}/documents`}>View documents</Link></div></section></div>;
}

export function ProfilePage() {
  const { user } = useAuth();
  return <div className="page-stack"><PageHeading title="Your profile" subtitle="Your account details and academic role." /><section className="panel dashboard-section profile-details"><div className="avatar profile-avatar">{user.name.slice(0, 2).toUpperCase()}</div><h2>{user.name}</h2><Badge status={user.role} /><dl><dt>Email</dt><dd>{user.email}</dd><dt>Department</dt><dd>{user.department || 'Not provided'}</dd><dt>Student ID</dt><dd>{user.studentId || 'Not applicable'}</dd><dt>Account status</dt><dd>{user.isActive ? 'Active' : 'Inactive'}</dd></dl></section></div>;
}
