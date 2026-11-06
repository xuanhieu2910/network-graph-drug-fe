import { getJson } from "./client";

const API_PREFIX = "/pathway";

export function getAllPathway(options = {}) {
  return getJson(`${API_PREFIX}/find_all`, options);
}

export function findPathwayDetailByPathwayId(pathway_id, options = {}) {
  return getJson(
    `${API_PREFIX}/details/${encodeURIComponent(pathway_id)}`,
    options
  );
}