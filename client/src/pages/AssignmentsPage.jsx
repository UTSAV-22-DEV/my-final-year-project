import { useState } from 'react';
import { useApi, dataChanged } from '../lib/useApi.js';
import { apiRequest } from '../lib/api.js';
import { ErrorState } from '../components/ErrorState.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { Badge, EmptyState, PageHeading } from '../components/WorkspaceUI.jsx';

export function AssignmentsPage() { return <div className="page-stack"><PageHeading title="Supervisor assignments" subtitle="Connect each project group with an active teacher." /><section className="panel dashboard-section"><AssignmentsPanel /></section></div>; }
export function AssignmentsPanel({ compact = false }) {
  const projects = useApi('/admin/projects');
  const teachers = useApi('/admin/users?role=teacher');
  const [busy, setBusy] = useState(''); const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  async function assign(event, project) {
    event.preventDefault(); const teacherId = new FormData(event.currentTarget).get('teacherId');
    setBusy(project._id); setError(''); setNotice('');
    try { await apiRequest(`/admin/projects/${project._id}/supervisor`, { method: 'PATCH', body: JSON.stringify({ teacherId }) }); setNotice('Supervisor assignment saved.'); dataChanged(); }
    catch (failure) { setError(failure.message); } finally { setBusy(''); }
  }
  if (projects.loading || teachers.loading) return <LoadingState label="Loading assignments…" />;
  if (projects.error || teachers.error) return <ErrorState message={projects.error || teachers.error} onRetry={() => { projects.refresh(); teachers.refresh(); }} />;
  return <>{notice && <p className="form-success" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}{!projects.data.projects.length ? <EmptyState title="No project groups yet" /> : <div className="assignment-list">{(compact ? projects.data.projects.slice(0, 3) : projects.data.projects).map((project) => <article key={project._id}><div><strong>{project.title}</strong><p>{project.teamName || 'Project group'} · {project.members.length} members</p><Badge status={project.status} /></div><form className="assignment-form" onSubmit={(event) => assign(event, project)}><label className="sr-only" htmlFor={`teacher-${project._id}`}>Supervisor for {project.title}</label><select id={`teacher-${project._id}`} name="teacherId" required defaultValue={project.supervisor?._id || ''} disabled={!!busy}><option value="">Select active teacher</option>{teachers.data.users.filter((user) => user.isActive).map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}</select><button className="button primary" disabled={!!busy}>{busy === project._id ? 'Saving…' : 'Save assignment'}</button></form></article>)}</div>}</>;
}
