/** FastAPI gene–disease association; only edges from this API are rendered.
 * The gene (hsa) and disease (mondo_id) endpoints are checked in the mapper.
 */
import { configuredGraphPath, fetchGraphApi, graphApiEnv, graphApiUrl } from './graphApiClient.js';
export { hasGeneDiseaseApi } from '../data/sourceFlags.js';
import { hasGeneDiseaseApi } from '../data/sourceFlags.js';

const DEFAULT_PATH='/human_gene_disease/find_all';
export function getHumanGeneDiseasePath(env=graphApiEnv()) {
  const path=configuredGraphPath('VITE_KG_GENE_DISEASE_API_PATH',DEFAULT_PATH,env);
  const proxy=env?.DEV===true &&
    String(env?.VITE_KG_GENE_DISEASE_USE_PROXY ?? 'true').trim().toLowerCase()!=='false' &&
    !/^https?:\/\//i.test(path);
  return proxy ? `/__kg_backend/${path.replace(/^\/+/, '')}` : path;
}
export function getHumanGeneDiseaseUrl(env=graphApiEnv()) {
  return graphApiUrl(getHumanGeneDiseasePath(env),env);
}
export function getAllHumanGeneDisease(signal,options={}) {
  const env=options.env??graphApiEnv();
  if(!hasGeneDiseaseApi(env))throw new Error('Gene–Disease disabled by VITE_KG_ENABLE_GENE_DISEASE=false');
  return fetchGraphApi(getHumanGeneDiseasePath(env),signal,'geneDiseases',{...options,env});
}
