import { LayoutDashboard, FolderKanban, Files, Sparkles, LibraryBig, Bell, Settings2 } from 'lucide-react';

export const navigation = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/projects', label: 'Projects & proposals', icon: FolderKanban },
  { path: '/documents', label: 'Documents', icon: Files },
  { path: '/evaluations', label: 'AI evaluations', icon: Sparkles },
  { path: '/resources', label: 'Resource library', icon: LibraryBig },
  { path: '/notifications', label: 'Notifications', icon: Bell },
];
export const settingsNavigation = { path: '/settings', label: 'System status', icon: Settings2 };
