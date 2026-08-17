// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)
import { ENV } from './_core/env';
function getStorageConfig() {
    const baseUrl = ENV.forgeApiUrl;
    const apiKey = ENV.forgeApiKey;
    if (!baseUrl || !apiKey) {
        throw new Error("Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY");
    }
    return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}
function buildUploadUrl(baseUrl, relKey) {
    const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
    url.searchParams.set("path", normalizeKey(relKey));
    return url;
}
async function buildDownloadUrl(baseUrl, relKey, apiKey) {
    const downloadApiUrl = new URL("v1/storage/downloadUrl", ensureTrailingSlash(baseUrl));
    downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
    const response = await fetch(downloadApiUrl, {
        method: "GET",
        headers: buildAuthHeaders(apiKey),
    });
    return (await response.json()).url;
}
function ensureTrailingSlash(value) {
    return value.endsWith("/") ? value : `${value}/`;
}
function normalizeKey(relKey) {
    return relKey.replace(/^\/+/, "");
}
function toFormData(data, contentType, fileName) {
    const blob = typeof data === "string"
        ? new Blob([data], { type: contentType })
        : new Blob([data], { type: contentType });
    const form = new FormData();
    form.append("file", blob, fileName || "file");
    return form;
}
function buildAuthHeaders(apiKey) {
    return { Authorization: `Bearer ${apiKey}` };
}
export async function storagePut(relKey, data, contentType = "application/octet-stream") {
    const { baseUrl, apiKey } = getStorageConfig();
    const key = normalizeKey(relKey);
    const uploadUrl = buildUploadUrl(baseUrl, key);
    const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
    const response = await fetch(uploadUrl, {
        method: "POST",
        headers: buildAuthHeaders(apiKey),
        body: formData,
    });
    if (!response.ok) {
        const message = await response.text().catch(() => response.statusText);
        throw new Error(`Storage upload failed (${response.status} ${response.statusText}): ${message}`);
    }
    const url = (await response.json()).url;
    return { key, url };
}
export async function storageGet(relKey) {
    const { baseUrl, apiKey } = getStorageConfig();
    const key = normalizeKey(relKey);
    return {
        key,
        url: await buildDownloadUrl(baseUrl, key, apiKey),
    };
}
