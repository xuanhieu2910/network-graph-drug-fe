/**
 * Data mapper grounded in the 20 uploaded Python models.
 * Node sources and relation sources are distinct unless a relation model itself
 * supplies the complete target entity (e.g. KeggNetwork.network_id + name).
 * No biological relation is invented and KEGG Disease is not MONDO Disease.
 */
import { NODE_COLORS, GRAPH_NODE_TYPES } from "../config/graphConfig.js";

const NODE_MODELS = [
  { collection: "drugs", type: "Drug", prefix: "drug", id: "external_id", label: ["name", "external_id"] },
  { collection: "proteins", type: "Protein", prefix: "protein", id: "unit_protein_id", label: ["name", "unit_protein_id"] },
  { collection: "genes", type: "KeggGene", prefix: "gene", id: "kegg_hsa", label: ["kegg_symbol", "kegg_name", "kegg_hsa"] },
  { collection: "pathways", type: "Pathway", prefix: "pathway", id: "pathway_id", label: ["pathway_name", "pathway_id"] },
  { collection: "diseases", type: "Disease", prefix: "mondo", id: "mondo_id", label: ["disease_name", "mondo_id"] },
  { collection: "hpoTerms", type: "HPO", prefix: "hpo", id: "hpo_id", label: ["hpo_name", "hpo_id"] },
  { collection: "adrLlts", type: "ADR", prefix: "adr", id: "adr_umls_cui", label: ["adr_name", "adr_umls_cui"] },
];

const EDGE_MODELS = [
  { collection: "drugProteins", type: "DrugProtein", from: "Drug", to: "Protein", source: "drug_bank_id", target: "unit_protein_id" },
  { collection: "proteinGenes", type: "ProteinGene", from: "Protein", to: "KeggGene", source: "uniprot_id", target: "kegg_gene" },
  { collection: "genePathways", type: "GenePathway", from: "KeggGene", to: "Pathway", source: "kegg_hsa", target: "pathway_id" },
  { collection: "geneDiseases", type: "GeneDisease", from: "KeggGene", to: "Disease", source: "hsa", target: "mondo_id" },
  { collection: "mondoPhenotypes", type: "DiseaseHPO", from: "Disease", to: "HPO", source: "mondo_id", target: "hpo_id" },
  { collection: "drugAdrLlts", type: "DrugADR", from: "Drug", to: "ADR", source: "drug_bank_id", target: "adr_umls_cui" },
  { collection: "adrHpo", type: "ADRHPO", from: "ADR", to: "HPO", source: "adr_umls_cui", target: "hpo_id" },
  { collection: "keggDiseases", type: "GeneKeggDisease", from: "KeggGene", to: "KeggDisease", source: "kegg_hsa", target: "disease_id" },
  { collection: "keggNetworks", type: "GeneKeggNetwork", from: "KeggGene", to: "KeggNetwork", source: "kegg_hsa", target: "network_id" },
  { collection: "keggDrugTargets", type: "GeneKeggDrugTarget", from: "KeggGene", to: "KeggDrugTarget", source: "kegg_hsa", target: "drug_target_id" },
  { collection: "keggElements", type: "GeneKeggElement", from: "KeggGene", to: "KeggElement", source: "kegg_hsa", target: "element_id" },
];

// These models encode an edge AND its target KEGG entity (id and name).
const KEGG_ENTITY_MODELS = [
  { collection: "keggDiseases", type: "KeggDisease", prefix: "keggdisease", id: "disease_id", label: "disease_name" },
  { collection: "keggNetworks", type: "KeggNetwork", prefix: "keggnetwork", id: "network_id", label: "network_name" },
  { collection: "keggDrugTargets", type: "KeggDrugTarget", prefix: "keggdrugtarget", id: "drug_target_id", label: "drug_target_name" },
  { collection: "keggElements", type: "KeggElement", prefix: "keggelement", id: "element_id", label: "element_name" },
];

export function toArray(input) {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== "object") return [];
  for (const key of ["data", "results", "items", "rows", "records", "content", "payload", "result"]) {
    if (!(key in input)) continue;
    const nested = toArray(input[key]);
    if (Array.isArray(input[key]) || nested.length) return nested;
  }
  const arrays = Object.values(input).filter(Array.isArray);
  if (arrays.length === 1) return arrays[0];
  return [];
}

