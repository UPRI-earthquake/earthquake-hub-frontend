import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { FiEdit2, FiX, FiCheck, FiCopy } from 'react-icons/fi';
import { getBackendHost } from '../utils/backendHost';
import sanitizeHtml from '../utils/sanitizeHtml';
import { generateEventSummary } from '../utils/generateEventSummary';
import styles from './EditableEventSummary.module.css';

/**
 * EditableEventSummary - Provides editable event summary with modal dialog and confirmation
 * @param {string} eventId - The event ID to update
 * @param {string} initialSummary - The initial summary content (custom or empty)
 * @param {Object} earthquakeInfo - Earthquake data for generating default summary
 * @param {function} onSummaryUpdated - Callback when summary is successfully updated
 * @param {string} endpointType - Type of endpoint: 'significant-eqs' or 'eq-events' (default: 'significant-eqs')
 * @returns {JSX.Element}
 */
function EditableEventSummary({
  eventId,
  initialSummary,
  earthquakeInfo,
  onSummaryUpdated,
  endpointType = 'eq-events',
  canEdit = false,
  className = '',
}) {
  const defaultSummary = useMemo(() => {
    return initialSummary?.trim() || generateEventSummary(earthquakeInfo) || '';
  }, [initialSummary, earthquakeInfo]);

  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(defaultSummary);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [copyState, setCopyState] = useState('idle');

  useEffect(() => {
    if (!isEditing) {
      setEditedContent(defaultSummary);
    }
  }, [defaultSummary, isEditing]);

  const sanitizedMarkup = sanitizeHtml(editedContent || '');

  const handleEditClick = useCallback(() => {
    setIsEditing(true);
    setSaveError('');
  }, []);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditedContent(defaultSummary);
    setSaveError('');
  }, [defaultSummary]);

  const handleSaveClick = useCallback(() => {
    if (!editedContent.trim()) {
      setSaveError('Summary cannot be empty');
      return;
    }
    setShowConfirmDialog(true);
  }, [editedContent]);

  const handleConfirmSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError('');

    try {
      const backendHost = getBackendHost();
      if (!backendHost) {
        throw new Error('Backend host is not configured.');
      }

      const response = await axios.patch(
        `${backendHost}/${endpointType}/${eventId}/summary`,
        { text: editedContent },
        { withCredentials: true },
      );

      if (response.data.status === 0) {
        setIsEditing(false);
        setShowConfirmDialog(false);
        const summaryContract = response.data.data || {};
        onSummaryUpdated?.(summaryContract.effectiveSummary || editedContent, summaryContract);
      } else {
        setSaveError(response.data.message || 'Failed to save summary');
      }
    } catch (error) {
      console.error('Error saving summary:', error);

      // First error is when user is not logged in
      setSaveError(error?.response?.data?.message === 'Token in cookie missing' ? 'You are not logged in.' 
        : error?.message || 'Unable to save summary');
    } finally {
      setIsSaving(false);
    }
  }, [endpointType, eventId, editedContent, onSummaryUpdated]);

  const handleCancelConfirm = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  const handleCopySummary = useCallback(async () => {
    const summaryText = editedContent?.trim();
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
  }, [editedContent]);

  return (
    <section className={`${styles.summaryContainer} eqinfo-panel ${className}`.trim()}>
      <div className="panel-header">
        <div className="panel-title">
          <h3>Event summary</h3>
        </div>
        {!isEditing && (
          <div className={styles.headerActions}>
            {editedContent.trim() && (
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
            {canEdit && (
              <button
                className={styles.iconButton}
                onClick={handleEditClick}
                title="Edit event summary"
                aria-label="Edit event summary"
                type="button"
              >
                <FiEdit2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="panel-body">
        {!isEditing ? (
          editedContent.trim() ? (
            <div
              className="eqinfo-copy"
              dangerouslySetInnerHTML={{ __html: sanitizedMarkup }}
            />
          ) : (
            <div className={styles.placeholderText}>
              No event summary available.
            </div>
          )
        ) : (
          <div className={styles.editingContent}>
            <textarea
              className={styles.textarea}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              placeholder="Enter event summary..."
              rows={12}
              disabled={isSaving}
            />
            {saveError && <div className={styles.errorMessage}>{saveError}</div>}
            <div className={styles.buttonGroup}>
              <button
                className={styles.cancelButton}
                onClick={handleCancel}
                disabled={isSaving}
                aria-label="Cancel editing"
              >
                <FiX size={18} />
                Cancel
              </button>
              <button
                className={styles.saveButton}
                onClick={handleSaveClick}
                disabled={isSaving || !editedContent.trim()}
                aria-label="Save event summary"
              >
                {isSaving ? (
                  <>
                    <span className={styles.spinner} />
                    Saving...
                  </>
                ) : (
                  <>
                    <FiCheck size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {showConfirmDialog && (
        <div className={styles.modalBackdrop} onClick={handleCancelConfirm}>
          <div
            className={styles.confirmDialog}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="confirm-title"
            aria-modal="true"
          >
            <h4 id="confirm-title">Confirm Changes</h4>
            <p>Are you sure you want to save these changes to the event summary?</p>
            <div className={styles.confirmButtonGroup}>
              <button
                className={styles.cancelButton}
                onClick={handleCancelConfirm}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className={styles.confirmButton}
                onClick={handleConfirmSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <span className={styles.spinner} />
                    Saving...
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default EditableEventSummary;
