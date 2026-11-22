import {
  Activity,
  BookOpen,
  CalendarDays,
  CalendarRange,
  Calculator,
  CheckSquare,
  Compass,
  Database,
  Download,
  FileText,
  Folder,
  Headphones,
  Home,
  Info,
  Layers,
  LogIn,
  Palette,
  Plug,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Wallet,
} from "lucide-react";

export const navigation = [
  {
    label: "Plan",
    entries: [
      { id: "today", label: "Today", icon: Home },
      { id: "tasks", label: "Inbox", icon: CheckSquare },
      { id: "calendar", label: "Calendar", icon: CalendarDays },
      { id: "projects", label: "Projects", icon: Folder },
      { id: "roadmap", label: "Long horizon", icon: CalendarRange },
      { id: "review", label: "Weekly review", icon: CheckSquare },
    ],
  },
  {
    label: "Study",
    entries: [
      { id: "school", label: "School", icon: BookOpen },
      { id: "imports", label: "Import port", icon: Download },
      { id: "learn", label: "Learn", icon: BookOpen },
      { id: "textbooks", label: "Textbooks & courses", icon: BookOpen },
      { id: "math", label: "Math Lab", icon: Calculator },
      { id: "learning", label: "Practice", icon: Layers },
      { id: "notes", label: "Knowledge", icon: FileText },
      { id: "ai", label: "AI assistant", icon: Sparkles },
    ],
  },
  {
    label: "Life",
    entries: [
      { id: "routines", label: "Routines", icon: Activity },
      { id: "life", label: "Wellbeing", icon: Activity },
      { id: "music", label: "Music", icon: Headphones },
      { id: "money", label: "Money", icon: Wallet },
      { id: "explore", label: "Explore", icon: Compass },
    ],
  },
  {
    label: "Workspace",
    entries: [
      { id: "settings", label: "Settings", icon: Settings },
      { id: "appearance", label: "Appearance", icon: Palette },
      { id: "login", label: "Sign in", icon: LogIn },
      { id: "account", label: "Account", icon: User },
      { id: "memory", label: "Memory", icon: Database },
      { id: "connections", label: "Connections", icon: Plug },
      { id: "privacy", label: "Data & privacy", icon: ShieldCheck },
      { id: "info", label: "About", icon: Info },
    ],
  },
];
export const pages = navigation.flatMap((group) => group.entries);
export const desktopCore = [
  "today",
  "tasks",
  "calendar",
  "routines",
  "learn",
  "textbooks",
  "school",
  "imports",
  "math",
  "notes",
  "ai",
  "music",
  "appearance",
  "settings",
];
export function currentRoute(hash: string) {
  const route = hash.replace(/^#\//, "");
  return pages.some((page) => page.id === route) ? route : "today";
}
