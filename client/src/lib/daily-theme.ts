export interface DailyTheme {
  name: string;
  primaryHue: number;
  primarySat: number;
  accentHue: number;
  accentSat: number;
  description: string;
}

export const aquaTheme: DailyTheme = {
  name: "Aqua Breeze",
  primaryHue: 188,
  primarySat: 65,
  accentHue: 168,
  accentSat: 55,
  description: "Fresh & Modern",
};

export function getDailyTheme(): DailyTheme {
  return aquaTheme;
}

export function applyDailyTheme(): void {
  const theme = getDailyTheme();
  const root = document.documentElement;
  const ph = theme.primaryHue;
  const ps = theme.primarySat;
  const ah = theme.accentHue;
  const as = theme.accentSat;
  const isDark = root.classList.contains('dark');

  if (isDark) {
    root.style.setProperty('--primary', `${ph} ${ps + 5}% 55%`);
    root.style.setProperty('--primary-dark', `${ph} ${ps}% 45%`);
    root.style.setProperty('--primary-soft', `${ph} ${ps - 25}% 20%`);
    root.style.setProperty('--accent-soft', `${ah} ${as - 25}% 15%`);
    root.style.setProperty('--accent-muted', `${ah} ${as - 30}% 30%`);
    root.style.setProperty('--ring', `${ph} ${ps + 5}% 55%`);
    root.style.setProperty('--accent', `${ah} 35% 18%`);
    root.style.setProperty('--accent-foreground', `${ah} ${as - 5}% 75%`);
    root.style.setProperty('--sidebar', `${ph} 30% 8%`);
    root.style.setProperty('--sidebar-border', `${ph} 25% 18%`);
    root.style.setProperty('--sidebar-primary', `${ph} ${ps + 5}% 55%`);
    root.style.setProperty('--sidebar-accent', `${ph} ${ps - 20}% 20%`);
    root.style.setProperty('--sidebar-ring', `${ph} ${ps + 5}% 55%`);
    root.style.setProperty('--gradient-start', `${ph} ${ps + 5}% 55%`);
    root.style.setProperty('--gradient-end', `${ah} ${as + 5}% 50%`);
    root.style.setProperty('--gradient-soft-start', `${ph} ${ps - 25}% 20%`);
    root.style.setProperty('--gradient-soft-end', `${ah} ${as - 20}% 18%`);
  } else {
    root.style.setProperty('--primary', `${ph} ${ps}% 45%`);
    root.style.setProperty('--primary-dark', `${ph} ${ps + 5}% 35%`);
    root.style.setProperty('--primary-soft', `${ph} ${ps - 15}% 92%`);
    root.style.setProperty('--accent-soft', `${ah} ${as - 15}% 90%`);
    root.style.setProperty('--accent-muted', `${ah} ${as - 20}% 75%`);
    root.style.setProperty('--ring', `${ph} ${ps}% 45%`);
    root.style.setProperty('--secondary', `${ah} 25% 95%`);
    root.style.setProperty('--secondary-foreground', `${ah} ${ps - 15}% 30%`);
    root.style.setProperty('--accent', `${ah} 45% 93%`);
    root.style.setProperty('--accent-foreground', `${ah} ${as + 5}% 30%`);
    root.style.setProperty('--sidebar', `${ph} ${ps - 10}% 25%`);
    root.style.setProperty('--sidebar-border', `${ph} ${ps - 5}% 35%`);
    root.style.setProperty('--sidebar-primary', `${ah} ${as}% 70%`);
    root.style.setProperty('--sidebar-primary-foreground', `${ph} ${ps}% 15%`);
    root.style.setProperty('--sidebar-accent', `${ph} ${ps - 5}% 32%`);
    root.style.setProperty('--sidebar-ring', `${ah} ${as}% 70%`);
    root.style.setProperty('--gradient-start', `${ph} ${ps}% 45%`);
    root.style.setProperty('--gradient-end', `${ah} ${as}% 50%`);
    root.style.setProperty('--gradient-soft-start', `${ph} ${ps - 15}% 92%`);
    root.style.setProperty('--gradient-soft-end', `${ah} ${as - 10}% 90%`);
  }

  root.style.setProperty('--chart-1', `${ph} ${ps}% 45%`);
  root.style.setProperty('--chart-2', `${ah} ${as}% 50%`);
  root.style.setProperty('--chart-3', `200 60% 55%`);
  root.style.setProperty('--chart-4', `155 50% 45%`);
  root.style.setProperty('--success', `155 60% 45%`);
}

export function getThemeColors(theme: DailyTheme) {
  const ph = theme.primaryHue;
  const ps = theme.primarySat;
  const ah = theme.accentHue;
  const as = theme.accentSat;
  return {
    primary: `hsl(${ph} ${ps}% 45%)`,
    accent: `hsl(${ah} ${as}% 50%)`,
    soft: `hsl(${ph} ${ps - 15}% 92%)`,
    gradientStart: `hsl(${ph} ${ps}% 45%)`,
    gradientEnd: `hsl(${ah} ${as}% 50%)`,
  };
}
