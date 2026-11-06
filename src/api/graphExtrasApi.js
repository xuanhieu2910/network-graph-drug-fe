/**
 * Additional model API sources for Sigma.js.
 * Confirmed ADR endpoints from the user's FastAPI Swagger screenshot:
 *   GET /adr_llt/find_all
 *   GET /drug_adr/find_all    (NOT /drug_adr_llt/find_all)
 *   GET /adr_hpo/find_all
 * Other optional endpoints remain configurable until their routes are supplied.
 */

const SOURCES = Object.freeze({
  hpoTerms: { envKey: "VITE_KG_HPO_API_PATH" },
  mondoPhenotypes: { envKey: "VITE_KG_MONDO_HPO_API_PATH" },
  keggDiseases: { envKey: "VITE_KG_KEGG_DISEASE_API_PATH" },
  keggNetworks: { envKey: "VITE_KG_KEGG_NETWORK_API_PATH" },
  keggDrugTargets: { envKey: "VITE_KG_KEGG_DRUG_TARGET_API_PATH" },
  keggElements: { envKey: "VITE_KG_KEGG_ELEMENT_API_PATH" },
  keggInformation: { envKey: "VITE_KG_KEGG_INFO_API_PATH" },
  proteinSequences: { envKey: "VITE_KG_PROTEIN_SEQUENCE_API_PATH" },
  adrLlts: { envKey: "VITE_KG_ADR_LLT_API_PATH", defaultPath: "/adr_llt/find_all" },
  drugAdrLlts: { envKey: "VITE_KG_DRUG_ADR_LLT_API_PATH", defaultPath: "/drug_adr/find_all" },
  adrHpo: { envKey: "VITE_KG_ADR_HPO_API_PATH", defaultPath: "/adr_hpo/find_all" },
});

export const OPTIONAL_API_NAMES = Object.freeze(Object.keys(SOURCES));
export const CONFIRMED_ADR_ENDPOINTS = Object.freeze({
  adrLlts: "/adr_llt/find_all",
  drugAdrLlts: "/drug_adr/find_all",
  adrHpo: "/adr_hpo/find_all",
});

/** Join an absolute or relative API path with a configurable backend origin. */
function makeUrl(path, backendBase) {
  const value = String(path).trim();
  if (/^https?:\/\//i.test(value)) return value;
  const base = String(backendBase).replace(/\/+$/, "");
  return `${base}${value.startsWith("/") ? "" : "/"}${value}`;
}

/**
 * Pure/testable factory. No endpoints other than the confirmed ADR routes are guessed.
 * VITE_API_BASE_URL is the actual FastAPI host (defaults to typical local Uvicorn
 * for development only; change if yours differs).
 */
export function createOptionalGraphApiSources(env = {}, fetchImpl = fetch) {
  const base = env.VITE_API_BASE_URL || env.VITE_BACKEND_URL || env.VITE_API_URL || "http://127.0.0.1:8000";
  const resolved = Object.entries(SOURCES).flatMap(([collection, config]) => {
    const path = String(env[config.envKey] || config.defaultPath || "").trim();
    if (!path) return [];
    const url = makeUrl(path, base);
    return [[collection, async signal => {
      let response;
      try {
        response = await fetchImpl(url, { signal, headers: { Accept: "application/json" } });
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        throw new Error(`${collection} (${url}): connection failed (${error?.message || error}). Check FastAPI origin, server and CORS.`);
      }
      if (!response.ok) throw new Error(`${collection}: HTTP ${response.status} ${response.statusText ?? ""} (${url})`);
      const contentType = response.headers?.get?.("content-type") || "";
      if (contentType && !/\bjson\b|\+json/i.test(contentType)) {
        throw new Error(`${collection}: expected JSON, received ${contentType} from ${url}. Check Vite proxy / backend origin.`);
      }
      try {
        return await response.json();
      } catch (error) {
        throw new Error(`${collection}: invalid JSON from ${url}: ${error?.message || error}`);
      }
    }]];
  });
  return resolved;
}

/** Default wiring used by the graph loader inside Vite. */
export function optionalGraphApiSources() {
  return createOptionalGraphApiSources(import.meta.env ?? {});
}
