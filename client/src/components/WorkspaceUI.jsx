import { FolderOpen, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PageHeading({ eyebrow = 'ACADEMIC WORKSPACE', title, subtitle, children }) {
  return <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{children}</div>;
}
export function Badge({ status }) { return <span className={`record-badge ${status}`}>{String(status).replaceAll('_', ' ')}</span>; }
export function EmptyState({ title = 'Nothing here yet', message, icon: Icon = Inbox }) {
  return <div className="empty-state"><Icon size={30} strokeWidth={1.4} aria-hidden="true" /><h3>{title}</h3><p>{message || 'Updates will appear here when there is activity in your workspace.'}</p></div>;
}
export function SkeletonCards() { return <div className="dashboard-skeleton" role="status" aria-label="Loading workspace data"><div /><div /><div /><div /><section /></div>; }
export function ProjectCards({ projects, role }) {
  if (!projects.length) return <EmptyState icon={FolderOpen} title="Your project space is ready" message="Projects will appear here when a group is created or assigned to you." />;
  return <div className="project-card-grid">{projects.map((project) => <article className="project-record-card" key={project._id}><div className="project-card-top"><span className="icon-tile indigo"><FolderOpen size={20} aria-hidden="true" /></span><Badge status={project.status} /></div><h3>{project.title}</h3><p>{project.teamName || 'Project group'} · {project.members.length} {project.members.length === 1 ? 'member' : 'members'}</p><div className="project-card-footer"><span>{project.supervisor?.name || 'Supervisor not assigned'}</span><Link to={`/${role}/projects/${project._id}`}>View project →</Link></div></article>)}</div>;
}
export function DateLabel({ value }) { return <time dateTime={value}>{new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</time>; }
