/**
 * Biomedical KG workflow data. Every edge is grounded in a validated input
 * relation; view transformations never infer or manufacture graph edges.
 *
 * - extractWorkflow: ALL reachable nodes from the selected root (no per-type
 *   caps, no per-parent slicing, no MAX_TOTAL and no truncation).
 * - extractAllNodesWorkflow: ALL typed nodes from the loaded KG, including
 *   isolated HPO/ADR catalog entries, displayed in ordered columns.
 */
export const WORKFLOW_TYPES = [
  'Drug','Protein','KeggGene','Pathway','Disease','HPO','ADR',
  'KeggDisease','KeggNetwork','KeggDrugTarget','KeggElement',
];
// Backward-compatible export consumed by previous components.
export const STEP_COLUMNS = {
  Drug:0, Protein:1, KeggGene:2, Pathway:3, Disease:4, HPO:5, ADR:6,
  KeggDisease:7, KeggNetwork:8, KeggDrugTarget:9, KeggElement:10,
};
export const EDGE_RULES = {
  DrugProtein: {from:'Drug',to:'Protein',name:'Drug targets protein',evidence:'reference'},
  ProteinGene: {from:'Protein',to:'KeggGene',name:'Protein–gene ID mapping',evidence:'reference'},
  GenePathway: {from:'KeggGene',to:'Pathway',name:'Gene participates in pathway',evidence:'reference'},
  GeneDisease: {from:'KeggGene',to:'Disease',name:'Gene–disease association',evidence:'association'},
  DiseaseHPO: {from:'Disease',to:'HPO',name:'Disease phenotype annotation',evidence:'annotation'},
  ADRHPO: {from:'HPO',to:'ADR',name:'ADR–HPO phenotype mapping',evidence:'similarity',reversed:true},
  DrugADR: {from:'Drug',to:'ADR',name:'Recorded drug–ADR association',evidence:'clinical'},
  GeneKeggDisease: {from:'KeggGene',to:'KeggDisease',name:'KEGG gene–disease',evidence:'reference'},
  GeneKeggNetwork: {from:'KeggGene',to:'KeggNetwork',name:'KEGG gene–network',evidence:'reference'},
  GeneKeggDrugTarget: {from:'KeggGene',to:'KeggDrugTarget',name:'KEGG gene–drug target',evidence:'reference'},
  GeneKeggElement: {from:'KeggGene',to:'KeggElement',name:'KEGG gene–element',evidence:'reference'},
};
const compareText=(a,b)=>String(a).localeCompare(String(b));

/** Validates both endpoints and puts ADRHPO in the reading direction HPO → ADR. */
export function makeWorkflowIndex(data) {
  const nodes=new Map((data?.nodes??[]).filter(n=>n?.id&&WORKFLOW_TYPES.includes(n.type)).map(n=>[n.id,n]));
  const out=new Map(), incoming=new Map(), edges=[];
  for(const edge of data?.edges??[]) {
    const rule=EDGE_RULES[edge.type];
    if(!rule)continue;
    const from=rule.reversed?edge.target:edge.source;
    const to=rule.reversed?edge.source:edge.target;
    if(nodes.get(from)?.type!==rule.from || nodes.get(to)?.type!==rule.to)continue;
    const real={...edge,source:from,target:to,evidence:rule.evidence,relationLabel:rule.name};
    edges.push(real);
    if(!out.has(from))out.set(from,[]);
    if(!incoming.has(to))incoming.set(to,[]);
    out.get(from).push(real);
    incoming.get(to).push(real);
  }
  const byTarget=(a,b)=>compareText(nodes.get(a.target)?.label??a.target,nodes.get(b.target)?.label??b.target)||compareText(a.id,b.id);
  const bySource=(a,b)=>compareText(nodes.get(a.source)?.label??a.source,nodes.get(b.source)?.label??b.source)||compareText(a.id,b.id);
  for(const values of out.values())values.sort(byTarget);
  for(const values of incoming.values())values.sort(bySource);
  return {nodes,out,incoming,edges};
}

/** Number of nodes joined to the selected node using ACTUAL edges, without causal claims. */
function graphComponent(index,rootId) {
  if(!index.nodes.has(rootId))return new Set();
  const visited=new Set([rootId]), queue=[rootId];
  for(let i=0;i<queue.length;i++) {
    const id=queue[i];
    for(const e of [...(index.out.get(id)??[]),...(index.incoming.get(id)??[])]) {
      const other=e.source===id?e.target:e.source;
      if(!visited.has(other)){visited.add(other);queue.push(other);}
    }
  }
  return visited;
}

/** A complete phenotype route requires every real step in the same direction. */
function hasPhenotypeRoute(edges,rootId,rootType,nodes) {
  let current=new Set(rootType==='Drug'?[rootId]:[...nodes.values()].filter(n=>n.type==='Drug').map(n=>n.id));
  for(const type of ['DrugProtein','ProteinGene','GeneDisease','DiseaseHPO','ADRHPO']) {
    const next=new Set();
    for(const e of edges)if(e.type===type&&current.has(e.source))next.add(e.target);
    current=next;
    if(!current.size)return false;
  }
  return rootType==='Drug'?current.size>0:current.has(rootId);
}

