/**
 * All 9 previously provided FastAPI wrappers are reused unchanged.
 * Each new model has its own file in src/api/. No graphExtrasApi.js is needed.
 */
import { getAllDrugSmiles } from "../api/drugsApi";
import { getAllProteins } from "../api/proteinsApi";
import { getAllDrugProteins } from "../api/drugProteinApi";
import { getAllKeggGene } from "../api/keggGeneApi";
import { getAllPathway } from "../api/pathwayApi";
import { getAllKeggGenePathway } from "../api/keggGenePathwayApi";
import { getAllUnitProteinKeggGene } from "../api/proteinGeneApi";
import { getAllDiseaseHuman } from "../api/diseaseHumanApi";
import { getAllHumanGeneDisease, getHumanGeneDiseaseUrl } from "../api/humanGeneDieaseApi.js";
import { getAllAdrLlt } from "../api/adrLltApi.js";
import { getAllDrugAdr } from "../api/drugAdrApi.js";
import { getAllAdrHpo } from "../api/adrHpoApi.js";
import { getAllHumanPhenotypeOntology, hasHumanPhenotypeOntologyApi, getHumanPhenotypeOntologyUrl } from "../api/humanPhenotypeOntologyApi.js";
import { getAllMondoHumanPhenotype, hasMondoHumanPhenotypeApi, getMondoHumanPhenotypeUrl } from "../api/mondoHumanPhenotypeApi.js";
import { getAllKeggDisease, hasKeggDiseaseApi } from "../api/keggDiseaseApi.js";
import { getAllKeggNetwork, hasKeggNetworkApi } from "../api/keggNetworkApi.js";
import { getAllKeggDrugTarget, hasKeggDrugTargetApi } from "../api/keggDrugTargetApi.js";
import { getAllKeggElement, hasKeggElementApi } from "../api/keggElementApi.js";
import { getAllKeggInformation, hasKeggInformationApi } from "../api/keggInformationApi.js";
import { getAllProteinSequence, hasProteinSequenceApi } from "../api/proteinSequenceApi.js";
import { toArray } from "./graphMapper.js";
import { graphApiEnv, configuredGraphPath, graphApiUrl } from "../api/graphApiClient.js";
import { hasGeneDiseaseApi } from "./sourceFlags.js";

export const sampleGraph = { nodes: [], edges: [] }; // old imports remain valid
const CORE_SOURCES = [
  ["drugs", getAllDrugSmiles],
  ["proteins", getAllProteins],
  ["drugProteins", getAllDrugProteins],
  ["genes", getAllKeggGene],
  ["pathways", getAllPathway],
  ["genePathways", getAllKeggGenePathway],
  ["proteinGenes", getAllUnitProteinKeggGene],
  ["diseases", getAllDiseaseHuman],
];
// Routes explicitly shown in the user's Swagger; always fetched.
const ADR_SOURCES = [
  ["adrLlts", getAllAdrLlt],
  ["drugAdrLlts", getAllDrugAdr],
  ["adrHpo", getAllAdrHpo],
];

// HPO catalog has a conventional default route and is fetched unless disabled.
// Other optional models require an explicit path; Gene–Disease remains opt-in.
// For HPO, a wrong route is reported as an API error rather than silently skipped.
const OPTIONAL_SOURCES = [
  // Do not import any Gene–Disease associations until explicitly enabled.
  ["geneDiseases", getAllHumanGeneDisease, hasGeneDiseaseApi],
  ["hpoTerms", getAllHumanPhenotypeOntology, hasHumanPhenotypeOntologyApi],
  ["mondoPhenotypes", getAllMondoHumanPhenotype, hasMondoHumanPhenotypeApi],
  ["keggDiseases", getAllKeggDisease, hasKeggDiseaseApi],
  ["keggNetworks", getAllKeggNetwork, hasKeggNetworkApi],
  ["keggDrugTargets", getAllKeggDrugTarget, hasKeggDrugTargetApi],
  ["keggElements", getAllKeggElement, hasKeggElementApi],
  ["keggInformation", getAllKeggInformation, hasKeggInformationApi],
  ["proteinSequences", getAllProteinSequence, hasProteinSequenceApi],
];

const abortError = () => new DOMException("Graph request cancelled", "AbortError");

function totalFromResponse(response) {
  const body = response?.data ?? response;
  for (const field of ["total", "totalCount", "total_count", "totalElements"]) {
    const number = Number(body?.[field]);
    if (Number.isFinite(number) && number >= 0) return number;
  }
  return null;
}

