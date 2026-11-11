import { useState } from 'react';
import { apiRequest } from '../lib/api.js';
import { dataChanged, useApi } from '../lib/useApi.js';
import { useHealth } from '../context/HealthContext.jsx';
import { ErrorState } from './ErrorState.jsx';
import { LoadingState } from './LoadingState.jsx';

export function ProposalForm({ initial, onDone }) {
  const projects = useApi('/projects?limit=100'); const teachers = useApi('/teachers');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); values.submit = event.nativeEvent.submitter?.value !== 'draft';
    setBusy(true); setError('');
    try { await apiRequest(initial ? `/proposals/${initial._id}` : '/proposals', { method: initial ? 'PATCH' : 'POST', body: JSON.stringify(values) }); dataChanged(); onDone(initial ? 'Proposal changes saved.' : values.submit ? 'Proposal submitted for review.' : 'Draft saved.'); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  if (projects.loading || teachers.loading) return <LoadingState label="Loading proposal form…" />;
  if (projects.error || teachers.error) return <ErrorState message={projects.error || teachers.error} onRetry={() => { projects.refresh(); teachers.refresh(); }} />;
  return <form className="workspace-form form-grid" onSubmit={submit}><h2 className="form-wide">{initial ? 'Revise proposal' : 'New project proposal'}</h2><label className="form-wide">Project group<select name="projectId" required defaultValue={initial?.project?._id || ''} disabled={!!initial}><option value="">Select your project group</option>{projects.data.projects.filter((project) => ['draft', 'proposed'].includes(project.status) || project._id === initial?.project?._id).map((project) => <option key={project._id} value={project._id}>{project.teamName} · {project.title}</option>)}</select></label><label className="form-wide">Project title<input name="title" required maxLength={200} defaultValue={initial?.title} /></label>{[['abstract', 'Abstract'], ['problemStatement', 'Problem statement'], ['objectives', 'Objectives (one per line)'], ['methodology', 'Proposed methodology']].map(([name, label]) => <label className="form-wide" key={name}>{label}<textarea name={name} required maxLength={10000} defaultValue={Array.isArray(initial?.[name]) ? initial[name].join('\n') : initial?.[name]} /></label>)}<label>Project domain<input name="domain" required maxLength={150} defaultValue={initial?.domain} /></label><label>Preferred supervisor (optional)<select name="preferredSupervisorId" defaultValue={initial?.preferredSupervisors?.[0] || ''}><option value="">No preference</option>{teachers.data.teachers.map((teacher) => <option key={teacher._id} value={teacher._id}>{teacher.name}</option>)}</select></label><label className="form-wide">Technologies (one per line)<textarea name="technologies" required maxLength={3000} defaultValue={initial?.technologies?.join('\n')} /></label><p className="list-note form-wide">Team information is taken from your assigned group and recorded with the proposal.</p>{error && <p className="form-error form-wide" role="alert">{error}</p>}<div className="preview-actions form-wide"><button className="button primary" disabled={busy} value="submit">{busy ? 'Saving…' : initial ? 'Save revision' : 'Submit for review'}</button>{!initial && <button className="button secondary" disabled={busy} name="action" value="draft">Save draft</button>}<button type="button" className="button secondary" onClick={() => onDone('')}>Cancel</button></div></form>;
}