const isRow = v => !!v && typeof v === "object" && !Array.isArray(v);
const val = (row, field) => {
  const v = row?.[field];
  if (v === undefined || v === null) return null;
  if (typeof v === "object") return null;
  const s = String(v).trim();
  return s ? s : null;
};
const first = (row, fields) => fields.map(field => val(row, field)).find(Boolean) ?? null;
const norm = s => String(s).trim().toLowerCase();

/** Canonical type-specific alias resolution: hsa:1956 ↔ 1956, UniProtKB:P00533 ↔ P00533. */
function aliases(value, type) {
  const v = norm(value);
  const out = new Set([v]);
  if (type === "ADR") {
    // Only UMLS CUI prefixes are equivalent here. Do not equate MedDRA codes or terms.
    if (/^umls:c\d+$/.test(v)) out.add(v.slice(5));
    else if (/^c\d+$/.test(v)) out.add(`umls:${v}`);
  }
  if (type === "KeggGene") {
    if (/^hsa:\d+$/.test(v)) out.add(v.slice(4));
    else if (/^\d+$/.test(v)) out.add(`hsa:${v}`);
  }
  if (type === "Protein") {
    if (/^(uniprotkb:|uniprot:)/.test(v)) out.add(v.replace(/^(uniprotkb:|uniprot:)/, ""));
    else out.add(`uniprotkb:${v}`);
  }
  if (type === "Pathway") {
    if (/^path:hsa\d+$/.test(v)) out.add(v.slice(5));
    else if (/^hsa\d+$/.test(v)) out.add(`path:${v}`);
  }
  if (type === "HPO") {
    const match = /^hp[_:](\d+)$/i.exec(v);
    const digits = match ? match[1] : /^\d{1,7}$/.test(v) ? v : null;
    if (digits !== null) {
      const padded = digits.padStart(7,"0");
      out.add(`hp:${padded}`); out.add(`hp_${padded}`);
      out.add(padded);
      out.add(String(Number(padded)));
    }
  }
  if (type === "Disease" && /^mondo[_:]\d+$/.test(v)) {
    const code = v.slice(6).padStart(7,'0');
    out.add(`mondo:${code}`); out.add(`mondo_${code}`);
    out.add(`mondo:${String(Number(code))}`);
  }
  return out;
}

function canonical(type, value) {
  const v=String(value).trim();
  if (type==="KeggGene" && /^(?:hsa:)?\d+$/i.test(v)) return `hsa:${v.replace(/^hsa:/i, "")}`;
  if (type==="Protein" && /^(uniprotkb:|uniprot:)/i.test(v)) return v.replace(/^(uniprotkb:|uniprot:)/i, "").toUpperCase();
  if (type==="Pathway" && /^hsa\d+$/i.test(v)) return `path:${v.toLowerCase()}`;
  if (type==="Pathway" && /^path:hsa\d+$/i.test(v)) return v.toLowerCase();
  if (type==="Drug" && /^db\d+$/i.test(v)) return v.toUpperCase();
  if (type==="ADR" && /^(?:umls:)?c\d+$/i.test(v)) return v.replace(/^umls:/i, "").toUpperCase();
  if (type==="Disease" && /^mondo[_:]\d+$/i.test(v)) return `MONDO:${v.slice(6).padStart(7,'0')}`;
  if (type==="HPO" && /^hp[_:]\d+$/i.test(v)) return `HP:${v.slice(3).padStart(7,"0")}`;
  if (type==="HPO" && /^\d{1,7}$/.test(v)) return `HP:${v.padStart(7,"0")}`;
  return v;
}

/** Normalize real HPO API schemas without treating a database row number
 *  as an ontology identifier. Only explicit HP fields accept numeric codes.
 */
/**
 * Only the /adr_llt catalog may define ADR nodes. Relationship tables contain
 * foreign keys, not LLT entities. The current graph is keyed by UMLS CUI;
 * do not treat a UMLS CUI count as a count of distinct MedDRA LLT codes.
 * Explicit non-LLT rows are rejected. Missing level is retained because the
 * dedicated adr_llt endpoint may not serialize the level column.
 */
