import { useCallback, useEffect, useRef, useState } from "react";
import { REPORT_IMAGE_VIEWER_MAX_SCALE, REPORT_IMAGE_VIEWER_MIN_SCALE, REPORT_IMAGE_VIEWER_SCALE_STEP } from "../../../../constants/reports";
import { FiChevronLeft, FiChevronRight, FiRotateCcw, FiX, FiZoomIn, FiZoomOut } from "react-icons/fi";
import ReportAuthorAvatar from "./ReportAuthorAvatar";
import { clampNumber } from "@/shared/utils/number";

interface ReportImageViewerProps {
  image: {
    source: string;
    src: string;
    alt?: string;
    overlay?: {
      author: string;
      text: string;
    };
    gallery: { 
      src: string 
    }[];
    galleryIndex: number;
  };
  onClose: () => void;
}

export default function ReportImageViewer({ image, onClose }: ReportImageViewerProps) {
  const [scale, setScale] = useState(REPORT_IMAGE_VIEWER_MIN_SCALE);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [activeImage, setActiveImage] = useState(image || null);
  const dragStartRef = useRef(null);
  const imageSrc = activeImage?.src || '';
  const overlayAuthor = activeImage?.overlay?.author || '';
  const overlayText = typeof activeImage?.overlay?.text === 'string' ? activeImage.overlay.text.trim() : '';
  const hasOverlay = Boolean(overlayAuthor || overlayText);
  const imageGallery = Array.isArray(activeImage?.gallery) ? activeImage.gallery : [];
  const rawGalleryIndex = Number(activeImage?.galleryIndex);
  const resolvedGalleryIndex = Number.isFinite(rawGalleryIndex)
    ? rawGalleryIndex
    : imageGallery.findIndex((item) => item?.src === imageSrc);
  const canNavigateGallery = imageGallery.length > 1 && resolvedGalleryIndex >= 0;
  const galleryPositionLabel = canNavigateGallery ? `${resolvedGalleryIndex + 1} of ${imageGallery.length}` : '';

  useEffect(() => {
    setActiveImage(image || null);
  }, [image]);

  const updateScale = useCallback((nextScale) => {
    setScale((previousScale) => {
      const rawScale = typeof nextScale === 'function' ? nextScale(previousScale) : nextScale;
      const clampedScale = clampNumber(
        rawScale,
        REPORT_IMAGE_VIEWER_MIN_SCALE,
        REPORT_IMAGE_VIEWER_MAX_SCALE,
      );
      if (clampedScale === REPORT_IMAGE_VIEWER_MIN_SCALE) {
        setOffset({ x: 0, y: 0 });
      }
      return clampedScale;
    });
  }, []);

  const resetView = useCallback(() => {
    setScale(REPORT_IMAGE_VIEWER_MIN_SCALE);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const navigateGallery = useCallback((direction) => {
    setActiveImage((currentImage) => {
      const gallery = Array.isArray(currentImage?.gallery) ? currentImage.gallery : [];
      if (gallery.length <= 1) return currentImage;

      const currentIndex = Number.isFinite(Number(currentImage?.galleryIndex))
        ? Number(currentImage.galleryIndex)
        : gallery.findIndex((item) => item?.src === currentImage?.src);
      if (currentIndex < 0) return currentImage;

      const nextIndex = (currentIndex + direction + gallery.length) % gallery.length;
      return {
        ...gallery[nextIndex],
        source: currentImage?.source,
        gallery,
        galleryIndex: nextIndex,
      };
    });
  }, []);

  useEffect(() => {
    resetView();
  }, [imageSrc, resetView]);

  useEffect(() => {
    if (!imageSrc || typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [imageSrc]);

  useEffect(() => {
    if (!imageSrc) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        updateScale((currentScale) => currentScale + REPORT_IMAGE_VIEWER_SCALE_STEP);
      } else if (event.key === '-') {
        event.preventDefault();
        updateScale((currentScale) => currentScale - REPORT_IMAGE_VIEWER_SCALE_STEP);
      } else if (event.key === '0') {
        event.preventDefault();
        resetView();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateGallery(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateGallery(1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [imageSrc, navigateGallery, onClose, resetView, updateScale]);

  const handlePointerDown = useCallback((event) => {
    if (scale <= REPORT_IMAGE_VIEWER_MIN_SCALE) return;
    event.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offset,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [offset, scale]);

  const handlePointerMove = useCallback((event) => {
    if (!isDragging || !dragStartRef.current) return;
    event.preventDefault();
    setOffset({
      x: dragStartRef.current.offset.x + event.clientX - dragStartRef.current.x,
      y: dragStartRef.current.offset.y + event.clientY - dragStartRef.current.y,
    });
  }, [isDragging]);

  const stopDragging = useCallback((event) => {
    setIsDragging(false);
    if (dragStartRef.current?.pointerId != null) {
      event.currentTarget.releasePointerCapture?.(dragStartRef.current.pointerId);
    }
    dragStartRef.current = null;
  }, []);

  const handleWheel = useCallback((event) => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    updateScale((currentScale) => currentScale + direction * REPORT_IMAGE_VIEWER_SCALE_STEP);
  }, [updateScale]);

  const handleDoubleClick = useCallback(() => {
    updateScale((currentScale) => (
      currentScale > REPORT_IMAGE_VIEWER_MIN_SCALE
        ? REPORT_IMAGE_VIEWER_MIN_SCALE
        : REPORT_IMAGE_VIEWER_MIN_SCALE + REPORT_IMAGE_VIEWER_SCALE_STEP * 4
    ));
  }, [updateScale]);

  if (!imageSrc) return null;

  const zoomPercent = Math.round(scale * 100);

  return (
    <div
      className="report-image-viewer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="report-image-viewer"
        role="dialog"
        aria-modal="true"
        aria-label="Report image viewer"
      >
        <div className="report-image-viewer-toolbar" role="group" aria-label="Image viewer controls">
          <button
            type="button"
            className="report-image-viewer-control"
            onClick={() => updateScale((currentScale) => currentScale - REPORT_IMAGE_VIEWER_SCALE_STEP)}
            disabled={scale <= REPORT_IMAGE_VIEWER_MIN_SCALE}
            aria-label="Zoom out"
          >
            <FiZoomOut aria-hidden="true" />
          </button>
          <output className="report-image-viewer-zoom" aria-live="polite">
            {zoomPercent}%
          </output>
          <button
            type="button"
            className="report-image-viewer-control"
            onClick={() => updateScale((currentScale) => currentScale + REPORT_IMAGE_VIEWER_SCALE_STEP)}
            disabled={scale >= REPORT_IMAGE_VIEWER_MAX_SCALE}
            aria-label="Zoom in"
          >
            <FiZoomIn aria-hidden="true" />
          </button>
          <button
            type="button"
            className="report-image-viewer-control"
            onClick={resetView}
            disabled={scale === REPORT_IMAGE_VIEWER_MIN_SCALE && offset.x === 0 && offset.y === 0}
            aria-label="Reset image view"
          >
            <FiRotateCcw aria-hidden="true" />
          </button>
          <button
            type="button"
            className="report-image-viewer-control report-image-viewer-close"
            onClick={onClose}
            aria-label="Close image viewer"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
        {canNavigateGallery && (
          <>
            <button
              type="button"
              className="report-image-viewer-nav report-image-viewer-nav-previous"
              onClick={() => navigateGallery(-1)}
              aria-label="View previous community report image"
            >
              <FiChevronLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              className="report-image-viewer-nav report-image-viewer-nav-next"
              onClick={() => navigateGallery(1)}
              aria-label="View next community report image"
            >
              <FiChevronRight aria-hidden="true" />
            </button>
            <div className="report-image-viewer-count" aria-live="polite">
              {galleryPositionLabel}
            </div>
          </>
        )}
        <div
          className={`report-image-viewer-stage ${scale > REPORT_IMAGE_VIEWER_MIN_SCALE ? 'report-image-viewer-stage-zoomed' : ''}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onDoubleClick={handleDoubleClick}
        >
          <img
            src={imageSrc}
            alt={activeImage?.alt || 'Submitted report attachment'}
            draggable="false"
            style={{
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
            }}
          />
          {hasOverlay && (
            <div className={`report-image-viewer-overlay ${!overlayText ? 'report-image-viewer-overlay-compact' : ''}`}>
              <ReportAuthorAvatar author={overlayAuthor || 'Anonymous'} />
              <div className="report-image-viewer-overlay-body">
                <p className="report-image-viewer-overlay-author">
                  <span>Reported by</span>
                  <strong>{overlayAuthor || 'Anonymous'}</strong>
                </p>
                {overlayText && (
                  <p className="report-image-viewer-overlay-comment">{overlayText}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
