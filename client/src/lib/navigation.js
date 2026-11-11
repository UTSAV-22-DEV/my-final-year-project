import { LayoutDashboard, FolderKanban, Files, Sparkles, LibraryBig, Bell, Settings2, Users, UserRound, MessageSquareText, ClipboardCheck, Network } from 'lucide-react';

export const navigation = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/projects', label: 'Projects & proposals', icon: FolderKanban },
  { path: '/documents', label: 'Documents', icon: Files },
  { path: '/evaluations', label: 'AI evaluations', icon: Sparkles },
  { path: '/resources', label: 'Resource library', icon: LibraryBig },
  { path: '/notifications', label: 'Notifications', icon: Bell },
];
export const settingsNavigation = { path: '/settings', label: 'System status', icon: Settings2 };

export function roleNavigation(role) {
  const items = role === 'admin' ? [
    ['dashboard', 'Dashboard', LayoutDashboard], ['students', 'Students', Users], ['teachers', 'Teachers', GraduationIcon],
    ['projects', 'Projects', FolderKanban], ['groups', 'Groups', Network], ['assignments', 'Assignments', ClipboardCheck],
    ['notifications', 'Notifications', Bell], ['settings', 'Settings', Settings2],
  ] : role === 'teacher' ? [
    ['dashboard', 'Dashboard', LayoutDashboard], ['projects', 'Assigned Projects', FolderKanban], ['proposals', 'Proposal Reviews', ClipboardCheck],
    ['documents', 'Submissions', Files], ['feedback', 'Feedback', MessageSquareText], ['resources', 'Resources', LibraryBig],
    ['notifications', 'Notifications', Bell], ['profile', 'Profile', UserRound],
  ] : [
    ['dashboard', 'Dashboard', LayoutDashboard], ['projects', 'My Projects', FolderKanban], ['proposals', 'Proposals', ClipboardCheck],
    ['documents', 'Documents', Files], ['evaluations', 'AI Evaluation', Sparkles], ['feedback', 'Feedback', MessageSquareText],
    ['notifications', 'Notifications', Bell], ['profile', 'Profile', UserRound],
  ];
  return items.map(([path, label, icon]) => ({ path: `/${role}/${path}`, label, icon }));
}
const GraduationIcon = UserRound;
