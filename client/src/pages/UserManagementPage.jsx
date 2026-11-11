import { useState } from 'react';
import { useApi, dataChanged } from '../lib/useApi.js';
import { apiRequest } from '../lib/api.js';
import { ErrorState } from '../components/ErrorState.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { Badge, EmptyState, PageHeading } from '../components/WorkspaceUI.jsx';

export function UserManagementPage({ role }) {
  return <div className="page-stack"><PageHeading title={role === 'teacher' ? 'Teachers' : 'Students'} subtitle="Create accounts and manage access to the academic workspace." /><section className="panel dashboard-section"><UserManagement role={role} /></section></div>;
}

export function UserManagement({ role, compact = false }) {
  const { data, loading, error, refresh } = useApi(`/admin/users${role ? `?role=${role}` : ''}`);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  async function create(event) {
    event.preventDefault(); const form = event.currentTarget;
    setBusy('create'); setFailure(''); setNotice('');
    try { await apiRequest('/admin/users', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); form.reset(); setNotice('Account created successfully.'); dataChanged(); }
    catch (error) { setFailure(error.message); } finally { setBusy(''); }
  }
  async function toggle(user) {
    setBusy(user.id); setFailure(''); setNotice('');
    try { await apiRequest(`/admin/users/${user.id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: !user.isActive }) }); setNotice('Account status updated.'); dataChanged(); }
    catch (error) { setFailure(error.message); } finally { setBusy(''); }
  }
  return <>{!compact && <form className="workspace-form form-grid" onSubmit={create}><h2 className="form-wide">Create {role || 'academic'} account</h2><label>Full name<input name="name" required maxLength={100} /></label><label>Email address<input name="email" type="email" required maxLength={254} /></label><label>Initial password<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} /></label><label>Role<select name="role" defaultValue={role || 'student'}><option value="student">Student</option><option value="teacher">Teacher</option></select></label><label>Department<input name="department" maxLength={120} /></label><label>Student ID (optional)<input name="studentId" maxLength={50} /></label><div className="form-wide"><button className="button primary" disabled={!!busy}>{busy === 'create' ? 'Creating…' : 'Create account'}</button></div></form>}
    {notice && <p className="form-success" role="status">{notice}</p>}{failure && <p className="form-error" role="alert">{failure}</p>}
    {loading ? <LoadingState label="Loading accounts…" /> : error ? <ErrorState message={error} onRetry={refresh} /> : !data.users.length ? <EmptyState title="No accounts yet" /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Access</th></tr></thead><tbody>{(compact ? data.users.slice(0, 5) : data.users).map((user) => <tr key={user.id}><td><strong>{user.name}</strong><small>{user.department}</small></td><td>{user.email}</td><td className="capitalize">{user.role}</td><td><Badge status={user.isActive ? 'active' : 'inactive'} /></td><td>{user.role !== 'admin' ? <button className="button secondary small" disabled={!!busy} onClick={() => toggle(user)}>{busy === user.id ? 'Saving…' : user.isActive ? 'Deactivate' : 'Activate'}</button> : <span className="muted-text">Protected</span>}</td></tr>)}</tbody></table>{!compact && <p className="list-note">Showing {data.users.length} of {data.total} accounts.</p>}</div>}</>;
}
