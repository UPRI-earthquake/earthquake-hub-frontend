import { ResponseType } from "axios";
import { APIResponseError } from ".";

export type APIRequestHost = "backend" | "fdsnws" | "fdsnws-rs";

export interface APIRequestParams<B> {
  host: APIRequestHost;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
  path: string;
  body?: B;
  params?: any;
  contentType?: string;
  responseType?: ResponseType;
  isBulkImport?: boolean;
  headers?: any;
}

export interface APIResponse<K> {
  headers: any;
  data?: K;
  filename?: string | null;
  type: "json" | "blob";
  success: boolean;
  status: number;
  error?: APIResponseError;
}