export function normalizeAdrLlt(row) {
  if (!isRow(row)) return { row: null, reason: 'schema' };
  const code = first(row,['adr_umls_cui','umls_cui','adrUmlsCui']);
  if (!code || !/^(?:UMLS:)?C\d+$/i.test(code)) return { row: null, reason: 'schema' };
  const level = first(row,['meddra_level','meddraLevel','meddra_hierarchy_level']);
  if (level && !/^(LLT|LOWEST[\s_-]*LEVEL[\s_-]*TERM)$/i.test(level))
    return { row: null, reason: 'level' };
  const name = first(row,['adr_name','adr_llt_name','llt_name','term_name']);
  return {
    row: {...row, adr_umls_cui: canonical('ADR',code), ...(name ? { adr_name: name } : {})},
    reason: level ? null : 'level_missing',
  };
}

export function normalizeHpoTerm(row) {
  if (!isRow(row)) return null;
  const keys = ["hpo_id","hp_id","hpo_term_id","hpoId","hpId","HPO_ID","HP_ID","HP","HPO"];
  const typedId = first(row,keys);
  const fallbackId = first(row,["identifier","term_id","id","ID"]);
  const code = typedId || (/^HP[:_]\d+$/i.test(fallbackId ?? "") ? fallbackId : null);
  if (!code || !/^(?:HP[:_])?\d+$/i.test(code)) return null;
  const name = first(row,["hpo_name","hp_name","hpo_term_name","term_name","name","label","Name","HPO_Name","description"]);
  return {...row,hpo_id:canonical("HPO",code),...(name?{hpo_name:name}:{})};
}

/** Normalize one REAL MONDO→HPO relation row; never derive one from shared names.
 * Numeric database record IDs are not accepted as MONDO IDs.
 * HPO numeric codes are allowed only when supplied in an explicit HP field.
 */
export function normalizeMondoHpoRelation(row) {
  if (!isRow(row)) return null;
  const rawMondo=first(row,["mondo_id","MONDO_ID","mondoId","disease_mondo_id","diseaseMondoId","disease_id"]);
  const rawHpo=first(row,["hpo_id","HPO_ID","hpoId","hp_id","HP_ID","hpId","hpo_term_id","phenotype_id"]);
  if (!rawMondo || !/^MONDO[:_]\d{1,7}$/i.test(rawMondo)) return null;
  if (!rawHpo || !/^(?:HP[:_])?\d{1,7}$/i.test(rawHpo)) return null;
  return {...row,mondo_id:canonical("Disease",rawMondo),hpo_id:canonical("HPO",rawHpo)};
}

