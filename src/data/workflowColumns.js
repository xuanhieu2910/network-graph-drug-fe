/**
 * Deterministic ordered lanes for the entire KG.
 * Positions are calculated once, but the canvas only mounts nodes visible in
 * the current viewport (see workflowViewport.js). No KG records are removed.
 */
export const COLUMN_INDEX=Object.freeze({
  Drug:0,Protein:1,KeggGene:2,Pathway:3,Disease:4,HPO:5,ADR:6,
  KeggDisease:7,KeggNetwork:8,KeggDrugTarget:9,KeggElement:10,
});
export const COLUMN_META=Object.freeze({
  0:'THUỐC',1:'PROTEIN',2:'KEGG GENE',3:'PATHWAY',4:'MONDO DISEASE',
  5:'HPO PHENOTYPE',6:'ADR (MEDDRA)',7:'KEGG DISEASE',
  8:'KEGG NETWORK',9:'KEGG DRUG TARGET',10:'KEGG ELEMENT',
});
export const COLUMN_WIDTH=178;
export const COLUMN_HEIGHT=114;
export const COLUMN_X_SPACING=284;
export const COLUMN_ROW_SPACING=146;
export const FIRST_Y=100;
const compare=(a,b)=>String(a).localeCompare(String(b));
const byName=(a,b)=>compare(a.label??a.id,b.label??b.id)||compare(a.id,b.id);

function distancesFromRoot(ids, adjacent, rootId) {
  const distances=new Map(),queue=[];
  if(ids.has(rootId)){distances.set(rootId,0);queue.push(rootId);}
  for(let i=0;i<queue.length;i++){
    const nextDistance=distances.get(queue[i])+1;
    for(const id of adjacent.get(queue[i])??[]){
      if(!distances.has(id)){distances.set(id,nextDistance);queue.push(id);}
    }
  }
  return distances;
}

export function layoutWorkflowColumns(nodes=[],edges=[],rootId=null,options={}) {
  // In HPO Focus keep HPO at x=0, with Disease on its left and ADR on its right.
  // The full-graph Workflow continues to use the original column coordinates.
  const anchorIndex=options.anchorType==='HPO'?COLUMN_INDEX.HPO:0;
  const unique=new Map(),groups=new Map(),incoming=new Map(),adjacent=new Map();
  for(const n of nodes){
    if(!n?.id || !Object.hasOwn(COLUMN_INDEX,n.type) || unique.has(n.id))continue;
    unique.set(n.id,n);
    if(!groups.has(n.type))groups.set(n.type,[]);
    groups.get(n.type).push(n);
  }
  const ids=new Set(unique.keys());
  // One edge pass instead of scanning every relation for every type/column.
  for(const e of edges){
    const src=unique.get(e.source),dst=unique.get(e.target);
    if(!src||!dst)continue;
    if(!adjacent.has(e.source))adjacent.set(e.source,[]);
    if(!adjacent.has(e.target))adjacent.set(e.target,[]);
    adjacent.get(e.source).push(e.target);
    adjacent.get(e.target).push(e.source);
    if(COLUMN_INDEX[src.type]<COLUMN_INDEX[dst.type]){
      if(!incoming.has(e.target))incoming.set(e.target,[]);
      incoming.get(e.target).push(e.source);
    }
  }
  const distances=distancesFromRoot(ids,adjacent,rootId);
  const parentOrder=new Map(),order=new Map();
  const positions=new Map(),columns=[],rowsByColumn=new Map();
  for(const [type,col] of Object.entries(COLUMN_INDEX)){
    const inColumn=groups.get(type);
    if(!inColumn?.length)continue;
    const averageParent=id=>{
      if(parentOrder.has(id))return parentOrder.get(id);
      const values=(incoming.get(id)??[]).map(x=>order.get(x)).filter(Number.isFinite);
      const result=values.length?values.reduce((s,n)=>s+n,0)/values.length:Infinity;
      parentOrder.set(id,result);
      return result;
    };
    inColumn.sort((a,b)=>{
      const ac=distances.has(a.id)?0:1,bc=distances.has(b.id)?0:1;
      if(ac!==bc)return ac-bc;
      if(a.id===rootId)return -1;
      if(b.id===rootId)return 1;
      const pa=averageParent(a.id),pb=averageParent(b.id);
      if(pa!==pb)return pa-pb;
      const da=distances.get(a.id)??Infinity,db=distances.get(b.id)??Infinity;
      return da-db||byName(a,b);
    });
    for(let i=0;i<inColumn.length;i++){
      const n=inColumn[i];order.set(n.id,i);
      positions.set(n.id,{x:(col-anchorIndex)*COLUMN_X_SPACING,y:FIRST_Y+i*COLUMN_ROW_SPACING});
    }
    rowsByColumn.set(col,inColumn);
    columns.push({index:col,title:COLUMN_META[col],x:(col-anchorIndex)*COLUMN_X_SPACING,
      types:[type],count:inColumn.length,
      connectedCount:inColumn.reduce((s,n)=>s+Number(distances.has(n.id)),0)});
  }
  return {positions,columns,rowsByColumn,nodeById:unique,visibleNodeCount:unique.size,distances};
}
