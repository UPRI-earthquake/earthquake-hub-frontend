import { FiUser } from "react-icons/fi";

interface ReportAuthorAvatarProps {
  author: string;
}

export default function ReportAuthorAvatar({ author }: ReportAuthorAvatarProps) {
  const displayAuthor = author || 'Anonymous';
  const isAnonymous = displayAuthor.toLowerCase() === 'anonymous';
  const initials = getAuthorInitials(displayAuthor);

  return (
    <span
      className={`report-author-avatar ${isAnonymous ? 'report-author-avatar-anonymous' : ''}`}
      title={displayAuthor}
      aria-label={`Reported by ${displayAuthor}`}
    >
      {isAnonymous ? <FiUser aria-hidden="true" /> : initials}
    </span>
  );
}


function getAuthorInitials(author) {
  if (!author || author.toLowerCase() === 'anonymous') return '';
  return author
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}