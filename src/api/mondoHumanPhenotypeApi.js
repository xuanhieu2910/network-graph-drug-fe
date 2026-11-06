/** Disease–HPO annotations: only records returned by a REAL relation API create edges.
 * The route below is a conventional guess. Confirm FastAPI /docs or set
 * VITE_KG_MONDO_HPO_API_PATH to the actual route in your .env.local.
 */
import { configuredGraphPath, fetchGraphApi, graphApiEnv, graphApiUrl } from "./graphApiClient.js";

export const MONDO_HPO_DEFAULT_PATH = "/mondo_human_phenotype/find_all";
const ENV_KEY = "VITE_KG_MONDO_HPO_API_PATH";

export function hasMondoHumanPhenotypeApi(env = graphApiEnv()) {
  // Active by default: if the endpoint is wrong, report HTTP 404 instead of
  // silently showing zero Disease–HPO links.
  return String(env?.VITE_KG_ENABLE_MONDO_HPO ?? "true").trim().toLowerCase() !== "false";
}

export function getMondoHumanPhenotypePath(env = graphApiEnv()) {
  const path = configuredGraphPath(ENV_KEY, MONDO_HPO_DEFAULT_PATH, env);
  const useProxy = env?.DEV === true &&
    String(env?.VITE_KG_MONDO_HPO_USE_PROXY ?? "true").trim().toLowerCase() !== "false" &&
    !/^https?:\/\//i.test(path);
  return useProxy ? `/__kg_backend/${path.replace(/^\/+/, "")}` : path;
}

export function getMondoHumanPhenotypeUrl(env = graphApiEnv()) {
  return graphApiUrl(getMondoHumanPhenotypePath(env), env);
}

export function getAllMondoHumanPhenotype(signal, options = {}) {
  const env = options.env ?? graphApiEnv();
  if (!hasMondoHumanPhenotypeApi(env))
    throw new Error("MONDO–HPO disabled: VITE_KG_ENABLE_MONDO_HPO=false");
  return fetchGraphApi(getMondoHumanPhenotypePath(env), signal, "mondoPhenotypes", { ...options, env });
}
