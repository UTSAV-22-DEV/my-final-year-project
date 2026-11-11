import { CheckCircle2, CircleHelp, Database, Radio, RefreshCw, Server, ShieldCheck, Sparkles } from 'lucide-react';
import { useHealth } from '../context/HealthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import { useApi } from '../lib/useApi.js';
import { LoadingState } from '../components/LoadingState.jsx';
import { ErrorState } from '../components/ErrorState.jsx';

export function StatusPage() {
  const health = useHealth(); const ai = useApi('/evaluations/config'); const realtime = useNotifications();
  const data = health.data; const connected = data?.database?.status === 'connected';
  const refresh = () => { health.refresh(); ai.refresh(); realtime.refresh(); };
  const loading = health.loading || ai.loading;
  return <div className="page-stack"><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />ACADEMIC WORKSPACE</div><h1>System status</h1><p>A transparent view of the services behind your workspace.</p></div><button className="button secondary" onClick={refresh} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} aria-hidden="true" />Refresh status</button></div>
    {loading ? <LoadingState label="Checking workspace services…" /> : health.error ? <ErrorState message={health.error} onRetry={refresh} /> : <section className="panel status-panel" aria-label="Live service status"><div className="panel-heading"><div><h2>Service availability</h2><p>Last checked {new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p></div><span className="live-label"><span className="status-dot green" />LIVE CHECK</span></div>
      <StatusRow icon={Server} label="Express API" description="The application server is responding to health checks." status="Connected" healthy />
      <StatusRow icon={Database} label="MongoDB" description={connected ? 'The configured database connection is active.' : 'MongoDB is disconnected. Persistent operations require a working connection.'} status={connected ? 'Connected' : 'Not connected'} healthy={connected} />
      <StatusRow icon={Radio} label="Socket.IO" description="Private notification delivery uses your authenticated session." status={realtime.connected ? 'Connected' : data.realtime.status === 'initialized' ? 'Reconnecting' : 'Unavailable'} healthy={realtime.connected} />
      <StatusRow icon={ShieldCheck} label="Authentication" description="HttpOnly cookies, verified roles and account restrictions are active." status="Enabled" healthy />
      <StatusRow icon={Sparkles} label="Groq evaluation" description={ai.error ? 'AI configuration could not be checked.' : ai.data?.configured ? `Configured model: ${ai.data.model}. Preliminary rubric-based feedback; teachers finalize grades.` : 'Add the Groq API key in the server environment to enable real evaluations.'} status={ai.data?.configured ? 'Configured' : 'Not configured'} healthy={Boolean(ai.data?.configured)} />
    </section>}
    {!connected && !loading && !health.error && <section className="setup-note"><CircleHelp size={22} aria-hidden="true" /><div><h2>Database connection needs attention.</h2><p>Check the MongoDB connection and restart the backend if configuration changed.</p></div></section>}
    <section className="panel scope-panel"><h2>Workspace capabilities</h2><div className="scope-grid">{['Student, teacher and admin dashboards', 'Groups and supervisor assignments', 'Proposal review and revision history', 'Private PDF and DOCX exchange', 'Two successful AI review attempts', 'Teacher-controlled final grades', 'Persistent real-time notifications', 'Repeatable development demo seed'].map((text) => <div key={text}><CheckCircle2 size={17} aria-hidden="true" />{text}</div>)}</div><p>AI input is limited to {ai.data?.maxCharacters?.toLocaleString() || 'the configured number of'} characters and 200 PDF pages. OCR is not enabled. No simulated evaluator is used.</p></section>
  </div>;
}
function StatusRow({ icon: Icon, label, description, status, healthy = false }) {
  return <div className="status-row"><span className="icon-tile indigo"><Icon size={20} aria-hidden="true" /></span><div><h3>{label}</h3><p>{description}</p></div><span className={`service-badge ${healthy ? 'available' : 'pending'}`}><span className={`status-dot ${healthy ? 'green' : 'amber'}`} />{status}</span></div>;
}
