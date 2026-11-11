import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';
import sanitizeHtml from '@/shared/utils/sanitizeHtml';
import styles from '../../styles/sections/EventSummarySection.module.css';
import { EarthquakeInfo } from '../../../types/earthquake';
import { generateEventSummary } from '../../../services/generateEventSummary';

/**
 * EventSummarySection - Provides editable event summary with modal dialog and confirmation
 */

interface EventSummarySectionProps {
  initialSummary: string;
  earthquakeInfo: EarthquakeInfo;
  className?: string;
}

export default function EventSummarySection({
  initialSummary,
  earthquakeInfo,
  className = '',
}: EventSummarySectionProps) {
  const defaultSummary = useMemo(() => {
    return initialSummary.trim() || generateEventSummary(earthquakeInfo) || '';
  }, [initialSummary, earthquakeInfo]);

  const [copyState, setCopyState] = useState('idle');

  const sanitizedMarkup = sanitizeHtml(defaultSummary || '');


  const handleCopySummary = useCallback(async () => {
    const summaryText = defaultSummary?.trim();
    if (!summaryText) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(summaryText);
      } else {
        const fallbackInput = document.createElement('textarea');
        fallbackInput.value = summaryText;
        fallbackInput.setAttribute('readonly', '');
        fallbackInput.style.position = 'absolute';
        fallbackInput.style.left = '-9999px';
        document.body.appendChild(fallbackInput);
        fallbackInput.select();
        document.execCommand('copy');
        document.body.removeChild(fallbackInput);
      }

      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch (_) {
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 2200);
    }
  }, [defaultSummary]);

  return (
    <section className={`${styles.summaryContainer} eqinfo-panel ${className}`.trim()}>
      <div className="panel-header">
        <div className="panel-title">
          <h3>Event summary</h3>
        </div>
        <div className={styles.headerActions}>
          {defaultSummary.trim() && (
            <button
              className={styles.iconButton}
              onClick={handleCopySummary}
              title={copyState === 'copied' ? 'Summary copied' : 'Copy event summary'}
              aria-label={copyState === 'copied' ? 'Event summary copied' : 'Copy event summary'}
              type="button"
            >
              {copyState === 'copied' ? <FiCheck size={16} /> : <FiCopy size={16} />}
            </button>
          )}
        </div>
      </div>

      <div className="panel-body">
          {defaultSummary.trim() ? (
            <div
              className="eqinfo-copy"
              dangerouslySetInnerHTML={{ __html: sanitizedMarkup }}
            />
          ) : (
            <div className={styles.placeholderText}>
              No event summary available.
            </div>
          )}
      </div>
    </section>
  );
}

