import { Navigate, Route, Routes } from 'react-router-dom';
import { Bell, Files, FolderKanban, LibraryBig, Sparkles } from 'lucide-react';
import { Layout } from './components/Layout.jsx';
import { OverviewPage } from './pages/OverviewPage.jsx';
import { ModulePage } from './pages/ModulePage.jsx';
import { StatusPage } from './pages/StatusPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { AuthPage } from './pages/AuthPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { AssignmentsPage } from './pages/AssignmentsPage.jsx';
import { UserManagementPage } from './pages/UserManagementPage.jsx';
import { RecordsPage, ProjectDetailPage, ProfilePage } from './pages/RecordsPage.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { GroupsPage } from './pages/GroupsPage.jsx';
import { ProposalsPage, DocumentsPage, FeedbackPage, ResourcesPage, SubmissionDetailPage } from './pages/WorkflowPages.jsx';

export function App() {
  return <Routes><Route path="login" element={<AuthPage />} /><Route path="register" element={<AuthPage registration />} /><Route element={<ProtectedRoute />}><Route element={<Layout />}><Route index element={<HomeRedirect />} /><Route path="foundation" element={<OverviewPage />} />
    {['student', 'teacher', 'admin'].map((role) => <Route key={role} element={<ProtectedRoute roles={[role]} />}>
      <Route path={`${role}/dashboard`} element={<DashboardPage />} />
      <Route path={`${role}/projects`} element={<RecordsPage kind="projects" />} />
      <Route path={`${role}/group`} element={<RecordsPage kind="projects" />} />
      <Route path={`${role}/projects/:id`} element={<ProjectDetailPage />} />
      <Route path={`${role}/proposals`} element={<ProposalsPage />} />
      <Route path={`${role}/documents`} element={<DocumentsPage />} />
      <Route path={`${role}/documents/:id`} element={<SubmissionDetailPage />} />
      <Route path={`${role}/feedback`} element={<FeedbackPage />} />
      <Route path={`${role}/evaluations`} element={<RecordsPage kind="evaluations" />} />
      <Route path={`${role}/notifications`} element={<RecordsPage kind="notifications" />} />
      <Route path={`${role}/profile`} element={<ProfilePage />} />
      <Route path={`${role}/resources`} element={<ResourcesPage />} />
    </Route>)}
    <Route element={<ProtectedRoute roles={['admin']} />}><Route path="admin/students" element={<UserManagementPage role="student" />} /><Route path="admin/teachers" element={<UserManagementPage role="teacher" />} /><Route path="admin/groups" element={<GroupsPage />} /><Route path="admin/assignments" element={<AssignmentsPage />} /><Route path="admin/settings" element={<StatusPage />} /></Route>
    <Route path="projects" element={<ModulePage title="Projects & proposals" subtitle="Turn your team's ideas into a well-supported project." icon={FolderKanban} description="A shared project space will connect student groups with their supervisors, proposals, and progress." features={['Student groups and assigned supervisors', 'Proposal submission and review status', 'Clear project ownership and role-based access']} />} />
    <Route path="documents" element={<ModulePage title="Documents" subtitle="Keep every report connected to its project." icon={Files} description="Students and supervisors will exchange academic documents and keep feedback close to the work." features={['PDF and DOCX documents', 'Authorized access and private file storage', 'Report replacement and final submission']} />} />
    <Route path="evaluations" element={<ModulePage title="AI evaluations" subtitle="Helpful perspective. Human judgment at the center." icon={Sparkles} description="Grok will provide preliminary rubric-based feedback so students can improve their reports before a teacher's final review." features={['Ten weighted criteria totaling 100 marks', 'Two AI-assisted attempts before final submission', 'Teacher review and control over final grades']} />} />
    <Route path="resources" element={<ModulePage title="Resource library" subtitle="A home for the material that moves your work forward." icon={LibraryBig} description="Teacher-provided resources will give student groups one place to find academic guidance and supporting documents." features={['Resources shared by teachers', 'Academic and project-specific materials', 'Authorized PDF and DOCX downloads']} />} />
    <Route path="notifications" element={<ModulePage title="Notifications" subtitle="Stay in step with the people behind your project." icon={Bell} description="Project updates will reach the right people through saved notifications and authenticated real-time connections." features={['Proposal and submission updates', 'New feedback and evaluation notices', 'Persistent notifications with read status']} />} />
    <Route path="settings" element={<StatusPage />} /><Route path="*" element={<NotFoundPage />} /></Route></Route></Routes>;
}

function HomeRedirect() { const { user } = useAuth(); return <Navigate to={`/${user.role}/dashboard`} replace />; }