export function FeedbackForm({ initial, fixedProject, fixedSubmission, onDone }) {
  const projects = useApi('/projects?limit=100'); const submissions = useApi('/submissions?limit=100');
  const [projectId, setProjectId] = useState(fixedProject || initial?.project?._id || '');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); values.projectId = projectId; values.submissionId ||= initial?.submission?._id || fixedSubmission; if (!values.submissionId) delete values.submissionStatus;
    setBusy(true); setError('');
    try { await apiRequest(initial ? `/feedback/${initial._id}` : '/feedback', { method: initial ? 'PATCH' : 'POST', body: JSON.stringify(values) }); dataChanged(); onDone('Feedback saved.'); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  if (projects.loading || submissions.loading) return <LoadingState label="Loading feedback form…" />;
  if (projects.error || submissions.error) return <ErrorState message={projects.error || submissions.error} onRetry={() => { projects.refresh(); submissions.refresh(); }} />;
  return <form className="workspace-form form-grid" onSubmit={submit}><h2 className="form-wide">{initial ? 'Update feedback' : 'Give feedback'}</h2><label>Assigned project<select required value={projectId} disabled={!!initial || !!fixedProject} onChange={(event) => setProjectId(event.target.value)}><option value="">Select project</option>{projects.data.projects.map((project) => <option key={project._id} value={project._id}>{project.title}</option>)}</select></label><label>Submission (optional)<select name="submissionId" defaultValue={fixedSubmission || initial?.submission?._id || ''} disabled={!!initial}><option value="">General project feedback</option>{submissions.data.submissions.filter((submission) => submission.project._id === projectId).map((submission) => <option key={submission._id} value={submission._id}>Revision {submission.revision} · {submission.document.originalName}</option>)}</select></label><label>Category<select name="category" defaultValue={initial?.category || 'general'}><option value="general">General</option><option value="technical">Technical</option><option value="documentation">Documentation</option></select></label><label>Submission review status<select name="submissionStatus" defaultValue={initial?.submissionStatus || 'reviewed'}><option value="reviewed">Reviewed</option><option value="revision_required">Revision required</option><option value="approved">Approved</option></select></label><label className="form-wide">Feedback<textarea name="message" required maxLength={10000} defaultValue={initial?.message} /></label>{error && <p className="form-error form-wide" role="alert">{error}</p>}<div className="preview-actions form-wide"><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save feedback'}</button><button type="button" className="button secondary" onClick={() => onDone('')}>Cancel</button></div></form>;
}

export function UploadForm({ resource = false, replacement, onDone }) {
  const projects = useApi('/projects?limit=100'); const { data: health } = useHealth();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const file = form.get('document');
    const limit = health?.uploads?.maxFileSize || 10 * 1024 * 1024;
    if (!file?.size || !/\.(pdf|docx)$/i.test(file.name) || file.size > limit) { setError(`Choose a nonempty PDF or DOCX up to ${limit / 1024 / 1024} MB.`); return; }
    setBusy(true); setError('');
    const url = replacement ? `/submissions/${replacement._id}/replace` : `/projects/${form.get('projectId')}/${resource ? 'resources' : 'submissions'}`;
    try { await apiRequest(url, { method: 'POST', body: form }); dataChanged(); onDone(resource ? 'Resource shared with your project group.' : 'Document uploaded successfully.'); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  if (projects.loading) return <LoadingState label="Loading project groups…" />;
  if (projects.error) return <ErrorState message={projects.error} onRetry={projects.refresh} />;
  return <form className="workspace-form form-grid" onSubmit={submit}><h2 className="form-wide">{resource ? 'Share a resource' : replacement ? 'Resubmit document' : 'Upload project document'}</h2>{!replacement && <label className="form-wide">Project group<select name="projectId" required><option value="">Select project</option>{projects.data.projects.filter((project) => resource || !['submitted', 'completed'].includes(project.status)).map((project) => <option key={project._id} value={project._id}>{project.teamName} · {project.title}</option>)}</select></label>}{resource && <><label className="form-wide">Resource title<input name="title" required maxLength={200} /></label><label className="form-wide">Description<textarea name="description" maxLength={5000} /></label></>}<label className="form-wide">PDF or DOCX document<input type="file" name="document" required accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" /></label><p className="list-note form-wide">Files are stored privately. Resubmissions retain earlier reports as separate revisions.</p>{error && <p className="form-error form-wide" role="alert">{error}</p>}<div className="preview-actions form-wide"><button className="button primary" disabled={busy}>{busy ? 'Uploading…' : resource ? 'Share resource' : 'Upload document'}</button><button type="button" className="button secondary" onClick={() => onDone('')}>Cancel</button></div></form>;
}
