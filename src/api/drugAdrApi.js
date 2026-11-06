/** Drug ADR API; separate module, one FastAPI model per file. */
import { configuredGraphPath, fetchGraphApi, graphApiEnv } from "./graphApiClient.js";

const ENV_KEY = "VITE_KG_DRUG_ADR_LLT_API_PATH";
const DEFAULT_PATH = "/drug_adr/find_all"; // confirmed in FastAPI Swagger
export function getAllDrugAdr(signal, options = {}) {
  const env = options.env ?? graphApiEnv();
  const path = configuredGraphPath(ENV_KEY, DEFAULT_PATH, env);
  return fetchGraphApi(path, signal, "drugAdrLlts", { ...options, env });
}