function layoutConnectedComponents(nodes, edges) {
  if (!nodes.length) return;
  const byId = new Map(nodes.map((node, i) => [node.id, i]));
  const adj = Array.from({length: nodes.length}, () => new Set());
  for (const edge of edges) {
    const a = byId.get(edge.source), b = byId.get(edge.target);
    if (a === undefined || b === undefined) continue;
    adj[a].add(b); adj[b].add(a);
  }
  const visited = new Uint8Array(nodes.length), components = [];
  for (let i = 0; i < nodes.length; i++) {
    if (visited[i]) continue;
    const queue = [i]; visited[i] = 1;
    for (let p = 0; p < queue.length; p++) {
      for (const other of adj[queue[p]]) {
        if (!visited[other]) { visited[other] = 1; queue.push(other); }
      }
    }
    components.push(queue);
  }
  components.sort((a,b) => b.length - a.length);
  // A component uses radial BFS layers; isolated nodes go on a separate grid.
  const placed = [];
  const isolated = [];
  for (const component of components) {
    if (component.length === 1) { isolated.push(component[0]); continue; }
    const componentSet = new Set(component);
    const root = [...component].sort((a,b) => adj[b].size - adj[a].size || nodes[a].id.localeCompare(nodes[b].id))[0];
    const distances = new Map([[root,0]]), bfs=[root];
    for (let p=0; p<bfs.length; p++) {
      for (const target of adj[bfs[p]]) {
        if (!componentSet.has(target) || distances.has(target)) continue;
        distances.set(target, distances.get(bfs[p])+1); bfs.push(target);
      }
    }
    const rings = new Map();
    for (const i of component) {
      const depth = distances.get(i) ?? 0;
      if (!rings.has(depth)) rings.set(depth, []);
      rings.get(depth).push(i);
    }
    const radii = new Map([[0,0]]);
    let outer = 0;
    for (const depth of [...rings.keys()].sort((a,b) => a-b)) {
      if (depth === 0) continue;
      const count = rings.get(depth).length;
      outer = Math.max(outer + 38, Math.ceil(count*11/(2*Math.PI)));
      radii.set(depth, outer);
    }
    const pos = [];
    for (const [depth, bucket] of rings) {
      bucket.sort((a,b)=>nodes[a].type.localeCompare(nodes[b].type) || nodes[a].id.localeCompare(nodes[b].id));
      for (let index = 0; index < bucket.length; index++) {
        const theta = 2*Math.PI*index/bucket.length + (depth % 2)*0.11;
        const r = radii.get(depth) || 0;
        pos.push({i:bucket[index],x:r*Math.cos(theta),y:r*Math.sin(theta)});
      }
    }
    placed.push({pos, radius:outer+35});
  }
  // Shelf packing prevents multiple disconnected components piling up in one spot.
  const widest = Math.max(400, Math.sqrt(placed.reduce((a,c)=>a+Math.PI*(c.radius*2)**2,0))*1.3);
  let x=0,y=0,rowHeight=0;
  for (const c of placed) {
    const size = 2*c.radius + 50;
    if (x > 0 && x + size > widest) { x=0; y+=rowHeight; rowHeight=0; }
    const cx=x+c.radius, cy=y+c.radius;
    for (const p of c.pos) { nodes[p.i].x=cx+p.x; nodes[p.i].y=cy+p.y; }
    x+=size; rowHeight=Math.max(rowHeight,size);
  }
  const offsetY=y+rowHeight+65;
  const cols=Math.max(1, Math.ceil(Math.sqrt(isolated.length)));
  for (let index=0; index<isolated.length; index++) {
    nodes[isolated[index]].x=(index%cols)*21;
    nodes[isolated[index]].y=offsetY+Math.floor(index/cols)*21;
  }
}

