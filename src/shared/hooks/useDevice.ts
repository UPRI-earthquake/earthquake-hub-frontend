import { useMediaQuery } from "./useMediaQuery";

export default function useDevice() {
  const isMobileLandscape = useMediaQuery(
    '(max-width: 960px) and (orientation: landscape), (max-width: 1100px) and (max-height: 600px) and (orientation: landscape)'
  );
  const isCompactPanels = useMediaQuery('(max-width: 1100px)');
  return {
    isMobileLandscape, isCompactPanels
  };
}