import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import styles from './InfoTooltip.module.css';

const TOOLTIP_EVENT = 'info-tooltip-open';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const computePosition = (triggerEl, tooltipEl) => {
  if (typeof window === 'undefined' || !triggerEl || !tooltipEl) {
    return {
      placement: 'bottom',
      style: { top: -9999, left: -9999, '--tooltip-entry-x': '0px', '--tooltip-entry-y': '6px' },
    };
  }

  const triggerRect = triggerEl.getBoundingClientRect();
  const tooltipRect = tooltipEl.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const spacing = 10;
  const margin = 12;

  const fits = {
    top: triggerRect.top - spacing - tooltipRect.height >= margin,
    bottom: triggerRect.bottom + spacing + tooltipRect.height <= viewportHeight - margin,
    left: triggerRect.left - spacing - tooltipRect.width >= margin,
    right: triggerRect.right + spacing + tooltipRect.width <= viewportWidth - margin,
  };

  const preferredOrder = viewportWidth >= 720 ? ['top', 'bottom', 'right', 'left'] : ['bottom', 'top', 'right', 'left'];
  let placement = preferredOrder.find((pos) => fits[pos]) || preferredOrder[0];

  if (!fits[placement]) {
    const space = {
      top: triggerRect.top - spacing - margin,
      bottom: viewportHeight - triggerRect.bottom - spacing - margin,
      left: triggerRect.left - spacing - margin,
      right: viewportWidth - triggerRect.right - spacing - margin,
    };
    placement = Object.entries(space).sort((a, b) => b[1] - a[1])[0][0];
  }

  if ((placement === 'left' || placement === 'right') && viewportWidth < 520) {
    placement = fits.bottom ? 'bottom' : fits.top ? 'top' : placement;
  }

  let top = triggerRect.bottom + spacing;
  let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;

  if (placement === 'top') {
    top = triggerRect.top - tooltipRect.height - spacing;
    left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
  } else if (placement === 'right') {
    top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
    left = triggerRect.right + spacing;
  } else if (placement === 'left') {
    top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
    left = triggerRect.left - tooltipRect.width - spacing;
  }

  const maxTop = viewportHeight - tooltipRect.height - margin;
  const maxLeft = viewportWidth - tooltipRect.width - margin;

  top = clamp(top, margin, maxTop);
  left = clamp(left, margin, maxLeft);

  if (viewportWidth < tooltipRect.width + margin * 2) {
    left = clamp((viewportWidth - tooltipRect.width) / 2, margin, maxLeft);
  }

  const entryOffsets = {
    top: { x: 0, y: -4 },
    bottom: { x: 0, y: 4 },
    left: { x: -4, y: 0 },
    right: { x: 4, y: 0 },
  };

  return {
    placement,
    style: {
      top,
      left,
      '--tooltip-entry-x': `${entryOffsets[placement]?.x || 0}px`,
      '--tooltip-entry-y': `${entryOffsets[placement]?.y || 6}px`,
    },
  };
};

const InfoIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 10.5v6" />
    <circle cx="12" cy="7.25" r="0.85" fill="currentColor" />
  </svg>
);

const InfoTooltip = ({ label = 'More info', title, children, variant = 'default', className = '' }) => {
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState('bottom');
  const [tooltipStyle, setTooltipStyle] = useState({
    top: -9999,
    left: -9999,
    '--tooltip-entry-x': '0px',
    '--tooltip-entry-y': '6px',
  });
  const tooltipId = useMemo(() => `info-tip-${Math.random().toString(36).slice(2, 8)}`, []);

  const updatePosition = useCallback(() => {
    const result = computePosition(triggerRef.current, tooltipRef.current);
    setPlacement(result.placement);
    setTooltipStyle(result.style);
  }, []);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;
    const handleReflow = () => updatePosition();
    window.addEventListener('resize', handleReflow);
    window.addEventListener('scroll', handleReflow, true);
    const closeOnScroll = () => setOpen(false);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      window.removeEventListener('resize', handleReflow);
      window.removeEventListener('scroll', handleReflow, true);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const handleOtherOpen = (event) => {
      if (event.detail !== tooltipId) setOpen(false);
    };
    document.addEventListener(TOOLTIP_EVENT, handleOtherOpen);
    return () => document.removeEventListener(TOOLTIP_EVENT, handleOtherOpen);
  }, [tooltipId]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      const triggerEl = triggerRef.current;
      const tooltipEl = tooltipRef.current;
      if (!triggerEl || !tooltipEl) return;
      if (triggerEl.contains(event.target) || tooltipEl.contains(event.target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) document.dispatchEvent(new CustomEvent(TOOLTIP_EVENT, { detail: tooltipId }));
      return next;
    });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const triggerClasses = `${styles.trigger} ${variant === 'inline' ? styles.triggerInline : ''}`;
  const iconClasses = `${styles.icon} ${variant === 'inline' ? styles.iconInline : ''}`;

  const tooltipContent = (
    <div
      ref={tooltipRef}
      className={styles.tooltip}
      role="tooltip"
      id={tooltipId}
      data-placement={placement}
      style={tooltipStyle}
    >
      {title ? <p className={styles.title}>{title}</p> : null}
      <p className={styles.body}>{children}</p>
    </div>
  );

  return (
    <span className={`${styles.wrapper} ${className}`}>
      <button
        type="button"
        ref={triggerRef}
        className={triggerClasses}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        aria-haspopup="true"
        onClick={toggle}
        onKeyDown={handleKeyDown}
      >
        <InfoIcon className={iconClasses} />
      </button>
      {open ? ReactDOM.createPortal(tooltipContent, document.body) : null}
    </span>
  );
};

export default InfoTooltip;
