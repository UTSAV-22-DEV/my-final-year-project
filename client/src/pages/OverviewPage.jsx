import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, Circle, Database, FileCheck2, FolderKanban, GraduationCap, Layers3, Radio, Server, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { useHealth } from '../context/HealthContext.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { ErrorState } from '../components/ErrorState.jsx';

const modules = [
  { path: '/projects', icon: FolderKanban, color: 'indigo', title: 'Projects & proposals', text: 'Give every idea a clear path from proposal to completion.' },
  { path: '/documents', icon: FileCheck2, color: 'teal', title: 'One place for your work', text: 'Keep academic reports and supervisor feedback together.' },
  { path: '/evaluations', icon: Sparkles, color: 'purple', title: 'AI-assisted assessment', text: 'Refine your report with rubric-based improvement suggestions.' },
];

export function OverviewPage() {
  const { data, loading, error, refresh } = useHealth();
  const connected = data?.database?.status === 'connected';
  const realtime = data?.realtime?.status === 'initialized';
  return (
    <div className="page-stack">
      <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />YOUR ACADEMIC WORKSPACE</div><h1>Great projects start here<span className="heading-dot">.</span></h1><p>A little structure. A lot of possibility. Your final year, all in one place.</p></div><span className="phase-label"><Layers3 size={14} aria-hidden="true" />Phase 1 · Foundation</span></div>

      <section className="hero-card" aria-labelledby="hero-title">
        <div className="hero-copy"><span className="hero-kicker"><span className="hero-kicker-dot" />PURPOSE-BUILT FOR YOUR FINAL YEAR</span><h2 id="hero-title">From a promising idea<br />to a project that matters.</h2><p>A shared space for students and supervisors to organize work,<br className="desktop-break" /> stay connected, and make every milestone count.</p><Link className="button hero-button" to="/settings">Explore your workspace <ArrowRight size={17} aria-hidden="true" /></Link><div className="hero-footnote"><ShieldCheck size={15} aria-hidden="true" />AI supports the process. Teachers make the final call.</div></div>
        <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="floating-chip chip-top"><span className="art-icon"><BookOpen size={17} /></span><div><strong>Ideas with direction</strong><span>Structure for every milestone</span></div><Check size={15} /></div><div className="art-main"><div className="art-main-icon"><GraduationCap size={40} strokeWidth={1.5} /></div><span>THE NEXT CHAPTER</span><strong>Starts with you.</strong><div className="art-lines"><i /><i /><i /></div></div><div className="floating-chip chip-bottom"><span className="art-icon purple"><Sparkles size={17} /></span><div><strong>AI + human insight</strong><span>A more thoughtful assessment</span></div></div><div className="art-spark spark-one">✦</div><div className="art-spark spark-two">✦</div></div>
      </section>

      <section aria-labelledby="services-title">
        <div className="section-heading"><h2 id="services-title">Your foundation, at a glance</h2><Link to="/settings" className="text-link">System details <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
        {loading ? <LoadingState label="Checking workspace services…" /> : error ? <ErrorState message={error} onRetry={refresh} /> : (
          <div className="service-grid">
            <ServiceCard icon={Server} color="indigo" label="Application API" value="Connected" detail="Backend is responding" status="green" />
            <ServiceCard icon={Database} color="teal" label="Database" value={connected ? 'Connected' : 'Setup required'} detail={connected ? 'MongoDB is available' : 'MongoDB is not connected'} status={connected ? 'green' : 'amber'} />
            <ServiceCard icon={Radio} color="purple" label="Real-time service" value={realtime ? 'Initialized' : 'Unavailable'} detail="Authenticated connections only" status={realtime ? 'green' : 'amber'} />
            <ServiceCard icon={Users} color="orange" label="Role architecture" value="3 roles" detail="Student · Teacher · Admin" status="violet" />
          </div>
        )}
      </section>

      <div className="overview-bottom">
        <section className="panel journey-panel" aria-labelledby="journey-title"><div className="panel-heading"><div><h2 id="journey-title">A workspace for the whole journey</h2><p>The foundation is ready. Academic workflows come next.</p></div><span className="soft-tag">COMING NEXT</span></div><div className="module-list">{modules.map(({ path, icon: Icon, color, title, text }) => <Link to={path} className="module-row" key={path}><span className={`icon-tile ${color}`}><Icon size={21} aria-hidden="true" /></span><div><h3>{title}</h3><p>{text}</p></div><ChevronRight size={18} aria-hidden="true" /></Link>)}</div><div className="panel-note"><ShieldCheck size={15} aria-hidden="true" /><span>Designed around clear ownership and teacher-led supervision.</span></div></section>

        <section className="panel roadmap-panel" aria-labelledby="roadmap-title"><div className="panel-heading"><div><h2 id="roadmap-title">The path ahead</h2><p>Building with a clear purpose.</p></div><span className="icon-tile mini indigo"><Layers3 size={17} aria-hidden="true" /></span></div><ol className="roadmap"><li className="current"><span className="roadmap-marker"><Check size={13} aria-hidden="true" /></span><div><div className="roadmap-title">Workspace foundation <span>NOW</span></div><p>Interface, models & service infrastructure</p></div></li><li><span className="roadmap-marker"><Circle size={8} aria-hidden="true" /></span><div><div className="roadmap-title">People & project workflows</div><p>Sign-in, proposals & supervision</p></div></li><li><span className="roadmap-marker"><Circle size={8} aria-hidden="true" /></span><div><div className="roadmap-title">Feedback & AI assessment</div><p>Documents, evaluations & final review</p></div></li></ol><Link to="/resources" className="roadmap-link">Explore the resource space <ArrowRight size={15} aria-hidden="true" /></Link></section>
      </div>
      <div className="scope-note"><span className="status-dot violet" /><span>Foundation preview</span><p>Academic records and workflows will be connected in a later phase.</p></div>
    </div>
  );
}

function ServiceCard({ icon: Icon, color, label, value, detail, status }) {
  return <article className="service-card"><div className="service-top"><span className={`icon-tile ${color}`}><Icon size={19} aria-hidden="true" /></span><span className={`status-dot ${status}`} /></div><h3>{label}</h3><strong>{value}</strong><p>{detail}</p></article>;
}
