import { useState } from 'react';
import { useApi, dataChanged } from '../lib/useApi.js';
import { apiRequest } from '../lib/api.js';
import { Badge, EmptyState, PageHeading, SkeletonCards } from '../components/WorkspaceUI.jsx';
import { ErrorState } from '../components/ErrorState.jsx';

export function GroupsPage() {
  const projects = useApi('/admin/projects?limit=100'); const students = useApi('/admin/users?role=student'); const teachers = useApi('/admin/users?role=teacher');
  const [editing, setEditing] = useState(null); const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState('');
  return <div className="page-stack"><PageHeading title="Group management" subtitle="Build student teams and connect them with academic supervision."><button className="button primary" onClick={() => { setEditing(null); setShowForm(true); }}>Create group</button></PageHeading>{notice && <p className="form-success" role="status">{notice}</p>}{projects.loading || students.loading || teachers.loading ? <SkeletonCards /> : projects.error || students.error || teachers.error ? <ErrorState message={projects.error || students.error || teachers.error} onRetry={() => { projects.refresh(); students.refresh(); teachers.refresh(); }} /> : <>{showForm && <GroupForm key={editing?._id || 'new'} current={editing} students={students.data.users} teachers={teachers.data.users} projects={projects.data.projects} onCancel={() => setShowForm(false)} onSuccess={() => { setShowForm(false); setNotice(editing ? 'Group membership updated.' : 'Project group created.'); dataChanged(); }} />}<section className="panel dashboard-section">{!projects.data.projects.length ? <EmptyState title="No groups yet" message="Create a group using existing student accounts." /> : <div className="record-list">{projects.data.projects.map((project) => <article key={project._id}><div className="section-heading"><h3>{project.teamName || 'Unnamed group'}</h3><Badge status={project.status} /></div><p>{project.title}<br />Supervisor: {project.supervisor?.name || 'Not assigned'}</p><div className="member-chips">{project.members.map((member) => <span key={member._id}>{member.name}</span>)}</div><button className="button secondary small" disabled={['submitted', 'completed'].includes(project.status)} onClick={() => { setEditing(project); setShowForm(true); window.scrollTo(0, 0); }}>Manage members</button></article>)}</div>}</section></>}</div>;
}

function GroupForm({ current, students, teachers, projects, onCancel, onSuccess }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const selected = current?.members.map((member) => member._id) || [];
  const assignedElsewhere = new Set(projects.filter((project) => project._id !== current?._id && project.status !== 'completed').flatMap((project) => project.members.map((member) => member._id)));
  async function submit(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const values = Object.fromEntries(form); values.members = form.getAll('members');
    if (!values.members.length) { setError('Select at least one student.'); return; }
    setBusy(true); setError('');
    try { await apiRequest(current ? `/admin/projects/${current._id}/group` : '/admin/projects', { method: current ? 'PATCH' : 'POST', body: JSON.stringify(values) }); onSuccess(); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <section className="panel dashboard-section"><form className="workspace-form form-grid" onSubmit={submit}><h2 className="form-wide">{current ? 'Update project group' : 'Create project group'}</h2><label>Group name<input name="teamName" required maxLength={100} defaultValue={current?.teamName} /></label><label>Project title<input name="title" required maxLength={200} defaultValue={current?.title} /></label><label className="form-wide">Summary<textarea name="summary" maxLength={5000} defaultValue={current?.summary} /></label>{!current && <label className="form-wide">Supervisor (optional)<select name="teacherId" defaultValue=""><option value="">Assign later</option>{teachers.filter((teacher) => teacher.isActive).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>}<fieldset className="form-wide member-picker"><legend>Student members</legend><p>Students can belong to one active group. Uncheck a member to remove them.</p>{students.filter((student) => student.isActive || selected.includes(student.id)).map((student) => <label key={student.id}><input type="checkbox" name="members" value={student.id} defaultChecked={selected.includes(student.id)} disabled={assignedElsewhere.has(student.id) || busy} /><span>{student.name}<small>{student.email}{assignedElsewhere.has(student.id) ? ' · Assigned to another group' : ''}</small></span></label>)}</fieldset>{error && <p className="form-error form-wide" role="alert">{error}</p>}<div className="preview-actions form-wide"><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save group'}</button><button type="button" className="button secondary" onClick={onCancel}>Cancel</button></div></form></section>;
}
