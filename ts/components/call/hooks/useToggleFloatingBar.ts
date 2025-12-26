import { debounce } from 'lodash';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { difference, union } from 'polygon-clipping';
import { Window } from '@cc-kit/node-screenshots';
import { currentCall } from '../initCall';
import { useMemoizedFn } from 'ahooks';
import { floatingbarVisibleAtom } from '../atoms/floatingbarVisibleAtom';
import { useSetAtom } from 'jotai';

type Point = [number, number];
type Poly = Point[];

const useLock = (unlockTimeout: number) => {
  const _lock = useRef(false);
  const lock = () => {
    _lock.current = true;
  };
  const unlock = useCallback(
    debounce(() => {
      _lock.current = false;
    }, unlockTimeout),
    [unlockTimeout]
  );

  const getLock = () => _lock.current;

  return { lock, unlock, getLock };
};

const useWindowFocus = (
  options: {
    onFocus?: () => void;
    onBlur?: () => void;
  } = {}
) => {
  const windowFocus = useRef(true);
  useEffect(() => {
    window.onfocus = () => {
      windowFocus.current = true;
      options.onFocus?.();
    };
    window.onblur = () => {
      windowFocus.current = false;
      options.onBlur?.();
    };

    return () => {
      window.onfocus = null;
      window.onblur = null;
    };
  }, []);

  return {
    isWindowFocus: () => windowFocus.current,
  };
};

const useToggleWithLock = (debounceTime: number) => {
  const { lock, unlock, getLock } = useLock(100);
  const setFloatingbarVisible = useSetAtom(floatingbarVisibleAtom);

  const toggleFloatingBar = useCallback(
    debounce((show: boolean) => {
      (window as any).toggleFloatingBar(show);
      setFloatingbarVisible(show);
      unlock();
    }, debounceTime),
    []
  );

  return {
    showFloatingBar() {
      lock();
      toggleFloatingBar(true);
    },
    hideFloatingBar() {
      lock();
      toggleFloatingBar(false);
    },
    getLock,
  };
};

const usePageVisibility = () => {
  const [pageVisibility, setPageVisibility] = useState(
    () => document.visibilityState
  );
  const setHiddenTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    document.onvisibilitychange = () => {
      if (document.visibilityState === 'hidden') {
        setHiddenTimeout.current = setTimeout(() => {
          setPageVisibility('hidden');
          setHiddenTimeout.current = null;
        }, 300);
      } else {
        // ignore middle hidden state caused by fullscreen transition
        if (setHiddenTimeout.current) {
          clearTimeout(setHiddenTimeout.current);
          setHiddenTimeout.current = null;
        }
        setPageVisibility(document.visibilityState);
      }
    };

    return () => {
      document.onvisibilitychange = null;
    };
  }, []);

  return {
    pageVisibility,
  };
};

const getTopWindow = () => {
  let currentWindow = null;
  const allWins = (window as any).listOnScreenWindows();
  const wins = [];
  // keep minimize loop
  for (const w of allWins) {
    try {
      // can not find other method to get current window
      if (w.id() === currentCall.callWindowId) {
        currentWindow = w;
        break;
      }

      // minimized window & dock & notification center will be ignore
      if (
        w.isMinimized() ||
        (w.title() === 'Dock' && w.isMaximized()) ||
        w.y() - w.currentMonitor().y() === 0
      ) {
        continue;
      }

      wins.push(w);
    } catch (e) {
      continue;
    }
  }

  return { topWins: wins, currentWindow };
};

const windowAxisToPolygon = (w: Window): Poly[] => {
  const poly = [
    [w.x(), w.y()],
    [w.x() + w.width(), w.y()],
    [w.x() + w.width(), w.y() + w.height()],
    [w.x(), w.y() + w.height()],
    [w.x(), w.y()],
  ] as Poly;

  return [poly];
};

const isWindowOccluded = (targetWindow: Window | null, wins: Window[]) => {
  if (!targetWindow) {
    return false;
  }
  const winsInSameScreen = wins.filter(w => {
    try {
      return w.currentMonitor().id() === targetWindow.currentMonitor().id();
    } catch (e) {
      return false;
    }
  });
  if (!winsInSameScreen.length) {
    return false;
  }

  const targetPoly = windowAxisToPolygon(targetWindow);
  const topPolys = union(winsInSameScreen.map(windowAxisToPolygon) as Poly[][]);

  const result = difference(targetPoly, topPolys);

  return result.length === 0;
};

export const useToggleFloatingBar = () => {
  const checkToggleTimer = useRef<NodeJS.Timeout | null>(null);
  const { pageVisibility } = usePageVisibility();
  const { showFloatingBar, hideFloatingBar, getLock } = useToggleWithLock(100);
  const { isWindowFocus } = useWindowFocus({ onFocus: hideFloatingBar });

  const needFallbackVisibilityCheck = useMemoizedFn(() => {
    if (document.visibilityState === 'hidden' || getLock() || isWindowFocus()) {
      return false;
    } else {
      return true;
    }
  });

  const fallbackVisibilityCheck = useMemoizedFn(() => {
    const { currentWindow, topWins } = getTopWindow();
    const isOccluded = isWindowOccluded(currentWindow, topWins);
    if (!getLock()) {
      if (isOccluded) {
        showFloatingBar();
      } else {
        hideFloatingBar();
      }
    }
  });

  // normal toggle, based on document.visibilityState
  useLayoutEffect(() => {
    if (document.visibilityState === 'visible') {
      hideFloatingBar();
    } else {
      showFloatingBar();
    }
  }, [pageVisibility]);

  // fallback toggle, based on window occluded
  useEffect(() => {
    checkToggleTimer.current = setInterval(() => {
      if (needFallbackVisibilityCheck()) {
        fallbackVisibilityCheck();
      }
    }, 1000);

    return () => {
      if (checkToggleTimer.current) {
        clearInterval(checkToggleTimer.current);
        checkToggleTimer.current = null;
      }
    };
  }, []);
};