export function buildGraphData(collections={}, apiErrors={}) {
  const nodes=[], edges=[], keyIndex=new Map(), nodeIndex=new Map(), seenEdges=new Set();
  const sources={}, missingExamples=[], errors=[], missingBySource={};
  const conflictingAliases=new Set();
  let duplicateNodeRows=0, duplicateEdgeRows=0, invalidNodes=0, invalidEdges=0, missingEdges=0;
  let malformedHpoCatalogRows=0;
  let invalidMondoHpoRelationRows=0;
  let malformedAdrCatalogRows=0, nonLltAdrCatalogRows=0, missingLevelAdrCatalogRows=0;
  const ensureStats=(name,kind)=>sources[name] ??= {kind,received:toArray(collections[name]).length,added:0};
  const addNode = (row, model, info={}) => {
    const rawKey=val(row, model.id);
    const key=rawKey && canonical(model.type,rawKey);
    if (!key) { invalidNodes++; return null; }
    const id=`${model.prefix}:${key}`;
    let node=nodeIndex.get(id);
    if (!node) {
      node={id,type:model.type,label:first(row,Array.isArray(model.label)?model.label:[model.label,model.id]) ?? key,
        color:NODE_COLORS[model.type],original:{...row},derivedFrom:info.derivedFrom??null};
      nodes.push(node); nodeIndex.set(id,node);
      return {node,added:true};
    }
    // Preserve additional model attributes, never override a known nonempty field.
    for (const [field,value] of Object.entries(row)) {
      if ((node.original[field] === null || node.original[field] === undefined || node.original[field] === "") && value != null) node.original[field]=value;
    }
    if (node.label===key && model.label) node.label=first(row,Array.isArray(model.label)?model.label:[model.label,model.id]) ?? key;
    return {node,added:false};
  };
  const indexAlias=(node,type,key)=>{
    for (const a of aliases(key,type)) {
      const ik=`${type}|${a}`;
      if (!keyIndex.has(ik)) keyIndex.set(ik,node.id);
      else if (keyIndex.get(ik) !== node.id) conflictingAliases.add(ik);
    }
  };
  const addAndIndex=(row,model,source,info={})=>{
    const result=addNode(row,model,info);
    if (!result) return;
    if (result.added) sources[source].added++; else duplicateNodeRows++;
    indexAlias(result.node,model.type,val(row,model.id));
    indexAlias(result.node,model.type,result.node.id.slice(model.prefix.length+1));
    if (model.type==="Drug") {
      for(const field of ["external_id","drugbank_id","drug_bank_id"])
        if (/^DB\d+$/i.test(val(row,field)??"")) indexAlias(result.node,"Drug",val(row,field));
    }
    if (model.type==="Protein") {
      // The ProteinGene API commonly references UniProt accessions, while the
      // protein entity's primary key is unit_protein_id. Only explicit UniProt fields
      // are aliased; arbitrary source_id strings are not assumed equivalent.
      for(const field of ["uniprot_id","uniprot_accession","uniprot_id_primary"])
        if (val(row,field)) indexAlias(result.node,"Protein",val(row,field));
    }
    return result.node;
  };
  // Primary entity models, exact schema keys.
  for (const model of NODE_MODELS) {
    const rows=toArray(collections[model.collection]); ensureStats(model.collection,"nodes");
    for (const row of rows) {
      if (!isRow(row)) {invalidNodes++; continue;}
      if (model.collection === "hpoTerms") {
        const normalized = normalizeHpoTerm(row);
        if (!normalized) {malformedHpoCatalogRows++;invalidNodes++;continue;}
        addAndIndex(normalized,model,model.collection);
      } else if (model.collection === "adrLlts") {
        const normalized = normalizeAdrLlt(row);
        if (!normalized.row) {
          if (normalized.reason === 'level') nonLltAdrCatalogRows++;
          else malformedAdrCatalogRows++;
          invalidNodes++;
          continue;
        }
        if (normalized.reason === 'level_missing') missingLevelAdrCatalogRows++;
        addAndIndex(normalized.row,model,model.collection);
      } else {
        addAndIndex(row,model,model.collection);
      }
    }
  }
  // KEGG information is an alternative gene representation / metadata enrichment.
  const infoRows=toArray(collections.keggInformation);
  ensureStats("keggInformation","enrichment");
  const geneModel=NODE_MODELS.find(m=>m.type==="KeggGene");
  for (const row of infoRows) {
    if (!isRow(row)) {invalidNodes++;continue;}
    const mapped={kegg_hsa:val(row,"hsa"), kegg_entry:val(row,"entry"), kegg_symbol:val(row,"symbol"),
      kegg_name:val(row,"name"),kegg_orthology:val(row,"orthology"),kegg_organism:val(row,"organism")};
    const result=addNode(mapped,geneModel,{derivedFrom:"KeggInformation"});
    if (!result) continue;
    indexAlias(result.node,"KeggGene",mapped.kegg_hsa);
    indexAlias(result.node,"KeggGene",result.node.id.slice(geneModel.prefix.length+1));
    if (result.added) sources.keggInformation.added++;
  }
  // Gene–Disease API explicitly carries MONDO identifiers. If an associated
  // MONDO code is not present in the disease catalog, retain an explicitly
  // marked ID-only reference so the real hsa -> MONDO edge is not discarded.
  // These are NOT counted as catalog-validated disease terms.
  const diseaseCatalogCount = nodes.filter(n=>n.type==='Disease').length;
  const diseaseModel=NODE_MODELS.find(m=>m.type==='Disease');
  let diseaseReferenceCount=0;
  const diseaseReferenceExamples=[];
  for(const row of toArray(collections.geneDiseases)) {
    if(!isRow(row)) continue;
    const gene=val(row,'hsa'), rawMondo=val(row,'mondo_id');
    if(!gene || !rawMondo || !/^MONDO[:_]\d{1,7}$/i.test(rawMondo)) continue;
    // Only reference MONDO when the source gene already exists in KEGG catalog.
    const hasGene=[...aliases(gene,'KeggGene')]
      .some(alias=>keyIndex.has(`KeggGene|${alias}`));
    if(!hasGene) continue;
    const mondo=canonical('Disease',rawMondo),id=`mondo:${mondo}`;
    if(nodeIndex.has(id)) continue;
    const result=addNode({mondo_id:mondo},diseaseModel,{derivedFrom:'geneDiseases'});
    if(!result)continue;
    result.node.referenceOnly=true;
    result.node.referenceSource='geneDiseases';
    indexAlias(result.node,'Disease',mondo);
    diseaseReferenceCount++;
    if(diseaseReferenceExamples.length<10)diseaseReferenceExamples.push(mondo);
  }
  // Relationship models with their own target identity are valid sources of KEGG entity nodes.
  for (const model of KEGG_ENTITY_MODELS) {
    const rows=toArray(collections[model.collection]);
    ensureStats(model.collection,"edges+target nodes");
    for (const row of rows) {
      if (!isRow(row)) continue;
      const result=addNode(row,model,{derivedFrom:model.collection});
      if (!result) continue;
      indexAlias(result.node,model.type,val(row,model.id));
    indexAlias(result.node,model.type,result.node.id.slice(model.prefix.length+1));
      if (result.added) sources[model.collection].added++;
    }
  }
  // STRICT ENTITY POLICY: /adr_llt/find_all is the ONLY source of ADR nodes.
  // adrHpo and drugAdrLlts provide foreign-key references, never new terms.
  // Similarly, only the dedicated HPO catalog creates HPO terms.
  // Missing endpoints remain unresolved and are reported in Diagnostics.
  const adrCatalogCount=nodes.filter(n=>n.type==="ADR").length;
  const adrCatalogValidRows=toArray(collections.adrLlts).length
    -malformedAdrCatalogRows-nonLltAdrCatalogRows;
  const adrCatalogDuplicateRows=Math.max(0,adrCatalogValidRows-adrCatalogCount);
  const unlistedAdrIds=new Set();
  const unlistedAdrByCollection={};
  for (const collection of ["adrHpo","drugAdrLlts"]) {
    const missing=new Set();
    for (const row of toArray(collections[collection])) {
      const raw=isRow(row) ? val(row,"adr_umls_cui") : null;
      if (!raw) continue;
      const code=canonical("ADR",raw);
      if (!nodeIndex.has(`adr:${code}`)) {
        missing.add(code);
        unlistedAdrIds.add(code);
      }
    }
    unlistedAdrByCollection[collection]=missing.size;
  }

  // ProteinSequence is metadata on Protein; link_record_from must match unit_protein_id.
  const seqRows=toArray(collections.proteinSequences);
  ensureStats("proteinSequences","enrichment");
  let unmatchedSequences=0;
  for (const row of seqRows) {
    if (!isRow(row)) continue;
    const link=val(row,"link_record_from");
    const proteinId=link && [...aliases(link,"Protein")].map(a=>keyIndex.get(`Protein|${a}`)).find(Boolean);
    if (!proteinId) {unmatchedSequences++;continue;}
    const node=nodeIndex.get(proteinId);
    if (!node.original.protein_sequences) node.original.protein_sequences=[];
    node.original.protein_sequences.push({...row});
    sources.proteinSequences.added++;
  }
  // Identify HPO codes referenced in edges but absent from the validated HPO
  // catalog. They do NOT enter nodes[] or the sidebar HPO total.
  const unlistedHpoIds=new Set();
  const unlistedHpoByCollection={};
  for (const collection of ["adrHpo","mondoPhenotypes"]) {
    const distinct=new Set();
    for (const row of toArray(collections[collection])) {
      const raw=collection === "mondoPhenotypes"
        ? normalizeMondoHpoRelation(row)?.hpo_id
        : (isRow(row) ? val(row,"hpo_id") : null);
      if (!raw) continue;
      const code=canonical("HPO",raw);
      if (!nodeIndex.has(`hpo:${code}`)) {
        distinct.add(code);
        unlistedHpoIds.add(code);
      }
    }
    unlistedHpoByCollection[collection]=distinct.size;
  }
  const hpoCatalogCount=nodes.filter(n=>n.type==="HPO").length;
  const hpoCatalogValidRows=toArray(collections.hpoTerms).length-malformedHpoCatalogRows;
  const hpoCatalogDuplicateRows=Math.max(0,hpoCatalogValidRows-hpoCatalogCount);
  const resolve=(type,key)=>{
    if (!key) return null;
    for (const alias of aliases(key,type)) {
      const key=`${type}|${alias}`;
      if (conflictingAliases.has(key)) continue;
      const candidate=keyIndex.get(key);
      if (candidate) return candidate;
    }
    return null;
  };
  for (const model of EDGE_MODELS) {
    const rows=toArray(collections[model.collection]);
    ensureStats(model.collection,"edges");
    // For models serving both entities + edges, count edges added separately.
    sources[model.collection].edgesAdded=0;
    for (const originalRow of rows) {
      if (!isRow(originalRow)) {invalidEdges++; if (model.collection==="mondoPhenotypes") invalidMondoHpoRelationRows++;continue;}
      const row=model.collection === "mondoPhenotypes" ? normalizeMondoHpoRelation(originalRow) : originalRow;
      if (!row) {invalidEdges++;invalidMondoHpoRelationRows++;continue;}
      const sourceKey=val(row,model.source),targetKey=val(row,model.target);
      if (!sourceKey || !targetKey) {invalidEdges++; continue;}
      const from=resolve(model.from,sourceKey),to=resolve(model.to,targetKey);
      if (!from || !to) {
        missingEdges++;
        missingBySource[model.collection]=(missingBySource[model.collection]??0)+1;
        if (missingExamples.length<40) missingExamples.push({collection:model.collection,
          sourceKey,targetKey,missing:!from&&!to?"both":!from?"source":"target",row});
        continue;
      }
      const relation=val(row,"association_type") ?? model.type;
      const ordered=Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)));
      const unique=JSON.stringify([model.type,from,to,ordered]);
      if (seenEdges.has(unique)) {duplicateEdgeRows++;continue;}
      seenEdges.add(unique);
      edges.push({id:`edge:${edges.length}`,type:model.type,source:from,target:to,relation,
        sourceCollection:model.collection, original:{...row}});
      sources[model.collection].edgesAdded++;
      if (sources[model.collection].kind==="edges") sources[model.collection].added++;
    }
  }
  layoutConnectedComponents(nodes,edges);
  for (const [name,message] of Object.entries(apiErrors)) errors.push(`${name}: ${message}`);
  return { nodes,edges,diagnostics:{
    typeCounts:Object.fromEntries(GRAPH_NODE_TYPES.map(t=>[t,nodes.filter(n=>n.type===t).length])),
    sources,apiErrors:errors,unmatchedSequences,idOnlyAdrNodes:0,idOnlyHpoNodes:0,malformedHpoCatalogRows,
    adrCatalogCount,adrCatalogValidRows,adrCatalogDuplicateRows,
    malformedAdrCatalogRows,nonLltAdrCatalogRows,missingLevelAdrCatalogRows,
    unlistedAdrReferenceCount:unlistedAdrIds.size,unlistedAdrByCollection,
    unlistedAdrExamples:[...unlistedAdrIds].slice(0,15),
    hpoCatalogCount,hpoCatalogValidRows,hpoCatalogDuplicateRows,
    invalidMondoHpoRelationRows,
    diseaseCatalogCount,diseaseReferenceCount,diseaseReferenceExamples,
    unlistedHpoReferenceCount:unlistedHpoIds.size,
    unlistedHpoByCollection,
    unlistedHpoExamples:[...unlistedHpoIds].slice(0,15),
    receivedNodes:NODE_MODELS.reduce((sum,s)=>sum+sources[s.collection].received,0)+infoRows.length,
    receivedEdges:EDGE_MODELS.reduce((sum,s)=>sum+sources[s.collection].received,0),
    renderedNodes:nodes.length,renderedEdges:edges.length,
    duplicateNodeRows,duplicateEdgeRows,invalidNodes,invalidEdges,missingEdges,missingExamples,missingBySource,
    conflictingAliases:conflictingAliases.size,
  }};
}
