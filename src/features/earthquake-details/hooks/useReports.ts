import { useCallback, useMemo, useState } from "react";
import { getCommentImage, getCommentKey, resolveCommentImageUrl } from "../services/reports";
import useEarthquakeInfo from "./useEarthquakeInfo";
import { getEarthquakeEventId } from "../services/earthquake";
import { EarthquakeReportComment } from "../types/earthquake";
import { useRemoteGetReportComments, useRemotePostReportComment, useRemoteReportIssue, useRemoteToggleMarkCommentHelpful } from "../data/reports";


interface UseReportsReturn {
  comments: EarthquakeReportComment[];
  count: number;
  isLoading: boolean;
  hasMore: boolean;
  error: any;
  nextCursor: any;
  hasImageReports: boolean;
  loadMoreReports: () => void;
  reloadReports: () => void;

  toggleMarkCommentHelpful: (comment: EarthquakeReportComment, upvote: boolean) => void;
  isTogglingCommentVote: boolean;
  isToggleCommentVoteSuccess: boolean;
  toggleCommentVoteError?: any;

  reportIssue: (commentKey: string, reason: string) => void;
  isReportingIssue: boolean;
  isReportIssueSuccess: boolean;
  reportIssueError?: any;

  postReport: PostReportMethod;
  isPosting: boolean;
  isPostSuccess?: boolean;
  postError?: any;
}

type PostReportMethod = (params: {
  postAnonymously?: boolean;
  content: string;
  imageFile?: File;
}) => void;


export default function useReports(): UseReportsReturn {
  const { eventId, earthquakeInfo } = useEarthquakeInfo();

  const reportEventId = useMemo(
    () => (earthquakeInfo ? getEarthquakeEventId(earthquakeInfo, eventId) : ''),
    [earthquakeInfo, eventId]
  );

  const [ fetchCursor, setFetchCursor ] = useState<string>();
  
  const { data, isLoading, error, refetch: reloadReports } = useRemoteGetReportComments(reportEventId, fetchCursor);
  const { comments, pagination } = useMemo(() => data || { comments: [], pagination: {} as any }, [data]);
  const { total: count = 0, nextCursor, hasMore = false } = pagination;


  const hasImageReports = useMemo(
    () => comments?.some((comment) => Boolean(resolveCommentImageUrl(getCommentImage(comment)))) ?? false,
    [comments]
  );

  const loadMoreReports = useCallback(() => {
    if (!hasMore || !nextCursor) return;
    setFetchCursor(nextCursor);
  }, [hasMore, nextCursor]);



  const remotePostReport = useRemotePostReportComment();
  const postReport: PostReportMethod = useCallback((params) => {
    const { postAnonymously = true, content, imageFile } = params;
    const formData = new FormData();
    formData.append('eventId', eventId);
    formData.append('anonymous', postAnonymously ? 'true' : 'false');
    formData.append('content', content);
    if(imageFile) formData.append('image', imageFile);

    remotePostReport.mutate({ formData });
  }, [eventId]);

  const remoteToggleMarkCommentHelpful = useRemoteToggleMarkCommentHelpful();
  const toggleMarkCommentHelpful = (comment: EarthquakeReportComment, upvote: boolean) => {
    remoteToggleMarkCommentHelpful.mutate({ 
      commentKey: getCommentKey(comment),
      upvote
    });
  };

  const remoteReportIssue = useRemoteReportIssue();
  const reportIssue = (commentKey: string, reason: string) => {
    remoteReportIssue.mutate({ commentKey, reason });
  };
  
  return { 
    comments, count, 
    isLoading, hasMore, 
    error, nextCursor,
    hasImageReports,
    loadMoreReports,
    reloadReports,

    toggleMarkCommentHelpful,
    isTogglingCommentVote: remoteToggleMarkCommentHelpful.isPending,
    isToggleCommentVoteSuccess: remoteToggleMarkCommentHelpful.isSuccess,
    toggleCommentVoteError: remoteToggleMarkCommentHelpful.error,

    reportIssue,
    isReportingIssue: remoteReportIssue.isPending,
    isReportIssueSuccess: remoteReportIssue.isSuccess,
    reportIssueError: remoteReportIssue.error,

    postReport,
    isPosting: remotePostReport.isPending,
    isPostSuccess: remotePostReport.isSuccess,
    postError: remotePostReport.error,
  };
}