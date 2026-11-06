/** KEGG Network API; separate module, one FastAPI model per file. */
import { configuredGraphPath, fetchGraphApi, graphApiEnv, hasGraphPath } from "./graphApiClient.js";

const ENV_KEY = "VITE_KG_KEGG_NETWORK_API_PATH";
// Set the real route in .env after checking your FastAPI /docs.
export function hasKeggNetworkApi(env = graphApiEnv()) {
  return hasGraphPath(ENV_KEY, env);
}

export function getAllKeggNetwork(signal, options = {}) {
  const env = options.env ?? graphApiEnv();
  const path = configuredGraphPath(ENV_KEY, "", env);
  return fetchGraphApi(path, signal, "keggNetworks", { ...options, env });
}
