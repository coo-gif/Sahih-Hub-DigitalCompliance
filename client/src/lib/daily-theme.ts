export interface DailyTheme {
  name: string;
  hue: number;
  saturation: number;
  description: string;
}

export const dailyThemes: DailyTheme[] = [
  { name: "Sage", hue: 150, saturation: 35, description: "Fresh & Organic" },
  { name: "Ocean", hue: 200, saturation: 50, description: "Calm & Focused" },
  { name: "Lavender", hue: 270, saturation: 40, description: "Creative & Balanced" },
  { name: "Terracotta", hue: 25, saturation: 55, description: "Grounded & Earthy" },
  { name: "Teal", hue: 175, saturation: 45, description: "Refreshing & Uplifting" },
  { name: "Rose", hue: 340, saturation: 30, description: "Soft & Relaxed" },
  { name: "Amber", hue: 40, saturation: 60, description: "Warm & Peaceful" },
];

export function getDailyTheme(): DailyTheme {
  const dayOfWeek = new Date().getDay();
  return dailyThemes[dayOfWeek];
}

export function applyDailyTheme(): void {
  const theme = getDailyTheme();
  const root = document.documentElement;
  const h = theme.hue;
  const s = theme.saturation;
  const isDark = root.classList.contains('dark');

  if (isDark) {
    root.style.setProperty('--primary', `${h} ${s + 20}% 55%`);
    root.style.setProperty('--primary-dark', `${h} ${s + 25}% 40%`);
    root.style.setProperty('--primary-soft', `${h} ${s}% 25%`);
    root.style.setProperty('--accent-soft', `${h} ${s - 10}% 20%`);
    root.style.setProperty('--accent-muted', `${h} ${s - 15}% 30%`);
    root.style.setProperty('--ring', `${h} ${s + 20}% 55%`);
    root.style.setProperty('--accent', `${h} 30% 18%`);
    root.style.setProperty('--accent-foreground', `${h} ${s}% 75%`);
    root.style.setProperty('--sidebar', `${h} 15% 8%`);
    root.style.setProperty('--sidebar-border', `${h} 15% 15%`);
    root.style.setProperty('--sidebar-primary', `${h} ${s + 20}% 55%`);
    root.style.setProperty('--sidebar-accent', `${h} ${s - 10}% 18%`);
    root.style.setProperty('--sidebar-ring', `${h} ${s + 20}% 55%`);
  } else {
    root.style.setProperty('--primary', `${h} ${s + 30}% 32%`);
    root.style.setProperty('--primary-dark', `${h} ${s + 35}% 22%`);
    root.style.setProperty('--primary-soft', `${h} ${s}% 92%`);
    root.style.setProperty('--accent-soft', `${h} ${s - 10}% 88%`);
    root.style.setProperty('--accent-muted', `${h} ${s - 15}% 75%`);
    root.style.setProperty('--ring', `${h} ${s + 30}% 32%`);
    root.style.setProperty('--secondary', `${h} 15% 96%`);
    root.style.setProperty('--secondary-foreground', `${h} ${s + 10}% 25%`);
    root.style.setProperty('--accent', `${h} 20% 95%`);
    root.style.setProperty('--accent-foreground', `${h} ${s + 20}% 28%`);
    root.style.setProperty('--sidebar', `${h} ${s + 25}% 18%`);
    root.style.setProperty('--sidebar-border', `${h} ${s + 20}% 25%`);
    root.style.setProperty('--sidebar-primary', `${h} ${s}% 70%`);
    root.style.setProperty('--sidebar-primary-foreground', `${h} ${s + 25}% 12%`);
    root.style.setProperty('--sidebar-accent', `${h} ${s + 20}% 25%`);
    root.style.setProperty('--sidebar-ring', `${h} ${s}% 70%`);
  }

  root.style.setProperty('--chart-1', `${h} ${s + 30}% 32%`);
  root.style.setProperty('--chart-2', `${h} ${s + 10}% 50%`);
  root.style.setProperty('--success', `145 60% 40%`);
}

export function getThemeColors(theme: DailyTheme) {
  const h = theme.hue;
  const s = theme.saturation;
  return {
    primary: `hsl(${h} ${s + 30}% 32%)`,
    accent: `hsl(${h} ${s + 20}% 50%)`,
    soft: `hsl(${h} ${s}% 90%)`,
  };
}
