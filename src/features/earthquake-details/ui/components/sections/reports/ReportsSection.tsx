import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiFlag, FiImage, FiSend, FiThumbsUp, FiX } from "react-icons/fi";
import { REPORTS_INITIAL_VISIBLE_COUNT, REPORTS_VISIBLE_INCREMENT, REPORT_IMAGE_MAX_BYTES, REPORT_IMAGE_TYPES } from "../../../../constants/reports";
import { getCommentAuthor, getCommentHelpfulCount, getCommentImage, getCommentKey, getCommentText, getViewerHasMarkedHelpful, resolveCommentImageUrl } from "../../../../services/reports";
import ReportAttachment from "./ReportAttachment";
import ReportAuthorAvatar from "./ReportAuthorAvatar";
import { formatCommentTime, formatReportCount } from "../../../../services/reports";
import useEarthquakeInfo from "../../../../hooks/useEarthquakeInfo";
import useReports from "../../../../hooks/useReports";
import InfoTooltip from '@/shared/ui/components/InfoTooltip';
import { useAuth } from "@/shared/services/account/context";

const REPORT_ISSUE_REASONS = [
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'unclear', label: 'Unclear' },
  { value: 'wrong_location', label: 'Wrong location' },
  { value: 'not_related', label: 'Not related to this earthquake' },
  { value: 'inappropriate', label: 'Inappropriate' },
];

interface ReportsSectionProps {
  onAttachmentPreview: (attachment: any) => void;
}

