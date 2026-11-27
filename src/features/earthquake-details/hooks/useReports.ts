import type { APIResponseError } from "@/shared/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  error: unknown;
  nextCursor: string;
  hasImageReports: boolean;
  loadMoreReports: () => void;
  reloadReports: () => void;

  toggleMarkCommentHelpful: (comment: EarthquakeReportComment, upvote: boolean) => void;
  isTogglingCommentVote: boolean;
  isToggleCommentVoteSuccess: boolean;
  toggleCommentVoteError?: APIResponseError;

  reportIssue: (commentKey: string, reason: string) => void;
  isReportingIssue: boolean;
  isReportIssueSuccess: boolean;
  reportIssueError?: APIResponseError;

  postReport: PostReportMethod;
  isPosting: boolean;
  isPostSuccess?: boolean;
  postError?: APIResponseError;
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

  const allCommentsCollectionRef = useRef<{ [commentId: string ]: EarthquakeReportComment }>({});
  const [ allComments, setAllComments ] = useState<EarthquakeReportComment[]>([]);
  const [ count, setTotalCount ] = useState<number>(0);
  const [ nextCursor, setNextCursor ] = useState<string>();
  

  const { data: fetchedData, isLoading, error, refetch: reloadReports } = useRemoteGetReportComments(reportEventId, fetchCursor);

  useEffect(() => {
    if(!fetchedData) return;
    appendComments(fetchedData.comments);
    setTotalCount(fetchedData.pagination.total);
    setNextCursor(fetchedData.pagination.nextCursor);
  }, [fetchedData]);

  const appendComments = (newComments: EarthquakeReportComment[]) => {
    for(const comment of newComments) {
      allCommentsCollectionRef.current[comment.commentId] = comment;
    }

    setAllComments(Object.values(allCommentsCollectionRef.current).sort((a,b) => -a.createdAt.localeCompare(b.createdAt)));
  }

  const hasMore = !!nextCursor;

  const hasImageReports = useMemo(
    () => allComments?.some((comment) => Boolean(resolveCommentImageUrl(getCommentImage(comment)))) ?? false,
    [allComments]
  );

  const loadMoreReports = useCallback(() => {
    if (!hasMore || !nextCursor) return;
    setFetchCursor(nextCursor);
  }, [hasMore, nextCursor]);



  const remotePostReport = useRemotePostReportComment();
  const { mutate: submitReport, isSuccess: isPostSuccess, data: postedReport } = remotePostReport;
  const postReport: PostReportMethod = useCallback((params) => {
    const { postAnonymously = true, content, imageFile } = params;
    const formData = new FormData();
    formData.append('eventId', eventId);
    formData.append('anonymous', postAnonymously ? 'true' : 'false');
    formData.append('content', content);
    if(imageFile) formData.append('image', imageFile);

    submitReport({ formData });
  }, [eventId, submitReport]);

  useEffect(() => {
    if(!isPostSuccess || !postedReport) return;

    appendComments([ postedReport.payload ]);
    setTotalCount(prevTotal => prevTotal + 1);
  }, [isPostSuccess, postedReport]);

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
    comments: allComments, 
    count, 
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