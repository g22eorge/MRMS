"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "system" | "light" | "blackgold" | "navy";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const THEME_CLASSES = ["theme-blackgold", "theme-navy", "light"];

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES);
  if (theme === "light") {
    root.classList.add("light");
  } else if (theme === "blackgold") {
    root.classList.add("theme-blackgold");
  } else if (theme === "navy") {
    // Navy composes with the black+gold dark component styling.
    root.classList.add("theme-blackgold", "theme-navy");
  }
  // "system" → no class; the prefers-color-scheme media query decides.
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    applyTheme(theme);
    // Cookie is the canonical persistence layer (read on SSR).
    document.cookie = `theme=${theme};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
  }, [theme]);

  function setTheme(next: Theme) {
    setThemeState(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
