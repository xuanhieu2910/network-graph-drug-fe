import { getJson } from "./client";

const API_PREFIX = "/kegg_gene";

export function getAllKeggGene(options = {}) {
  return getJson(`${API_PREFIX}/find_all`, options);
}

export function findKeggGeneByCodeHsa(hsa_code, options = {}) {
  return getJson(
    `${API_PREFIX}/details/${encodeURIComponent(hsa_code)}`,
    options
  );
}