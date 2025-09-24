import { useEffect, useState } from 'react';

export const useTheme = (global: Window) => {
  const THEME_API = ((global || window) as any).THEME_API;
  const [theme, setTheme] = useState(THEME_API.theme);

  const _setTheme = async (theme: string) => {
    let newTheme = theme;
    if (theme === 'system') {
      newTheme = await THEME_API.getNativeSystemTheme();
    }
    setTheme(newTheme);
  };

  useEffect(() => {
    THEME_API.changeTheme(_setTheme);

    // initialize theme
    const { theme, systemTheme } = THEME_API;
    _setTheme(theme === 'system' ? systemTheme : theme);
  }, []);

  useEffect(() => {
    if (theme) {
      if (theme === 'dark') {
        document.body.classList.add('dark-theme');
      } else {
        document.body.classList.remove('dark-theme');
      }
    }
  }, [theme]);
};
