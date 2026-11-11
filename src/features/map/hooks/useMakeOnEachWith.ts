import { useMap } from 'react-leaflet';
import { useCallback } from "react";

export default function useMakeOnEachWith({ nativeTitleFn, overlayTooltipBuilder, baseStyle }) {
  const map = useMap();

  const disableHoverStyling = true;
  const hoverClassName = null;

  const getBase = () => {
    const s = typeof baseStyle === 'function' ? baseStyle() : baseStyle;
    return { ...(s || {}), interactive: true };
  };

  return useCallback((feature, layer) => {
      try {
        const props = feature && feature.properties;
        const html = overlayTooltipBuilder ? overlayTooltipBuilder(props) : '';
        const usePopup = true;
        const nativeTitle = nativeTitleFn ? String(nativeTitleFn(props) || '') : '';
        const disableHover = false;
        const applyDomTitle = () => {
          if (!nativeTitle) return false;
          const pathEl = layer.getElement ? layer.getElement() : layer._path || null;
          if (!pathEl) return false;
          try {
            pathEl.setAttribute('title', nativeTitle);
            pathEl.setAttribute('aria-label', nativeTitle);
            return true;
          } catch (_) {
            return false;
          }
        };
        const setContainerTitle = (value) => {
          const container: HTMLElement | null = map?.getContainer?.();
          if (!container) return;
          if (value) {
            if (!Object.prototype.hasOwnProperty.call(container, '__prevTitle')) {
              container["__prevTitle"] = container.getAttribute('title');
            }
            container.setAttribute('title', value);
            container["__nativeTitleOwner"] = layer;
          } else if (container["__nativeTitleOwner"] === layer) {
            const prev = container["__prevTitle"];
            if (prev) container.setAttribute('title', prev);
            else container.removeAttribute('title');
            delete container["__prevTitle"];
            delete container["__nativeTitleOwner"];
          }
        };
        if (html) {
          if (usePopup) {
            layer.bindPopup(html, {
              className: 'feature-popup',
              autoPan: true,
              closeButton: true,
              maxWidth: 280,
            });
            try {
              if (layer._openPopup) {
                layer.off('click', layer._openPopup, layer);
                layer.off('keypress', layer._openPopup, layer);
              }
            } catch (_) {}
          } else {
            layer.bindTooltip(html, {
              sticky: true,
              direction: 'top',
              className: 'feature-tooltip',
            });
          }
        }
        applyDomTitle();
        layer.on('add', applyDomTitle);
        const hoverWeightFor = (baseW) =>
          usePopup ? Math.max(baseW + 1.25, baseW * 1.75) : Math.max(baseW + 2.5, baseW * 2.5);

        if (!disableHover) {
          layer.on('mouseover', () => {
            try {
              const el = map?.getContainer?.();
              if (el && hoverClassName) el.classList.add(hoverClassName);
              if (nativeTitle) {
                applyDomTitle();
                setContainerTitle(nativeTitle);
              }
              if (!disableHoverStyling) {
                const baseNow = getBase();
                const baseW = baseNow.weight || 2;
                // Slight bump on hover for readability; keep same scale for selected
                const hoverW = hoverWeightFor(baseW);
                layer.setStyle({ ...baseNow, weight: hoverW, opacity: 1 });
                if (layer.bringToFront) layer.bringToFront();
                const pathEl = layer.getElement ? layer.getElement() : layer._path || null;
                if (pathEl) {
                  try {
                    pathEl.classList.add('hover-glow');
                  } catch (_) {}
                }
                // keep the pane just below tooltip pane (650)
                const paneName = layer?.options?.pane;
                const paneEl = paneName && map?.getPane?.(paneName);
                if (paneEl) {
                  if (paneEl["_prevZ"] == null) paneEl["_prevZ"] = paneEl.style.zIndex;
                  paneEl.style.zIndex = '645';
                }
              }
            } catch (_) {}
          });
        }
        const reset = () => {
          // If tooltip is open (selected), keep selected styling
          const tip = !usePopup && typeof layer.getTooltip === 'function' ? layer.getTooltip() : null;
          const pop = usePopup && typeof layer.getPopup === 'function' ? layer.getPopup() : null;
          const isTipOpen = !!(tip && typeof tip.isOpen === 'function' && tip.isOpen());
          const isPopOpen = !!(pop && typeof pop.isOpen === 'function' && pop.isOpen());
          const open = usePopup ? isPopOpen : isTipOpen;
          if (!disableHoverStyling) {
            if (!open) {
              try {
                layer.setStyle(getBase());
              } catch (_) {}
            } else {
              const baseNow = getBase();
              const baseW = baseNow.weight || 2;
              // Keep a highlight when info is pinned open, same scale as hover
              const selectedW = hoverWeightFor(baseW);
              try {
                layer.setStyle({ ...baseNow, weight: selectedW, opacity: 1 });
              } catch (_) {}
            }
          }
          const el = map?.getContainer?.();
          if (el && hoverClassName) el.classList.remove(hoverClassName);
          if (nativeTitle) setContainerTitle('');
          const pathEl = layer.getElement ? layer.getElement() : layer._path || null;
          if (!disableHoverStyling) {
            if (pathEl) {
              try {
                if (!open) pathEl.classList.remove('hover-glow');
              } catch (_) {}
            }
            const paneName = layer?.options?.pane;
            const paneEl = paneName && map?.getPane?.(paneName);
            if (paneEl && paneEl["_prevZ"] != null) {
              paneEl.style.zIndex = paneEl["_prevZ"];
              paneEl["_prevZ"] = null;
            }
          }
        };
        if (!disableHover) {
          layer.on('mouseout', reset);
        }
        if (usePopup) {
          layer.on('popupclose', reset);
        } else if (!disableHover) {
          layer.on('tooltipclose', reset);
        }
        layer.on('remove', reset);
        // Click/tap toggling only for popups. Tooltips should be hover-only.
        if (usePopup) {
          const clickToggle = (e) => {
            try {
              const isOpen = typeof layer.isPopupOpen === 'function' && layer.isPopupOpen();
              if (isOpen) {
                layer.closePopup();
              } else {
                if (!disableHoverStyling) {
                  const baseNow = getBase();
                  const baseW = baseNow.weight || 2;
                  const selectedW = hoverWeightFor(baseW);
                  layer.setStyle({ ...baseNow, weight: selectedW, opacity: 1 });
                }
                if (layer.bringToFront) layer.bringToFront();
                const pathEl = layer.getElement ? layer.getElement() : layer._path || null;
                if (pathEl && !disableHoverStyling) {
                  try { pathEl.classList.add('selected-glow'); } catch (_) {}
                }
                if (e && e.latlng && typeof layer.openPopup === 'function') layer.openPopup(e.latlng);
                else if (typeof layer.openPopup === 'function') layer.openPopup();
              }
            } catch (_) {}
          };
          let __lastTapTs = 0;
          layer.on('tap', (ev) => {
            __lastTapTs = Date.now();
            clickToggle(ev);
          });
          layer.on('click', (ev) => {
            if (__lastTapTs && Date.now() - __lastTapTs < 350) return;
            clickToggle(ev);
          });
        }
        if (!usePopup) {
          layer.on('tooltipclose', () => {
            if (!disableHoverStyling) {
              const pathEl = layer.getElement ? layer.getElement() : layer._path || null;
              if (pathEl) {
                try {
                  pathEl.classList.remove('selected-glow');
                } catch (_) {}
              }
              try {
                layer.setStyle(getBase());
              } catch (_) {}
            }
          });
        } else {
          layer.on('popupclose', () => {
            if (!disableHoverStyling) {
              const pathEl = layer.getElement ? layer.getElement() : layer._path || null;
              if (pathEl) {
                try { pathEl.classList.remove('selected-glow'); } catch (_) {}
              }
              try { layer.setStyle(getBase()); } catch (_) {}
            }
          });
        }
      } catch (_) {}
    },[map]);
}