import type { AxiosResponse } from "axios";

export function getFilenameFromResponse(response: Pick<AxiosResponse, "headers">) {
    const contentDisposition = response.headers['content-disposition'];

    if (typeof contentDisposition !== "string" || !contentDisposition) return null;

    const filenameRegex = /filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i;
    const match = contentDisposition.match(filenameRegex);

    if (match && match[1]) {
        return decodeURIComponent(match[1]);
    }

    return null;
}