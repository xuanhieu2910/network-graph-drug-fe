/**
 * Shared HTTP utility for graph-related FastAPI endpoints.
 * This is NOT an aggregated model API; each model has its own file.
 */
export function graphApiEnv() {
  return import.meta.env ?? {};
}

export function configuredGraphPath(envKey, defaultPath = "", env = graphApiEnv()) {
  const override = env?.[envKey];
  const path = typeof override === "string" ? override.trim() : "";
  return path || defaultPath;
}

export function hasGraphPath(envKey, env = graphApiEnv()) {
  return Boolean(configuredGraphPath(envKey, "", env));
}

export function graphApiUrl(path, env = graphApiEnv()) {
  const cleanPath = String(path ?? "").trim();
  if (!cleanPath) throw new Error("Missing graph API path. Configure the VITE_KG_*_API_PATH value in your .env file.");
  if (/^https?:\/\//i.test(cleanPath)) return cleanPath;
  // Local Vite proxy: same-origin in browser to avoid FastAPI CORS issues.
  if (cleanPath.startsWith("/__kg_backend/")) return cleanPath;

  const origin = String(
    env.VITE_API_BASE_URL ||
    env.VITE_BACKEND_URL ||
    env.VITE_API_URL ||
    "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");
  return `${origin}${cleanPath.startsWith("/") ? "" : "/"}${cleanPath}`;
}

/** Response body may be an array or a paginated object: the mapper handles both. */
export async function fetchGraphApi(path, signal, collection, options = {}) {
  const env = options.env ?? graphApiEnv();
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = graphApiUrl(path, env);
  let response;
  try {
    response = await fetchImpl(url, {
      signal,
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new Error(`${collection} (${url}): connection failed (${error?.message || error}). Check FastAPI and CORS.`);
  }
  if (!response.ok) {
    throw new Error(`${collection}: HTTP ${response.status} ${response.statusText ?? ""} (${url})`);
  }
  const contentType = response.headers?.get?.("content-type") || "";
  if (contentType && !/\bjson\b|\+json/i.test(contentType)) {
    throw new Error(`${collection}: expected JSON, received ${contentType} from ${url}`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${collection}: invalid JSON from ${url}: ${error?.message || error}`);
  }
}
