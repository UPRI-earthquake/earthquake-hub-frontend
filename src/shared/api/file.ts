export function getFilenameFromResponse(response: any) {
    const contentDisposition = response.headers['content-disposition'];

    if (!contentDisposition) return null;

    const filenameRegex = /filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i;
    const match = contentDisposition.match(filenameRegex);

    if (match && match[1]) {
        return decodeURIComponent(match[1]);
    }

    return null;
}