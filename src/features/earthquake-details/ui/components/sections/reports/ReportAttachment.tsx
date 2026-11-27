import { useEffect, useState } from "react";

interface ReportAttachmentProps {
  src: string;
  onPreview: (src: string) => void;
}

export default function ReportAttachment({ src, onPreview }: ReportAttachmentProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [isUnavailable, setIsUnavailable] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setIsUnavailable(false);
  }, [src]);

  if (isUnavailable) {
    return (
      <div className="report-attachment-unavailable" role="status">
        Attachment unavailable
      </div>
    );
  }

  if (!currentSrc) return null;

  return (
    <button
      type="button"
      className="report-attachment-button"
      onClick={() => onPreview?.(currentSrc)}
      aria-label="Open submitted report attachment"
    >
      <img
        src={currentSrc}
        alt="Submitted report attachment"
        onError={() => {
          setCurrentSrc('');
          setIsUnavailable(true);
        }}
      />
    </button>
  );
}