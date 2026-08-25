export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  primary: string; // Hex color
  primaryHover: string;
  secondary: string;
  gradientFrom: string;
  gradientTo: string;
  glowColor: string;
  badgeBg: string;
  badgeText: string;
  avatarBg: string;
  borderClass: string;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "emerald",
    name: "Emerald Aurora",
    description: "Sleek environmental emerald and energetic teal tones.",
    primary: "#10b981",
    primaryHover: "#059669",
    secondary: "#14b8a6",
    gradientFrom: "#10b981",
    gradientTo: "#2dd4bf",
    glowColor: "rgba(16, 185, 129, 0.25)",
    badgeBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    badgeText: "text-emerald-600 dark:text-emerald-400",
    avatarBg: "bg-emerald-500/10 text-emerald-500",
    borderClass: "border-emerald-500"
  },
  {
    id: "violet",
    name: "Royal Amethyst",
    description: "Deep luxurious amethyst violet and warm orchid pink.",
    primary: "#8b5cf6",
    primaryHover: "#7c3aed",
    secondary: "#ec4899",
    gradientFrom: "#8b5cf6",
    gradientTo: "#ec4899",
    glowColor: "rgba(139, 92, 246, 0.25)",
    badgeBg: "bg-violet-500/10 dark:bg-violet-500/20",
    badgeText: "text-violet-600 dark:text-violet-400",
    avatarBg: "bg-violet-500/10 text-violet-500",
    borderClass: "border-violet-500"
  },
  {
    id: "oceanic",
    name: "Oceanic Sapphire",
    description: "Deep navy ocean blue with bright sky-cyan elements.",
    primary: "#3b82f6",
    primaryHover: "#2563eb",
    secondary: "#06b6d4",
    gradientFrom: "#3b82f6",
    gradientTo: "#06b6d4",
    glowColor: "rgba(59, 130, 246, 0.25)",
    badgeBg: "bg-blue-500/10 dark:bg-blue-500/20",
    badgeText: "text-blue-600 dark:text-blue-400",
    avatarBg: "bg-blue-500/10 text-blue-500",
    borderClass: "border-blue-500"
  },
  {
    id: "amber",
    name: "Sunset Gold",
    description: "Warm glowing solar amber and energetic fire orange.",
    primary: "#f59e0b",
    primaryHover: "#d97706",
    secondary: "#f97316",
    gradientFrom: "#f59e0b",
    gradientTo: "#ef4444",
    glowColor: "rgba(245, 158, 11, 0.25)",
    badgeBg: "bg-amber-500/10 dark:bg-amber-500/20",
    badgeText: "text-amber-600 dark:text-amber-400",
    avatarBg: "bg-amber-500/10 text-amber-500",
    borderClass: "border-amber-500"
  },
  {
    id: "crimson",
    name: "Crimson Rose",
    description: "Vibrant wild rose red with hot passionate coral flare.",
    primary: "#f43f5e",
    primaryHover: "#e11d48",
    secondary: "#f97316",
    gradientFrom: "#f43f5e",
    gradientTo: "#f97316",
    glowColor: "rgba(244, 63, 94, 0.25)",
    badgeBg: "bg-rose-500/10 dark:bg-rose-500/20",
    badgeText: "text-rose-600 dark:text-rose-400",
    avatarBg: "bg-rose-500/10 text-rose-500",
    borderClass: "border-rose-500"
  },
  {
    id: "teal",
    name: "Teal Obsidian",
    description: "Futuristic dark cyber teal with cool emerald neon glow.",
    primary: "#0d9488",
    primaryHover: "#0f766e",
    secondary: "#10b981",
    gradientFrom: "#0d9488",
    gradientTo: "#10b981",
    glowColor: "rgba(13, 148, 136, 0.25)",
    badgeBg: "bg-teal-500/10 dark:bg-teal-500/20",
    badgeText: "text-teal-600 dark:text-teal-400",
    avatarBg: "bg-teal-500/10 text-teal-500",
    borderClass: "border-teal-500"
  }
];