export async function loadGraph(signal, onProgress=()=>{}) {
  if (signal?.aborted) throw abortError();
  const enabledOptional = OPTIONAL_SOURCES.filter(([, , enabled]) => enabled());
  const sources = [
    ...CORE_SOURCES,
    ...ADR_SOURCES,
    ...enabledOptional.map(([name, api]) => [name, api]),
  ];
  const collections={},errors={},paginationWarnings=[];
  const adrLltRequestUrl = graphApiUrl(
    configuredGraphPath('VITE_KG_ADR_LLT_API_PATH','/adr_llt/find_all',graphApiEnv()), graphApiEnv()
  );
  const hpoRequestUrl = getHumanPhenotypeOntologyUrl(graphApiEnv());
  const geneDiseaseRequestUrl = getHumanGeneDiseaseUrl(graphApiEnv());
  const mondoHpoRequestUrl = getMondoHumanPhenotypeUrl(graphApiEnv());
  const sourceLoadStatus = Object.fromEntries(
    OPTIONAL_SOURCES.filter(([, , enabled]) => !enabled())
      .map(([name]) => [name, {status:"disabled",rows:0}])
  );
  sourceLoadStatus.geneDiseases = hasGeneDiseaseApi()
    ? { status: 'pending', rows: 0, url: geneDiseaseRequestUrl }
    : { status: 'disabled', rows: 0, url: geneDiseaseRequestUrl,
        message: 'VITE_KG_ENABLE_GENE_DISEASE=false — turn on to load hsa → MONDO' };
  sourceLoadStatus.hpoTerms = hasHumanPhenotypeOntologyApi()
    ? { status: "pending", rows: 0, url: hpoRequestUrl }
    : { status: "disabled", rows: 0, url: hpoRequestUrl, message: "VITE_KG_ENABLE_HPO=false" };
  sourceLoadStatus.mondoPhenotypes = hasMondoHumanPhenotypeApi()
    ? { status: "pending", rows: 0, url: mondoHpoRequestUrl }
    : { status: "disabled", rows: 0, url: mondoHpoRequestUrl, message: "VITE_KG_ENABLE_MONDO_HPO=false" };
  let completed=0;

  const jobs=sources.map(async ([name, api]) => {
    try {
      const payload=await api(signal);
      if (signal?.aborted) throw abortError();
      const rows=toArray(payload), total=totalFromResponse(payload);
      collections[name]=rows;
      sourceLoadStatus[name] = {
        status: "loaded", rows: rows.length, total,
        ...(name === "geneDiseases" ? {
          url: geneDiseaseRequestUrl,
          sampleKeys: rows[0] && typeof rows[0] === 'object' ? Object.keys(rows[0]).slice(0,16) : [],
        } : {}),
        ...(name === "adrLlts" ? {
          url: adrLltRequestUrl,
          sampleKeys: rows[0] && typeof rows[0] === 'object' ? Object.keys(rows[0]).slice(0,16) : [],
        } : {}),
        ...(name === "mondoPhenotypes" ? {
          url: mondoHpoRequestUrl,
          sampleKeys: rows[0] && typeof rows[0] === "object" ? Object.keys(rows[0]).slice(0,16) : [],
        } : {}),
        ...(name === "hpoTerms" ? {
          url: hpoRequestUrl,
          sampleKeys: rows[0] && typeof rows[0] === "object" ? Object.keys(rows[0]).slice(0,16) : [],
          responseType: Array.isArray(payload) ? "array" : typeof payload,
        } : {}),
      };
      if (name === 'adrLlts' && rows.length === 0) {
        sourceLoadStatus[name].status = 'empty';
        sourceLoadStatus[name].message = 'Dedicated adr_llt API returned 0 rows.';
      }
      if (name === 'geneDiseases' && rows.length === 0) {
        sourceLoadStatus[name].status = 'empty';
        sourceLoadStatus[name].message = 'Gene–Disease returned no association rows';
      }
      if (name === "mondoPhenotypes" && rows.length === 0) {
        sourceLoadStatus[name].status = "empty";
        sourceLoadStatus[name].message = "MONDO–HPO relation endpoint returned no rows; this does not mean HPO catalog is empty.";
      }
      if (name === "hpoTerms" && rows.length === 0) {
        sourceLoadStatus[name].status = "empty";
        sourceLoadStatus[name].message = "HTTP success, but no HPO rows could be extracted from JSON. Check response shape / API pagination.";
      }
      if (total !== null && total > rows.length) {
        paginationWarnings.push(`${name}: received ${rows.length}/${total} rows. API pagination must be handled for a complete network.`);
      }
    } catch (error) {
      if (signal?.aborted || error?.name==="AbortError") throw abortError();
      errors[name]=error?.message ?? String(error);
      sourceLoadStatus[name] = {status:"error",rows:0,message:errors[name],
        ...(name === "adrLlts" ? {url:adrLltRequestUrl} : {}),
        ...(name === "hpoTerms" ? {url:hpoRequestUrl} : {}),
        ...(name === "mondoPhenotypes" ? {url:mondoHpoRequestUrl} : {}),
        ...(name === 'geneDiseases' ? {url:geneDiseaseRequestUrl} : {})};
      collections[name]=[];
    } finally {
      completed++;
      if (!signal?.aborted) onProgress({phase:"loading",completed,total:sources.length,name});
    }
  });
  await Promise.allSettled(jobs);
  if (signal?.aborted) throw abortError();
  if (Object.keys(errors).length === sources.length) {
    throw new Error(`All ${sources.length} graph API sources failed. Check API base URL and endpoint definitions.`);
  }
  onProgress({phase:"building",completed,total:sources.length});

  const graph=await new Promise((resolve,reject)=>{
    const worker=new Worker(new URL("../workers/graphWorker.js",import.meta.url),{type:"module"});
    let done=false;
    const cleanup=()=>{ signal?.removeEventListener("abort",abort); worker.terminate(); };
    const finish=(fn,value)=>{if(done)return;done=true;cleanup();fn(value);};
    const abort=()=>finish(reject,abortError());
    signal?.addEventListener("abort",abort,{once:true});
    if(signal?.aborted){abort();return;}
    worker.onmessage=({data})=>data?.ok
      ? finish(resolve,data.graph)
      : finish(reject,new Error(data?.error ?? "Worker normalization failed"));
    worker.onerror=(event)=>finish(reject,new Error(`Graph Worker: ${event.message}`));
    try{worker.postMessage({collections,apiErrors:errors});}
    catch(error){finish(reject,error);}
  });
  graph.diagnostics.paginationWarnings=paginationWarnings;
  graph.diagnostics.sourceLoadStatus=sourceLoadStatus;
  const gdStatus=sourceLoadStatus.geneDiseases;
  if (gdStatus?.status === 'loaded') {
    gdStatus.mapped = graph.diagnostics.sources?.geneDiseases?.edgesAdded ?? 0;
    gdStatus.unresolved = graph.diagnostics.missingBySource?.geneDiseases ?? 0;
    gdStatus.references = graph.diagnostics.diseaseReferenceCount ?? 0;
    if (gdStatus.rows > 0 && gdStatus.mapped === 0) {
      gdStatus.status = 'no_join';
      gdStatus.message = `Fetched ${gdStatus.rows} associations, but none joined to loaded KEGG Gene + MONDO IDs. Check diagnostics for missing endpoints.`;
    }
  }
  const dhStatus=sourceLoadStatus.mondoPhenotypes;
  if (dhStatus?.status === "loaded") {
    dhStatus.mapped=graph.diagnostics.sources?.mondoPhenotypes?.edgesAdded ?? 0;
    dhStatus.unresolved=graph.diagnostics.missingBySource?.mondoPhenotypes ?? 0;
    dhStatus.invalidSchema=graph.diagnostics.invalidMondoHpoRelationRows ?? 0;
    if (dhStatus.rows > 0 && dhStatus.mapped === 0) {
      dhStatus.status=dhStatus.invalidSchema===dhStatus.rows ? "schema_error" : "no_join";
      dhStatus.message=dhStatus.status==="schema_error"
        ? `Fetched ${dhStatus.rows} rows but they lack valid mondo_id and hpo_id (or recognized aliases). See sampleKeys.`
        : `Fetched ${dhStatus.rows} rows, but 0 edges resolved to loaded MONDO + HPO catalogs. Missing endpoints: ${dhStatus.unresolved}; invalid rows: ${dhStatus.invalidSchema}.`;
    } else if (dhStatus.unresolved || dhStatus.invalidSchema) {
      dhStatus.message=`Mapped ${dhStatus.mapped}/${dhStatus.rows} rows; unresolved endpoints: ${dhStatus.unresolved}; invalid schema: ${dhStatus.invalidSchema}.`;
    }
  }
  const adrStatus=sourceLoadStatus.adrLlts;
  if (adrStatus?.status === 'loaded') {
    adrStatus.uniqueCuis=graph.diagnostics.adrCatalogCount??0;
    adrStatus.nonLltRows=graph.diagnostics.nonLltAdrCatalogRows??0;
    adrStatus.invalidRows=graph.diagnostics.malformedAdrCatalogRows??0;
    if (adrStatus.rows>0 && adrStatus.uniqueCuis===0) {
      adrStatus.status='schema_error';
      adrStatus.message=`Received ${adrStatus.rows} ADR rows but none was a valid LLT UMLS CUI. Check sampleKeys and meddra_level.`;
    }
  }
  // Successful HTTP with an unknown JSON schema must NOT look like an empty ontology.
  const hpoStatus=sourceLoadStatus.hpoTerms;
  if (hpoStatus?.status === "loaded" && hpoStatus.rows > 0 && (graph.diagnostics.hpoCatalogCount ?? 0) === 0) {
    hpoStatus.status = "schema_error";
    hpoStatus.message = `Fetched ${hpoStatus.rows} HPO rows, but none has a recognized hpo_id/HP ID. Check actual response keys.`;
  }
  if (hpoStatus?.status === "loaded" && (graph.diagnostics.malformedHpoCatalogRows ?? 0) > 0) {
    hpoStatus.message = `${graph.diagnostics.malformedHpoCatalogRows} HPO rows did not match the expected schema.`;
  }
  graph.diagnostics.notConfiguredModels = OPTIONAL_SOURCES
    .filter(([, , enabled]) => !enabled())
    .map(([name]) => name);
  return graph;
}
