import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    if (media.addEventListener) media.addEventListener('change', update);
    else if (media.addListener) media.addListener(update);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', update);
      else if (media.removeListener) media.removeListener(update);
    };
  }, [query]);

  return matches;
}
