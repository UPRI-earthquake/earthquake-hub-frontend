import moment from "@/shared/utils/time";
import { EarthquakeReportComment } from "../types/earthquake";
import { getAPIURL } from "@/shared/api";

export function getCommentText(comment: EarthquakeReportComment) {
  // TODO: Decide on a single field name
  return (
    comment?.comment ||
    comment?.content ||
    comment?.description ||
    comment?.report ||
    comment?.text ||
    ''
  );
}

export function getCommentHelpfulCount(comment: EarthquakeReportComment) {
  // TODO: Decide on a single field name
  const rawCount = Number(comment?.helpfulCount ?? comment?.helpful_count ?? 0);
  return Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 0;
}

export function getViewerHasMarkedHelpful(comment: EarthquakeReportComment) {
  return Boolean(comment?.viewerHasMarkedHelpful || comment?.viewer_has_marked_helpful);
}


export function getCommentImage(comment: EarthquakeReportComment) {
  // TODO: Decide on a single field name
  return (
    comment?.imageUrl ||
    comment?.imageURL ||
    comment?.image ||
    comment?.photoUrl ||
    comment?.photo ||
    comment?.attachmentUrl ||
    ''
  );
}

export function resolveCommentImageUrl(imageUrl: string) {
  if (typeof imageUrl !== 'string') return '';

  const trimmedUrl = imageUrl.trim();
  if (!trimmedUrl) return '';

  const isSafeDataImageUrl = (url) => /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(url);
  const isSafeHttpUrl = (url) => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch (_) {
      return false;
    }
  };

  if (isSafeDataImageUrl(trimmedUrl) || isSafeHttpUrl(trimmedUrl) || /^\/\//.test(trimmedUrl)) {
    return trimmedUrl;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmedUrl)) return '';

  const apiHost = getAPIURL("backend");
  if (!apiHost) return trimmedUrl;

  try {
    const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
    const backendUrl = new URL(apiHost, fallbackOrigin);
    const resolvedUrl = new URL(trimmedUrl, `${backendUrl.origin}/`).toString();
    return isSafeHttpUrl(resolvedUrl) ? resolvedUrl : '';
  } catch (_) {
    const host = apiHost.replace(/\/api\/?$/i, '').replace(/\/+$/, '');
    const path = trimmedUrl.replace(/^\/+/, '');
    const resolvedUrl = `${host}/${path}`;
    return isSafeHttpUrl(resolvedUrl) ? resolvedUrl : '';
  }
}


export function getCommentAuthor(comment: EarthquakeReportComment) {
  // TODO: Decide on a single field name
  if (comment?.anonymous || comment?.isAnonymous) return 'Anonymous';
  return (
    comment?.author ||
    comment?.username ||
    comment?.user?.username ||
    comment?.user?.name ||
    'Anonymous'
  );
}

export function formatCommentTime(comment: EarthquakeReportComment) {
  // TODO: Decide on a single field name
  const raw = comment?.createdAt || comment?.created_at || comment?.timestamp || comment?.date;
  if (!raw) return '';
  const parsed = moment(raw);
  return parsed.isValid() ? parsed.format('MMM D, YYYY, h:mm A') : '';
}


interface CommentResponse {
  payload?: EarthquakeReportComment[] | { comments?: EarthquakeReportComment[]; total?: number | string };
  comments?: EarthquakeReportComment[];
  total?: number | string;
  pagination?: { total?: number | string; nextCursor?: string; hasMore?: boolean };
}

export function getCommentsFromResponse(data: CommentResponse | EarthquakeReportComment[]) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.payload)) return data.payload;
  if (Array.isArray(data?.comments)) return data.comments;
  const comments = !Array.isArray(data?.payload) ? data?.payload?.comments : undefined;
  if (Array.isArray(comments)) return comments;
  return [];
}

export function getCommentTotalFromResponse(data: CommentResponse, comments: EarthquakeReportComment[]) {
  const payloadTotal = !Array.isArray(data?.payload) ? data?.payload?.total : undefined;
  const total = Number(data?.pagination?.total ?? data?.total ?? payloadTotal);
  return Number.isFinite(total) ? total : comments.length;
}

export function getCommentPaginationFromResponse(data: CommentResponse) {
  const pagination = data?.pagination && typeof data.pagination === 'object' ? data.pagination : undefined;
  return {
    nextCursor: typeof pagination?.nextCursor === 'string' && pagination.nextCursor ? pagination.nextCursor : null,
    hasMore: Boolean(pagination?.hasMore),
  };
}

export function getCommentKey(comment: EarthquakeReportComment, fallback = ''): string {
  return comment?.commentId || comment?.id || comment?._id || fallback;
}

export function formatReportCount(count: number): string {
  const numericCount = Number(count);
  if (!Number.isFinite(numericCount) || numericCount <= 0) return '';
  return `${numericCount} ${numericCount === 1 ? 'report' : 'reports'}`;
}
