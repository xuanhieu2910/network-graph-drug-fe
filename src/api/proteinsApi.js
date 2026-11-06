import { getJson } from "./client";

const API_PREFIX = "/proteins";

export function getAllProteins(options = {}) {
  return getJson(`${API_PREFIX}/find_all`, options);
}

export function getProteinByCode(code, options = {}) {
  return getJson(
    `${API_PREFIX}/details/${encodeURIComponent(code)}`,
    options
  );
}