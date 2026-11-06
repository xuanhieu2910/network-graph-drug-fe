import { getJson } from "./client";

const API_PREFIX = "/disease_human";

// Lấy danh sách Drug - Protein
export function getAllDiseaseHuman(options = {}) {
  return getJson(
    `${API_PREFIX}/find_all`,
    options
  );
}


export function getDieaseHumanCode(
  mondoCode,
  options = {}
) {
  const params = new URLSearchParams({
    mondo_code: mondoCode,
  });

  return getJson(
    `${API_PREFIX}/details?${params.toString()}`,
    options
  );
}