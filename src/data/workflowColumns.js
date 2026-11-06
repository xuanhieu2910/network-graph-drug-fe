/**
 * Every TYPE gets a separate, ordered lane, with EVERY supplied node rendered
 * exactly once. No 4-column cap, no rows discarded, no fabricated edges.
 * Connectivity to the selected root influences ordering, but never creates
 * new biomedical relationships.
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
const FIRST_Y=100;
const compare=(a,b)=>String(a).localeCompare(String(b));
const byName=(a,b)=>compare(a.label??a.id,b.label??b.id)||compare(a.id,b.id);

function distancesFromRoot(ids,edges,rootId) {
  const adjacent=new Map([...ids].map(id=>[id,[]]));
  for(const e of edges){
    if(!adjacent.has(e.source)||!adjacent.has(e.target))continue;
    adjacent.get(e.source).push(e.target);
    adjacent.get(e.target).push(e.source);
  }
  const distances=new Map(),queue=[];
  if(adjacent.has(rootId)){distances.set(rootId,0);queue.push(rootId);}
  for(let i=0;i<queue.length;i++)for(const id of adjacent.get(queue[i]))
    if(!distances.has(id)){distances.set(id,distances.get(queue[i])+1);queue.push(id);}
  return distances;
}

/** Deterministic y sorting: connected entities first, then unlinked catalog entries. */
export function layoutWorkflowColumns(nodes=[],edges=[],rootId=null) {
  const unique=new Map();
  for(const n of nodes)if(n?.id&&Object.hasOwn(COLUMN_INDEX,n.type)&&!unique.has(n.id))unique.set(n.id,n);
  const valid=[...unique.values()], ids=new Set(unique.keys());
  const distances=distancesFromRoot(ids,edges,rootId);
  const parentOrder=new Map();
  const order=new Map();
  const positions=new Map(),columns=[];
  for(const [type,col] of Object.entries(COLUMN_INDEX).sort((a,b)=>a[1]-b[1])){
    const inColumn=valid.filter(n=>n.type===type);
    if(!inColumn.length)continue;
    const incoming=new Map();
    for(const e of edges){
      const src=unique.get(e.source),dst=unique.get(e.target);
      if(!src||!dst||dst.type!==type||COLUMN_INDEX[src.type]>=col)continue;
      if(!incoming.has(dst.id))incoming.set(dst.id,[]);
      incoming.get(dst.id).push(src.id);
    }
    const averageParent=(id)=>{
      if(parentOrder.has(id))return parentOrder.get(id);
      const values=(incoming.get(id)??[]).map(x=>order.get(x)).filter(Number.isFinite);
      const result=values.length?values.reduce((s,n)=>s+n,0)/values.length:Infinity;
      parentOrder.set(id,result);return result;
    };
    inColumn.sort((a,b)=>{
      // All nodes directly/indirectly related to root appear above isolated ones.
      const ac=distances.has(a.id)?0:1,bc=distances.has(b.id)?0:1;
      if(ac!==bc)return ac-bc;
      if(a.id===rootId)return -1;
      if(b.id===rootId)return 1;
      const pa=averageParent(a.id),pb=averageParent(b.id);
      if(pa!==pb)return pa-pb;
      const da=distances.get(a.id)??Infinity,db=distances.get(b.id)??Infinity;
      if(da!==db)return da-db;
      return byName(a,b);
    });
    for(let i=0;i<inColumn.length;i++){
      const n=inColumn[i];order.set(n.id,i);
      positions.set(n.id,{x:col*COLUMN_X_SPACING,y:FIRST_Y+i*COLUMN_ROW_SPACING});
    }
    columns.push({index:col,title:COLUMN_META[col],x:col*COLUMN_X_SPACING,
      types:[type],count:inColumn.length,
      connectedCount:inColumn.filter(n=>distances.has(n.id)).length});
  }
  return {positions,columns,visibleNodeCount:valid.length,distances};
}
