import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import { computeHeaderAwarePopupAutoPanPadding } from "@/config/popupAutoPan";

export default function usePopupAutoPanPadding() {
  const map = useMap();
  const [padding, setPadding] = useState(() => computeHeaderAwarePopupAutoPanPadding(map));

  useEffect(() => {
    if (!map) return undefined;

    const update = () => {
      try {
        setPadding(computeHeaderAwarePopupAutoPanPadding(map));
      } catch (_) {}
    };

    update();

    const container = map.getContainer && map.getContainer();
    let mo = null;

    try { map.on('resize', update); } catch (_) {}
    try {
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
      }
    } catch (_) {}
    try {
      if (container && typeof MutationObserver !== 'undefined') {
        mo = new MutationObserver(update);
        mo.observe(container, {
          attributes: true,
          attributeFilter: ['class', 'style', 'data-basemap-theme'],
        });
      }
    } catch (_) {}

    return () => {
      try { map.off('resize', update); } catch (_) {}
      try {
        if (typeof window !== 'undefined') {
          window.removeEventListener('resize', update);
          window.removeEventListener('orientationchange', update);
        }
      } catch (_) {}
      try { if (mo) mo.disconnect(); } catch (_) {}
    };
  }, [map]);

  return padding;
}