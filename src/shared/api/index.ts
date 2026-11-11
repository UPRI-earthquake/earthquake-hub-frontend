import axios from "axios";
import { getFilenameFromResponse } from "./file";
import { APIRequestHost, APIRequestParams, APIResponse } from "./types";

const HOST_BASE_URLS: Record<APIRequestHost, string> = {
    backend: import.meta.env.VITE_APP_BACKEND,
    fdsnws: import.meta.env.VITE_APP_FDSNWS,
    "fdsnws-rs": import.meta.env.VITE_APP_RS_FDSNWS
}

export function getAPIURL(host: APIRequestHost, path?: string) {
    const hostURL = HOST_BASE_URLS[host];
    if(!path) return hostURL;
    
    if(path.startsWith("/")) path = path.slice(1);
    return `${hostURL}/${path}`;
}

export async function sendAPIRequestThrowsException<B = any, K = any>(options: APIRequestParams<B>): Promise<APIResponse<K>> {
    const { host, method = "GET", path, params, body, responseType = "json", headers } = options;

    try {
        const url = getAPIURL(host, path);

        const response = await axios({
            url, method, params,
            ...(body && { data: body }),
            headers: {
                // ...(token && { Authorization: `Bearer ${token}` }),
                ...(headers || {})
            },
            responseType,
            withCredentials: true
        });

        const responseContentType: any = response.headers['content-type'];
        const isJSON = responseContentType?.includes("application/json");

        return {
            headers: response.headers,
            data: response.data,
            status: response.status,
            type: isJSON ? "json" : "blob",
            filename: isJSON ? null : getFilenameFromResponse(response),
            success: true
        };

    } catch(error) {
        if (axios.isAxiosError(error)) {
            throw new APIResponseError(
                error.response?.data?.error?.title ?? "Erreur",
                error.response?.data?.error?.message ?? "Something went wrong.",
                error.response?.status ?? 500,
                error.response?.data?.error?.details);
        } else {
            throw new APIResponseError("Error", "Something went wrong.");
        }
    }
}

export async function sendAPIRequestFromReactQuery<B = any, K = any>(options: APIRequestParams<B>): Promise<K> {
    const response = await sendAPIRequestThrowsException<B, K>(options);
    return response.data;
}


/**
 * 
 * @param {APIRequestParams} params 
 * @returns {Promise<APIResponse>}
 */
export async function sendAPIRequest(params) {
    try {
        const response = await sendAPIRequestThrowsException(params);
        return response;
    } catch(e) {
        return {
            type: "json",
            status: e instanceof APIResponseError ? e.statusCode : 500,
            success: false,
            error: e instanceof APIResponseError ? e : {
                title: "Something went wrong",
                message: e,
                statusCode: 500
            },
        };
    }
}


export class APIResponseError {
    title;
    message;
    statusCode;
    details;

    constructor(title, message, statusCode = 500, details = undefined) {
        this.title = title;
        this.message = message;
        this.statusCode = statusCode;
        this.details = details;
    }
}
