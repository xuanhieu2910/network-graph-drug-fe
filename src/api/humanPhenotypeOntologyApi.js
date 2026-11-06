/** HPO catalog: always requests the verified Swagger endpoint unless explicitly disabled.
 * Vite development uses a same-origin proxy to avoid CORS. No mock rows or ID-only nodes.
 */
import { configuredGraphPath, fetchGraphApi, graphApiEnv, graphApiUrl } from "./graphApiClient.js";

export const HPO_DEFAULT_PATH = "/human_phenotype_ontology/find_all";
const ENV_KEY = "VITE_KG_HPO_API_PATH";
const VITE_PROXY_PREFIX = "/__kg_backend";

export function hasHumanPhenotypeOntologyApi(env = graphApiEnv()) {
  return String(env?.VITE_KG_ENABLE_HPO ?? "true").trim().toLowerCase() !== "false";
}

export function getHumanPhenotypeOntologyPath(env = graphApiEnv()) {
  const route = configuredGraphPath(ENV_KEY, HPO_DEFAULT_PATH, env);
  const shouldProxy = env?.DEV === true
    && String(env?.VITE_KG_HPO_USE_PROXY ?? "true").trim().toLowerCase() !== "false"
    && !/^https?:\/\//i.test(route);
  if (shouldProxy) return `${VITE_PROXY_PREFIX}/${route.replace(/^\/+/, "")}`;
  return route;
}

export function getHumanPhenotypeOntologyUrl(env = graphApiEnv()) {
  return graphApiUrl(getHumanPhenotypeOntologyPath(env), env);
}

export function getAllHumanPhenotypeOntology(signal, options = {}) {
  const env = options.env ?? graphApiEnv();
  if (!hasHumanPhenotypeOntologyApi(env)) {
    throw new Error("HPO API disabled: VITE_KG_ENABLE_HPO=false");
  }
  return fetchGraphApi(getHumanPhenotypeOntologyPath(env), signal, "hpoTerms", { ...options, env });
}
