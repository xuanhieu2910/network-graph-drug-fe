import { getJson } from "./client";

export function getAllDrugSmiles(options = {}) {
  return getJson("/drug_smiles/find_all", options);
}

export function getDrugSmilesById(externalId, options = {}) {
  return getJson(
    `/drug_smiles/details/${encodeURIComponent(externalId)}`,
    options
  );
}