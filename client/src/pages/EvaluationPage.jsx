import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi, dataChanged } from '../lib/useApi.js';
import { apiRequest, apiUrl } from '../lib/api.js';
import { Badge, DateLabel, EmptyState, PageHeading, SkeletonCards } from '../components/WorkspaceUI.jsx';
import { UploadForm } from '../components/WorkflowForms.jsx';
import { ErrorState } from '../components/ErrorState.jsx';

export function EvaluationPage() {
  const { user } = useAuth(); const teacher = user.role !== 'student'; const [searchParams] = useSearchParams();
  const projects = useApi('/projects?limit=100'); const submissions = useApi('/submissions?limit=100');
  const evaluations = useApi('/evaluations?limit=100'); const settings = useApi('/evaluations/config');
  const [projectId, setProjectId] = useState(searchParams.get('project') || ''); const [submissionId, setSubmissionId] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false); const [confirmed, setConfirmed] = useState(false);
  const requests = [projects, submissions, evaluations, settings];
  if (requests.some((request) => request.loading)) return <SkeletonCards />;
  if (requests.some((request) => request.error)) return <ErrorState message={requests.find((request) => request.error).error} onRetry={() => requests.forEach((request) => request.refresh())} />;
  const project = projects.data.projects.find((project) => project._id === projectId);
  const history = evaluations.data.evaluations.filter((evaluation) => (evaluation.project?._id || evaluation.project) === projectId && evaluation.status === 'completed').sort((a, b) => a.attempt - b.attempt);
  const reports = submissions.data.submissions.filter((submission) => submission.project?._id === projectId);
  const latest = history.at(-1); const closed = project && ['submitted', 'completed'].includes(project.status);
  async function evaluate() {
    setBusy(true); setError(''); setNotice('');
    try { await apiRequest(`/submissions/${submissionId}/evaluate`, { method: 'POST', timeoutMs: 120000 }); setNotice('Grok evaluation completed. Your teacher will review the final assessment.'); dataChanged(); }
    catch (failure) { setError(failure.message || 'Evaluation could not complete. Refresh history before retrying.'); }
    finally { setBusy(false); }
  }
  async function finalSubmit() {
    setBusy(true); setError(''); setNotice('');
    try { await apiRequest(`/projects/${projectId}/final-submission`, { method: 'POST', body: JSON.stringify({ submissionId }) }); setNotice('Final report submitted for teacher assessment.'); dataChanged(); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <div className="page-stack"><PageHeading title={teacher ? 'Evaluation review' : 'AI-assisted evaluation'} subtitle={teacher ? 'Review the evidence and make the final academic decision.' : 'Use rubric-based feedback to refine your report before final assessment.'} />
    {!teacher && <div className="assessment-notice"><ShieldCheck size={20} aria-hidden="true" /><p>Reports are sent to xAI for preliminary feedback. AI scores support revision; your teacher controls the final grade. <strong>Demonstration rubric · 10 criteria · 100 marks.</strong></p></div>}
    {!teacher && !settings.data.configured && <div className="form-error" role="alert">The AI service is not configured. Your administrator must finish Grok service setup. No attempts are consumed while it is unavailable, and no simulated evaluations are enabled.</div>}
    <section className="panel dashboard-section workspace-form"><label>Project group<select value={projectId} onChange={(event) => { setProjectId(event.target.value); setSubmissionId(''); setConfirmed(false); setError(''); setNotice(''); }} disabled={busy}><option value="">Select a project group</option>{projects.data.projects.map((project) => <option key={project._id} value={project._id}>{project.teamName} · {project.title}</option>)}</select></label></section>
    {notice && <p className="form-success" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {!project ? <section className="panel"><EmptyState icon={Sparkles} title="Choose a project to begin" message="Evaluation history and assessment details are restricted to your authorized projects." /></section> : <>
      <div className="assessment-summary"><article><span>Successful AI attempts</span><strong>{history.length} / 2</strong></article><article><span>{closed ? 'Evaluation access' : 'Remaining attempts'}</span><strong>{closed ? 'Closed' : 2 - history.length}</strong></article><article><span>Latest preliminary AI score</span><strong>{latest ? `${latest.totalScore} / 100` : 'Not evaluated'}</strong></article><article><span>Project status</span><Badge status={project.status} /></article></div>
      <section className="panel dashboard-section"><h2>{project.teamName || 'Project group'}</h2><p className="body-copy">{project.title}<br />Members: {project.members.map((member) => member.name).join(', ')}<br />Supervisor: {project.supervisor?.name || 'Not assigned'}</p></section>
      {!teacher && !closed && <section className="panel dashboard-section"><div className="section-heading"><h2>Choose your report</h2><button className="button secondary small" onClick={() => setUploading(!uploading)} disabled={busy}>Upload report</button></div>{uploading && <UploadForm onDone={(message) => { setUploading(false); setNotice(message); }} />}<div className="workspace-form"><label>Project document<select value={submissionId} onChange={(event) => setSubmissionId(event.target.value)} disabled={busy}><option value="">Select an uploaded report</option>{reports.map((submission) => <option key={submission._id} value={submission._id}>Revision {submission.revision} · {submission.document.originalName}</option>)}</select></label><button className="button primary" disabled={busy || !submissionId || history.length >= 2 || !settings.data.configured} onClick={evaluate}>{busy ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}{busy ? 'Evaluating report…' : 'Evaluate with Grok'}</button><p className="list-note">Only successful evaluations consume attempts. Scanned PDFs require OCR and cannot be evaluated here. Long requests may take up to 90 seconds.</p></div></section>}
      {project.finalSubmission && <section className="panel dashboard-section"><div className="section-heading"><h2>Final report</h2><Badge status={project.finalGrade ? 'completed' : 'submitted'} /></div><a className="button secondary" href={apiUrl(`/submissions/${project.finalSubmission}/download`)}>Download final report</a><p className="list-note">Submitted <DateLabel value={project.finalSubmittedAt} /></p></section>}
      {latest && <ScoreBreakdown evaluation={latest} />}
      {user.role === 'teacher' && project.status === 'submitted' && latest && <GradeEditor key={latest._id} project={project} evaluation={latest} />}
      {project.finalGrade && <section className="panel dashboard-section"><div className="section-heading"><h2>Teacher-finalized grade</h2><strong className="final-score">{project.finalGrade.score} / 100</strong></div><p className="body-copy">{project.finalGrade.comment}</p><p className="list-note">Finalized <DateLabel value={project.finalGrade.finalizedAt} />. Original AI scores are preserved separately.</p><div className="grade-table">{project.finalGrade.criteria.map((criterion) => <div key={criterion.name}><span>{criterion.name}</span><strong>{criterion.marks} / {criterion.maxMarks}</strong></div>)}</div></section>}
      {!teacher && history.length > 0 && !closed && <section className="panel dashboard-section workspace-form"><h2>Final submission</h2><p className="body-copy">Choose your final report above. Final submission closes further uploads and AI evaluations, including any unused attempt.</p><label className="confirm-choice"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={busy} />I confirm the selected report is ready for final teacher assessment.</label><button className="button primary" disabled={busy || !confirmed || !submissionId} onClick={finalSubmit}>Submit final report</button></section>}
      <section className="panel dashboard-section"><h2>Evaluation history</h2>{!history.length ? <EmptyState title="No successful evaluations yet" message="Failed requests and invalid reports do not consume an attempt." /> : <div className="record-list">{history.map((evaluation) => <article key={evaluation._id}><div className="section-heading"><h3>Attempt {evaluation.attempt} · {evaluation.totalScore} / 100</h3><Badge status="completed" /></div><p>{evaluation.document?.originalName || evaluation.submission?.document?.originalName} · Model: {evaluation.model}</p><DateLabel value={evaluation.completedAt || evaluation.createdAt} /><details className="record-details"><summary>View this attempt's full assessment</summary><ScoreBreakdown evaluation={evaluation} embedded /></details></article>)}</div>}</section>
      {teacher && !project.finalSubmission && <p className="body-copy">This group has not submitted its final report. <Link className="text-link" to="/teacher/documents">View submitted documents →</Link></p>}
    </>}
  </div>;
}

function ScoreBreakdown({ evaluation, embedded = false }) {
  const Tag = embedded ? 'div' : 'section';
  return <Tag className={embedded ? 'score-breakdown' : 'panel dashboard-section score-breakdown'}><div className="section-heading"><h2>Preliminary AI assessment</h2><strong>{evaluation.totalScore} / 100</strong></div><p className="body-copy">{evaluation.suggestions}</p><div className="criterion-list">{evaluation.criteria.map((criterion) => <details key={criterion.name}><summary><span>{criterion.name}</span><strong>{criterion.marks} / {criterion.maxMarks}</strong></summary><p>{criterion.explanation}</p>{[['Strengths', criterion.strengths], ['Weaknesses', criterion.weaknesses], ['Improvements', criterion.improvements]].map(([label, items]) => <div key={label}><h4>{label}</h4><ul>{items?.map((item, index) => <li key={index}>{item}</li>)}</ul></div>)}</details>)}</div></Tag>;
}

function GradeEditor({ project, evaluation }) {
  const [marks, setMarks] = useState(evaluation.criteria.map((criterion) => criterion.marks));
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const total = Math.round(marks.reduce((sum, value) => sum + Number(value), 0) * 100) / 100;
  async function finalize(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await apiRequest(`/projects/${project._id}/final-grade`, { method: 'POST', body: JSON.stringify({ criteria: evaluation.criteria.map((criterion, index) => ({ name: criterion.name, marks: Number(marks[index]) })), comment: new FormData(event.currentTarget).get('comment') }) }); dataChanged(); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <section className="panel dashboard-section"><form className="workspace-form" onSubmit={finalize}><div className="section-heading"><h2>Teacher assessment</h2><strong className="final-score">{total} / 100</strong></div><p className="body-copy">Adjust the criterion scores after reviewing the final report. Finalization locks this grade. The AI assessment remains unchanged.</p><div className="grade-table">{evaluation.criteria.map((criterion, index) => <label key={criterion.name}><span>{criterion.name} <small>(maximum {criterion.maxMarks})</small></span><input aria-label={`Teacher marks for ${criterion.name}`} type="number" min="0" max={criterion.maxMarks} step="0.01" required value={marks[index]} onChange={(event) => setMarks(marks.map((value, position) => position === index ? event.target.value : value))} disabled={busy} /></label>)}</div><label>Teacher comments<textarea name="comment" required maxLength={5000} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy || !Number.isFinite(total) || total < 0 || total > 100}>{busy ? 'Finalizing…' : 'Finalize grade'}</button></form></section>;
}
