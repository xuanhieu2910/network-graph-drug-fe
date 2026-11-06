/** KEGG Disease API; separate module, one FastAPI model per file. */
import { configuredGraphPath, fetchGraphApi, graphApiEnv, hasGraphPath } from "./graphApiClient.js";

const ENV_KEY = "VITE_KG_KEGG_DISEASE_API_PATH";
// Set the real route in .env after checking your FastAPI /docs.
export function hasKeggDiseaseApi(env = graphApiEnv()) {
  return hasGraphPath(ENV_KEY, env);
}

export function getAllKeggDisease(signal, options = {}) {
  const env = options.env ?? graphApiEnv();
  const path = configuredGraphPath(ENV_KEY, "", env);
  return fetchGraphApi(path, signal, "keggDiseases", { ...options, env });
}