export default function ReportSection({ onAttachmentPreview }: ReportsSectionProps) {
  const { eventId } = useEarthquakeInfo();
  const {
    comments = [],
    count: totalCount,
    isLoading,
    error: loadError,
    hasMore,
    loadMoreReports: onLoadMore,
    
    toggleMarkCommentHelpful,
    isToggleCommentVoteSuccess,
    toggleCommentVoteError,

    reportIssue,
    isReportIssueSuccess,
    reportIssueError,

    reloadReports,
    postReport,
    isPosting,
    postError,
    isPostSuccess
  } = useReports();

  const { isLoggedIn, profile } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [postAnonymously, setPostAnonymously] = useState(true);
  const [displayedPostError, setDisplayedPostError] = useState<string>();
  useEffect(() => setDisplayedPostError(postError ? (postError?.response?.data?.message || postError?.message || 'Failed to post report.') : ''), [postError]);
  const [expandedComments, setExpandedComments] = useState({});
  const [reportActionMessage, setReportActionMessage] = useState('');
  const [pendingHelpfulCommentId, setPendingHelpfulCommentId] = useState('');
  const [issueMenuCommentId, setIssueMenuCommentId] = useState('');
  const [pendingIssueCommentId, setPendingIssueCommentId] = useState('');
  const [reportedIssueReasons, setReportedIssueReasons] = useState({});
  const [visibleReportLimit, setVisibleReportLimit] = useState(REPORTS_INITIAL_VISIBLE_COUNT);
  const triggerButtonRef = useRef(null);
  const textareaRef = useRef(null);
  const canPostWithAccount = isLoggedIn;
  const selectedFileSummary = imageFile ? `${imageFile.name} (${Math.max(1, Math.round(imageFile.size / 1024))} KB)` : '';
  const visibleComments = useMemo(
    () => comments.slice(0, visibleReportLimit),
    [comments, visibleReportLimit]
  );
  const visibleReportCount = visibleComments.length;
  const reportedTotalCount = Math.max(Number(totalCount) || 0, comments.length);
  const hasHiddenLoadedReports = comments.length > visibleReportCount;
  const canShowMoreReports = hasHiddenLoadedReports || hasMore;

  useEffect(() => {
    if(!isPostSuccess) return;

    setIsModalOpen(false);
    resetForm();
    triggerButtonRef.current?.focus();
    reloadReports();
  }, [isPostSuccess]);


  const resetForm = useCallback(() => {
    setReportText('');
    setImageFile(null);
    setImagePreviewUrl('');
    setPostAnonymously(true);
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);


  useEffect(() => {
    if (!canPostWithAccount) {
      setPostAnonymously(true);
    }
  }, [canPostWithAccount]);

  useEffect(() => {
    if (!isModalOpen) return undefined;

    const focusTimer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!isPosting) {
          setIsModalOpen(false);
          resetForm();
          triggerButtonRef.current?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, isPosting, resetForm]);

  const closeModal = useCallback(() => {
    if (isPosting) return;
    setIsModalOpen(false);
    resetForm();
    triggerButtonRef.current?.focus();
  }, [isPosting, resetForm]);

  const toggleExpandedComment = useCallback((commentKey) => {
    setExpandedComments((prev) => ({
      ...prev,
      [commentKey]: !prev[commentKey],
    }));
  }, []);

  const promptSignInForReportAction = () => {
    setReportActionMessage('Sign in to mark reports as helpful or report an issue.');
  };


  const handleToggleHelpful = useCallback(async (comment) => {
    const commentKey = getCommentKey(comment);
    if (!commentKey || pendingHelpfulCommentId) return;

    if (!canPostWithAccount) {
      promptSignInForReportAction();
      return;
    }

    const wasMarkedHelpful = getViewerHasMarkedHelpful(comment);

    setReportActionMessage('');
    setPendingHelpfulCommentId(commentKey);

    toggleMarkCommentHelpful(comment, !wasMarkedHelpful);
  }, [canPostWithAccount]);
  
  useEffect(() => {
    if(!(isToggleCommentVoteSuccess || !!toggleCommentVoteError)) return;

    setPendingHelpfulCommentId('');
    reloadReports();
  }, [isToggleCommentVoteSuccess, toggleCommentVoteError]);

  const handleOpenIssueMenu = useCallback((commentKey) => {
    if (!commentKey) return;
    if (!canPostWithAccount) {
      promptSignInForReportAction();
      return;
    }
    setReportActionMessage('');
    setIssueMenuCommentId((current) => (current === commentKey ? '' : commentKey));
  }, [canPostWithAccount, promptSignInForReportAction]);

  const handleReportIssue = useCallback(async (commentKey, reason) => {
    if (!commentKey || pendingIssueCommentId) return;
    if (!canPostWithAccount) {
      promptSignInForReportAction();
      return;
    }

    setReportActionMessage('');
    setPendingIssueCommentId(commentKey);
    reportIssue(commentKey, reason);
    setReportedIssueReasons((prev) => ({
      ...prev,
      [commentKey]: reason,
    }));
  }, [
    canPostWithAccount,
    pendingIssueCommentId,
    promptSignInForReportAction,
  ]);

  useEffect(() => {
    if(!(isReportIssueSuccess || !!reportIssueError)) return;

    if(isReportIssueSuccess) {
      setIssueMenuCommentId('');
      setReportActionMessage('Issue report submitted for review.');
    }

    setPendingIssueCommentId('');
  }, [isReportIssueSuccess, reportIssueError])

  const handleShowMoreReports = useCallback(() => {
    if (hasHiddenLoadedReports) {
      setVisibleReportLimit((current) => current + REPORTS_VISIBLE_INCREMENT);
      return;
    }

    if (hasMore) {
      setVisibleReportLimit((current) => current + REPORTS_VISIBLE_INCREMENT);
      onLoadMore?.();
    }
  }, [hasHiddenLoadedReports, hasMore, onLoadMore]);

  const handleImageChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    if (!nextFile) {
      setImageFile(null);
      return;
    }
    if (!REPORT_IMAGE_TYPES.includes(nextFile.type)) {
      setDisplayedPostError('Report image must be a JPG, PNG, GIF, or WebP file.');
      event.target.value = '';
      setImageFile(null);
      return;
    }
    if (nextFile.size > REPORT_IMAGE_MAX_BYTES) {
      setDisplayedPostError('Report image must be 5 MB or smaller.');
      event.target.value = '';
      setImageFile(null);
      return;
    }
    setDisplayedPostError('');
    setImageFile(nextFile);
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!eventId || isPosting) return;

    const trimmedText = reportText.trim();
    if (!trimmedText && !imageFile) {
      setDisplayedPostError('Add a report or image before posting.');
      return;
    }

    setDisplayedPostError('');
    postReport({ postAnonymously, content: trimmedText, imageFile });
  };

  return (
    <section className="eqinfo-panel report-section" aria-labelledby="report-section-title">
      <div className="report-section-header">
        <div>
          <div className="report-section-heading-row">
            <h3 id="report-section-title">Reports</h3>
            <InfoTooltip
              title="Community reports"
              label="About community reports"
              variant="inline"
            >
              Community observations linked to this earthquake are public submissions and may not be verified by UPRI.
            </InfoTooltip>
          </div>
          <p className="report-trust-note">
            Public submissions may not be verified by UPRI.
          </p>
        </div>
        <button
          id="report-post-trigger"
          type="button"
          className="report-primary-button"
          ref={triggerButtonRef}
          onClick={() => setIsModalOpen(true)}
          disabled={!eventId}
        >
          Post a Report
        </button>
      </div>

      {loadError && <div className="report-message report-message-error" role="alert">{loadError}</div>}
      {reportActionMessage && (
        <div className="report-message report-action-message" role="status">
          {reportActionMessage}
        </div>
      )}

      <div className="report-list" aria-live="polite">
        {isLoading && comments.length === 0 ? (
          <div className="report-empty" role="status">Loading reports...</div>
        ) : comments.length > 0 ? (
          visibleComments.map((comment, index) => {
            const imageUrl = resolveCommentImageUrl(getCommentImage(comment));
            const text = getCommentText(comment);
            const commentKey = getCommentKey(comment, `${eventId}-comment-${index}`);
            const author = getCommentAuthor(comment);
            const isExpanded = Boolean(expandedComments[commentKey]);
            const shouldClampText = Boolean(text && text.length > 160);
            const helpfulCount = getCommentHelpfulCount(comment);
            const hasMarkedHelpful = getViewerHasMarkedHelpful(comment);
            const isHelpfulPending = pendingHelpfulCommentId === commentKey;
            const isIssuePending = pendingIssueCommentId === commentKey;
            const reportedIssueReason = reportedIssueReasons[commentKey] || '';
            return (
              <article
                className={`report-card ${imageUrl ? 'report-card-with-media' : ''}`}
                key={commentKey}
                id={`comment-${commentKey}`}
              >
                {imageUrl && (
                  <div className="report-card-media">
                    <ReportAttachment
                      src={imageUrl}
                      onPreview={(src) => onAttachmentPreview?.({
                        src,
                        alt: `Submitted report attachment from ${author}`,
                      })}
                    />
                  </div>
                )}
                <div className="report-card-content">
                  <div className="report-card-meta">
                    <div className="report-card-author">
                      <ReportAuthorAvatar author={author} />
                      <strong className="report-card-author-name">{author}</strong>
                    </div>
                    {formatCommentTime(comment) && <span>{formatCommentTime(comment)}</span>}
                  </div>
                  {text && (
                    <>
                      <p className={shouldClampText && !isExpanded ? 'report-text-clamped' : ''}>{text}</p>
                      {shouldClampText && (
                        <button
                          type="button"
                          className="report-text-toggle"
                          onClick={() => toggleExpandedComment(commentKey)}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </>
                  )}
                  <div className="report-card-actions" aria-label={`Actions for report by ${author}`}>
                    <button
                      type="button"
                      className={`report-action-button report-helpful-button ${hasMarkedHelpful ? 'is-active' : ''}`}
                      onClick={() => handleToggleHelpful(comment)}
                      disabled={Boolean(pendingHelpfulCommentId)}
                      aria-pressed={hasMarkedHelpful}
                      title={canPostWithAccount ? 'Mark this report as helpful' : 'Sign in to mark reports as helpful'}
                    >
                      <FiThumbsUp aria-hidden="true" />
                      <span>{isHelpfulPending ? 'Saving...' : 'Helpful'}</span>
                      {helpfulCount > 0 && <strong className="report-action-count">{helpfulCount}</strong>}
                    </button>
                    <div className="report-issue-action">
                      <button
                        type="button"
                        className="report-action-button report-issue-button"
                        onClick={() => handleOpenIssueMenu(commentKey)}
                        disabled={Boolean(pendingIssueCommentId)}
                        aria-expanded={issueMenuCommentId === commentKey}
                        title={canPostWithAccount ? 'Privately report a problem with this report' : 'Sign in to report an issue'}
                      >
                        <FiFlag aria-hidden="true" />
                        <span>{reportedIssueReason ? 'Issue sent' : isIssuePending ? 'Sending...' : 'Report issue'}</span>
                      </button>
                      {issueMenuCommentId === commentKey && (
                        <div className="report-issue-menu" role="menu" aria-label="Choose issue reason">
                          {REPORT_ISSUE_REASONS.map((reason) => (
                            <button
                              key={reason.value}
                              type="button"
                              role="menuitem"
                              onClick={() => handleReportIssue(commentKey, reason.value)}
                              disabled={isIssuePending}
                            >
                              {reason.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="report-empty report-empty-compact eqinfo-empty-state eqinfo-empty-state--compact" role="status">
            <strong>No reports yet.</strong>
            <span>Share the first on-the-ground observation for this event.</span>
            <small>Use “Post a Report” to add a public note or image.</small>
          </div>
        )}
      </div>

      {comments.length > 0 && (
        <div className="report-load-more-row">
          <span className="report-visible-count">
            Showing {visibleReportCount} of {formatReportCount(reportedTotalCount)}
          </span>
          {canShowMoreReports && (
            <button
              type="button"
              className="report-secondary-button"
              onClick={handleShowMoreReports}
              disabled={hasMore}
            >
              {isLoading
                ? 'Loading reports...'
                : hasHiddenLoadedReports
                  ? 'Show more reports'
                  : 'Load more reports'}
            </button>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="report-modal-backdrop" role="presentation" onMouseDown={closeModal}>
          <form
            className="report-modal"
            aria-modal="true"
            aria-labelledby="report-modal-title"
            aria-describedby={displayedPostError ? 'report-form-error' : undefined}
            role="dialog"
            onSubmit={handleSubmitReport}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="report-modal-titlebar">
              <div className="report-modal-heading">
                <h3 id="report-modal-title">Post a Report</h3>
                <p>Share a public observation linked to this earthquake.</p>
              </div>
              <button type="button" className="report-icon-button" onClick={closeModal} aria-label="Close report form">
                <FiX />
              </button>
            </div>

            <div className="report-modal-intro">
              <div className="report-anonymous-status">
                <span aria-hidden="true" />
                {postAnonymously
                  ? 'Anonymous report'
                  : `Posting as ${profile?.username || 'your account'}`}
              </div>
              <p>
                Text or image is required. Avoid sharing personal contact details.
                {!canPostWithAccount ? ' Sign in from the account menu to post under your contributor name.' : ''}
              </p>
            </div>

            <div className="report-field-row">
              <label className="report-field-label" htmlFor="report-observation">
                Observation
              </label>
              <span>{reportText.trim().length} characters</span>
            </div>
            <textarea
              id="report-observation"
              ref={textareaRef}
              value={reportText}
              onChange={(event) => setReportText(event.target.value)}
              placeholder="Describe what you observed..."
              rows={5}
            />

            {imagePreviewUrl && (
              <div className="report-image-preview">
                <img src={imagePreviewUrl} alt="Selected report attachment preview" />
                <div className="report-image-preview-meta">
                  <strong>Attached image</strong>
                  <span>{selectedFileSummary}</span>
                  <button type="button" onClick={() => setImageFile(null)}>Remove image</button>
                </div>
              </div>
            )}

            <div className="report-modal-controls">
              <label className="report-image-button">
                <FiImage aria-hidden="true" />
                Add image
                <input type="file" accept={REPORT_IMAGE_TYPES.join(',')} onChange={handleImageChange} />
              </label>
              <span className="report-control-hint">JPG, PNG, GIF, or WebP up to 5 MB</span>
            </div>

            <div className="report-modal-controls report-modal-controls-secondary">
              {canPostWithAccount ? (
                <label className="report-checkbox">
                  <input
                    type="checkbox"
                    checked={postAnonymously}
                    onChange={(event) => setPostAnonymously(event.target.checked)}
                  />
                  <span>Post anonymously</span>
                </label>
              ) : (
                <div className="report-identity-note" aria-live="polite">
                  This report will be posted anonymously.
                </div>
              )}
            </div>

            {displayedPostError && (
              <div id="report-form-error" className="report-message report-message-error" role="alert">
                {displayedPostError}
              </div>
            )}

            <div className="report-modal-actions">
              <button type="button" className="report-secondary-button" onClick={closeModal} disabled={isPosting}>
                Cancel
              </button>
              <button type="submit" className="report-submit-button" disabled={isPosting}>
                <span>{isPosting ? 'Posting...' : 'Post Report'}</span>
                <FiSend aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      )}

    </section>
  );
}