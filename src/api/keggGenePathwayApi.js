import { getJson } from "./client";

const API_PREFIX = "/kegg_gene_pathway";

export function getAllKeggGenePathway(options = {}) {
  return getJson(`${API_PREFIX}/find_all`, options);
}

export function findKeggGenePathwayByHsaCodeAndPathwayId(hsa_code, pathway_id, options = {}) {
   const params = new URLSearchParams({
      hsa_code: hsa_code,
      pathway_id: pathway_id,
    });
  
    return getJson(
      `${API_PREFIX}/details?${params.toString()}`,
      options
    );
}