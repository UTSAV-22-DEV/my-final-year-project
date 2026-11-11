import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { OverviewPage } from './pages/OverviewPage.jsx';
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
import { EvaluationPage } from './pages/EvaluationPage.jsx';
import { NotificationsPage } from './pages/NotificationsPage.jsx';

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
      <Route path={`${role}/evaluations`} element={<EvaluationPage />} />
      <Route path={`${role}/notifications`} element={<NotificationsPage />} />
      <Route path={`${role}/profile`} element={<ProfilePage />} />
      <Route path={`${role}/resources`} element={<ResourcesPage />} />
    </Route>)}
    <Route element={<ProtectedRoute roles={['admin']} />}><Route path="admin/students" element={<UserManagementPage role="student" />} /><Route path="admin/teachers" element={<UserManagementPage role="teacher" />} /><Route path="admin/groups" element={<GroupsPage />} /><Route path="admin/assignments" element={<AssignmentsPage />} /><Route path="admin/settings" element={<StatusPage />} /></Route>
    <Route path="projects" element={<LegacyRedirect page="projects" />} />
    <Route path="documents" element={<LegacyRedirect page="documents" />} />
    <Route path="evaluations" element={<LegacyRedirect page="evaluations" />} />
    <Route path="resources" element={<LegacyRedirect page="resources" />} />
    <Route path="notifications" element={<LegacyRedirect page="notifications" />} />
    <Route path="settings" element={<StatusPage />} /><Route path="*" element={<NotFoundPage />} /></Route></Route></Routes>;
}

function HomeRedirect() { const { user } = useAuth(); return <Navigate to={`/${user.role}/dashboard`} replace />; }
function LegacyRedirect({ page }) { const { user } = useAuth(); return <Navigate to={`/${user.role}/${page}`} replace />; }
