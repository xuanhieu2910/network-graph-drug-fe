import { getJson } from "./client";

const API_PREFIX = "/drug_protein";

// Lấy danh sách Drug - Protein
export function getAllDrugProteins(options = {}) {
  return getJson(
    `${API_PREFIX}/find_all`,
    options
  );
}

// Tìm theo Drug Code và Protein Code
export function getDrugProteinByCode(
  drugCode,
  proteinCode,
  options = {}
) {
  const params = new URLSearchParams({
    drugcode: drugCode,
    proteincode: proteinCode,
  });

  return getJson(
    `${API_PREFIX}/details?${params.toString()}`,
    options
  );
}