function describe(index,root,chosen,scope) {
  const selected=new Set(chosen);
  const nodes=[...selected].map(id=>index.nodes.get(id)).filter(Boolean);
  const edges=index.edges.filter(e=>selected.has(e.source)&&selected.has(e.target));
  const component=graphComponent(index,root.id);
  const connectedNodeCount=nodes.filter(n=>component.has(n.id)).length;
  const localEvidence=!['Drug','ADR'].includes(root.type);
  return {
    rootId:root.id,rootType:root.type,nodes,edges,
    scope,allCatalog:scope==='all',localEvidence,
    connectedNodeCount,disconnectedNodeCount:nodes.length-connectedNodeCount,
    truncated:false,completeMechanism:localEvidence?false:hasPhenotypeRoute(edges,root.id,root.type,index.nodes),
    hasPhenotypeMapping:edges.some(e=>e.type==='ADRHPO'),
    clinicalAssociations:edges.filter(e=>e.type==='DrugADR').length,
  };
}

/** Only real connected routes from the selected Drug/ADR; NO artificial caps. */
export function extractWorkflow(data,rootId) {
  const index=makeWorkflowIndex(data), root=index.nodes.get(rootId);
  if(!root)return {nodes:[],edges:[],rootId:null,rootType:null,scope:'related',truncated:false,completeMechanism:false};
  const local=!['Drug','ADR'].includes(root.type);
  const forward=root.type!=='ADR';
  const chosen=new Set([root.id]),queue=[root.id];
  for(let i=0;i<queue.length;i++){
    const id=queue[i];
    // For local evidence (Disease/HPO/Gene/etc), traverse the genuine connected
    // component in both directions. Drug routes follow directed relations only.
    const adjacent=local?[...(index.out.get(id)??[]),...(index.incoming.get(id)??[])]:
      (forward?index.out.get(id)??[]:index.incoming.get(id)??[]);
    for(const edge of adjacent){
      const other=local?(edge.source===id?edge.target:edge.source):
        (forward?edge.target:edge.source);
      if(!chosen.has(other)){chosen.add(other);queue.push(other);}
    }
  }
  // For reverse ADR tracing, show available Gene→Pathway side branches.
  if(root.type==='ADR')for(const id of [...chosen]){
    if(index.nodes.get(id)?.type!=='KeggGene')continue;
    for(const edge of index.out.get(id)??[])
      if(['GenePathway','GeneKeggDisease','GeneKeggNetwork','GeneKeggDrugTarget','GeneKeggElement'].includes(edge.type))chosen.add(edge.target);
  }
  return describe(index,root,chosen,'related');
}

/** ALL canonical KG nodes, including isolated catalog nodes (e.g. 612 HPOs). */
export function extractAllNodesWorkflow(data,rootId) {
  const index=makeWorkflowIndex(data);
  const root=index.nodes.get(rootId)??[...index.nodes.values()].find(n=>n.type==='Drug')??index.nodes.values().next().value;
  if(!root)return {nodes:[],edges:[],rootId:null,rootType:null,scope:'all',allCatalog:true,truncated:false,completeMechanism:false};
  return describe(index,root,index.nodes.keys(),'all');
}

/** Identical visibility semantics to Sigma: hide incident edges, never shortcut. */
export function filterWorkflowByTypes(workflow,allowedTypes) {
  if(allowedTypes==null)return workflow;
  const allowed=new Set(allowedTypes);
  const visibleNodes=workflow.nodes.filter(n=>allowed.has(n.type));
  const ids=new Set(visibleNodes.map(n=>n.id));
  const visibleEdges=workflow.edges.filter(e=>ids.has(e.source)&&ids.has(e.target));
  const rootHidden=Boolean(workflow.rootId)&&!ids.has(workflow.rootId);
  // A component count in the filtered graph (not the original graph).
  const adjacency=new Map();
  for(const e of visibleEdges){
    if(!adjacency.has(e.source))adjacency.set(e.source,[]);
    if(!adjacency.has(e.target))adjacency.set(e.target,[]);
    adjacency.get(e.source).push(e.target);adjacency.get(e.target).push(e.source);
  }
  const linked=new Set(rootHidden?[]:[workflow.rootId]),queue=[...linked];
  for(let i=0;i<queue.length;i++)for(const id of adjacency.get(queue[i])??[])
    if(!linked.has(id)){linked.add(id);queue.push(id);}
  const byId=new Map(visibleNodes.map(n=>[n.id,n]));
  return {
    ...workflow,nodes:visibleNodes,edges:visibleEdges,rootHidden,
    connectedNodeCount:linked.size,
    disconnectedNodeCount:visibleNodes.length-linked.size,
    hiddenNodeCount:workflow.nodes.length-visibleNodes.length,
    hiddenEdgeCount:workflow.edges.length-visibleEdges.length,
    completeMechanism:!rootHidden&&!workflow.localEvidence&&hasPhenotypeRoute(visibleEdges,workflow.rootId,workflow.rootType,byId),
    hasPhenotypeMapping:visibleEdges.some(e=>e.type==='ADRHPO'),
    clinicalAssociations:visibleEdges.filter(e=>e.type==='DrugADR').length,
  };
}
