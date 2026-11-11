import { useMutation, useQuery } from "@tanstack/react-query";
import { EarthquakeReportComment } from "../types/earthquake";
import { sendAPIRequestFromReactQuery } from "@/shared/api";


interface RemoteGetReportCommentsResponsePagination {
  total: number;
  limit: number;
  offset: number;
  nextCursor: string;
  hasMore: boolean;
}

interface RemoteGetReportCommentsResponse {
  status: number;
  message: string;
  payload: EarthquakeReportComment[];
  pagination: RemoteGetReportCommentsResponsePagination;
}

export function useRemoteGetReportComments(eventId?: string, cursor?: string) {
  return useQuery({
    enabled: !!eventId,
    queryKey: [ "report-comments", eventId, cursor ],
    queryFn: async ({ }) => {
      const response = await sendAPIRequestFromReactQuery<any, RemoteGetReportCommentsResponse>({ 
        host: "backend",
        path: `/comments/`,
        params: { eventId, cursor }
      });

      return {
        comments: response.payload,
        pagination: response.pagination
      };
    }
  })
}

export function useRemotePostReportComment() {
  return useMutation<any, any, { formData: FormData }>({
    mutationFn: ({ formData }) => {
      return sendAPIRequestFromReactQuery<FormData>({
        host: "backend",
        method: "POST",
        path: "/comments",
        body: formData
      });
    }
  })
}

export function useRemoteToggleMarkCommentHelpful() {
  return useMutation<any, any, { commentKey: string, upvote: boolean }>({
    mutationFn: ({ commentKey, upvote }) => {
      return sendAPIRequestFromReactQuery<FormData>({
        host: "backend",
        method: upvote ? "PUT" : "DELETE",
        path: `/comments/${encodeURIComponent(commentKey)}/helpful`,
      });
    }
  });
}

export function useRemoteReportIssue() {
  return useMutation<any, any, { commentKey: string, reason: string }>({
    mutationFn: ({ commentKey, reason }) => {
      return sendAPIRequestFromReactQuery({
        host: "backend",
        method: "POST",
        path: `/comments/${encodeURIComponent(commentKey)}/issues`,
        body: { reason }
      });
    }
  })
}