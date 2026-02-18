import { useUpdate } from 'ahooks';
import { useEffect, useState } from 'react';

export const useIsElementVisible = (
  target: Element | null,
  options = undefined
) => {
  const [isVisible, setIsVisible] = useState(false);
  const update = useUpdate();

  useEffect(() => {
    update();
  }, []);

  useEffect(() => {
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => setIsVisible(entries[0].isIntersecting),
      options
    );
    observer.observe(target);

    return () => observer.unobserve(target);
  }, [target, options]);

  return isVisible;
};
