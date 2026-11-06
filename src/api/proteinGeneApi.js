import { getJson } from "./client";

const API_PREFIX = "/unit_protein_kegg_gene";

export function getAllUnitProteinKeggGene(options = {}) {
  return getJson(`${API_PREFIX}/find_all`, options);
}

export function findUnitProteinKeggGeneByCodeProtein(protein_code, options = {}) {
   const params = new URLSearchParams({
      protein_code: protein_code
    });
  
    return getJson(
      `${API_PREFIX}/details?${params.toString()}`,
      options
    );
}