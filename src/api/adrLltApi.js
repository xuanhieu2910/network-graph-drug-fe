/** ADR LLT API; separate module, one FastAPI model per file. */
import { configuredGraphPath, fetchGraphApi, graphApiEnv } from "./graphApiClient.js";

const ENV_KEY = "VITE_KG_ADR_LLT_API_PATH";
const DEFAULT_PATH = "/adr_llt/find_all"; // confirmed in FastAPI Swagger
export function getAllAdrLlt(signal, options = {}) {
  const env = options.env ?? graphApiEnv();
  const path = configuredGraphPath(ENV_KEY, DEFAULT_PATH, env);
  return fetchGraphApi(path, signal, "adrLlts", { ...options, env });
}
