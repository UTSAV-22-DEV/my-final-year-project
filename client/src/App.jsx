import { Route, Routes } from 'react-router-dom';
import { Bell, Files, FolderKanban, LibraryBig, Sparkles } from 'lucide-react';
import { Layout } from './components/Layout.jsx';
import { OverviewPage } from './pages/OverviewPage.jsx';
import { ModulePage } from './pages/ModulePage.jsx';
import { StatusPage } from './pages/StatusPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';

export function App() {
  return <Routes><Route element={<Layout />}><Route index element={<OverviewPage />} />
    <Route path="projects" element={<ModulePage title="Projects & proposals" subtitle="Turn your team's ideas into a well-supported project." icon={FolderKanban} description="A shared project space will connect student groups with their supervisors, proposals, and progress." features={['Student groups and assigned supervisors', 'Proposal submission and review status', 'Clear project ownership and role-based access']} />} />
    <Route path="documents" element={<ModulePage title="Documents" subtitle="Keep every report connected to its project." icon={Files} description="Students and supervisors will exchange academic documents and keep feedback close to the work." features={['PDF and DOCX documents', 'Authorized access and private file storage', 'Report replacement and final submission']} />} />
    <Route path="evaluations" element={<ModulePage title="AI evaluations" subtitle="Helpful perspective. Human judgment at the center." icon={Sparkles} description="Grok will provide preliminary rubric-based feedback so students can improve their reports before a teacher's final review." features={['Ten weighted criteria totaling 100 marks', 'Two AI-assisted attempts before final submission', 'Teacher review and control over final grades']} />} />
    <Route path="resources" element={<ModulePage title="Resource library" subtitle="A home for the material that moves your work forward." icon={LibraryBig} description="Teacher-provided resources will give student groups one place to find academic guidance and supporting documents." features={['Resources shared by teachers', 'Academic and project-specific materials', 'Authorized PDF and DOCX downloads']} />} />
    <Route path="notifications" element={<ModulePage title="Notifications" subtitle="Stay in step with the people behind your project." icon={Bell} description="Project updates will reach the right people through saved notifications and authenticated real-time connections." features={['Proposal and submission updates', 'New feedback and evaluation notices', 'Persistent notifications with read status']} />} />
    <Route path="settings" element={<StatusPage />} /><Route path="*" element={<NotFoundPage />} /></Route></Routes>;
}
