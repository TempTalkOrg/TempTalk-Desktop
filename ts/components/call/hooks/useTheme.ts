import { useMemoizedFn } from 'ahooks';
import { useEffect } from 'react';

const mainWindow: any = window;

export const useTheme = () => {
  const setTheme = useMemoizedFn(async theme => {
    if (theme === 'system') {
      const temp = await mainWindow.getNativeSystemTheme();
      document.body.classList.remove('dark-theme');
      document.body.classList.remove('light-theme');
      document.body.classList.add(`${temp}-theme`);
      return;
    }

    document.body.classList.remove('dark-theme');
    document.body.classList.remove('light-theme');
    document.body.classList.add(`${theme}-theme`);
  });

  useEffect(() => {
    mainWindow.changeTheme(setTheme);
    if (mainWindow.getTheme() === 'dark') {
      setTheme('dark');
    }

    if (mainWindow.getTheme() === 'system') {
      setTheme(mainWindow.systemTheme);
    }
  }, []);
};
