/** Gene–Disease association source; verified Swagger endpoint now enabled by default.
 * VITE_KG_ENABLE_GENE_DISEASE=false still provides an explicit opt-out.
 */
export function hasGeneDiseaseApi(env = import.meta.env ?? {}) {
  return String(env?.VITE_KG_ENABLE_GENE_DISEASE ?? 'true').trim().toLowerCase() !== 'false';
}
