import React, { useCallback, useState } from 'react';
import axios from 'axios';
import { FiEdit2, FiX, FiCheck } from 'react-icons/fi';
import { getBackendHost } from '../utils/backendHost';
import sanitizeHtml from '../utils/sanitizeHtml';
import styles from './EditableEventSummary.module.css';

/**
 * EditableEventSummary - Provides editable event summary with modal dialog and confirmation
 * @param {string} eventId - The event ID to update
 * @param {string} initialSummary - The initial summary content
 * @param {function} onSummaryUpdated - Callback when summary is successfully updated
 * @returns {JSX.Element}
 */
function EditableEventSummary({ eventId, initialSummary, onSummaryUpdated }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(initialSummary);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const sanitizedMarkup = sanitizeHtml(editedContent || '');

  const handleEditClick = useCallback(() => {
    setIsEditing(true);
    setSaveError('');
  }, []);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditedContent(initialSummary);
    setSaveError('');
  }, [initialSummary]);

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
        `${backendHost}/significant-eqs/${eventId}`,
        { eventSummary: editedContent },
        { withCredentials: true },
      );

      if (response.data.status === 0) {
        setIsEditing(false);
        setShowConfirmDialog(false);
        onSummaryUpdated?.(editedContent);
      } else {
        setSaveError(response.data.message || 'Failed to save summary');
      }
    } catch (error) {
      console.error('Error saving summary:', error);
      setSaveError(error?.response?.data?.message || error?.message || 'Unable to save summary');
    } finally {
      setIsSaving(false);
    }
  }, [eventId, editedContent, onSummaryUpdated]);

  const handleCancelConfirm = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  return (
    <section className={`${styles.summaryContainer} eqinfo-panel scrollable`}>
      <div className="panel-header">
        <div className="panel-title">
          <h3>Event summary</h3>
          {!isEditing && (
            <button
              className={styles.editButton}
              onClick={handleEditClick}
              title="Edit event summary"
              aria-label="Edit event summary"
            >
              <FiEdit2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="panel-body">
        {!isEditing ? (
          <div
            className="eqinfo-copy"
            dangerouslySetInnerHTML={{ __html: sanitizedMarkup }}
          />
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
