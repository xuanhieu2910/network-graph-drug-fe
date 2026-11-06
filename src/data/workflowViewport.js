import {
  COLUMN_HEIGHT,COLUMN_ROW_SPACING,COLUMN_WIDTH,FIRST_Y,
} from './workflowColumns.js';

/**
 * True viewport virtualization. Graph data and indexes stay complete; only a
 * bounded subset of React Flow DOM nodes / SVG paths is mounted at once.
 * No synthetic biology edges. All indexes are derived from real edges.
 */
export const MAX_CANVAS_NODES=420;
export const MAX_CANVAS_EDGES=1300;
const OVERSCAN_PX=240;

export function indexWorkflowEdges(edges) {
  const outgoing=new Map();
  for(const e of edges){
    if(!outgoing.has(e.source))outgoing.set(e.source,[]);
    outgoing.get(e.source).push(e);
  }
  return outgoing;
}

function inside(pos, bounds) {
  return pos && pos.x+COLUMN_WIDTH>=bounds.left&&pos.x<=bounds.right&&
    pos.y+COLUMN_HEIGHT>=bounds.top&&pos.y<=bounds.bottom;
}

export function computeViewportBounds(viewport,size,overscan=OVERSCAN_PX) {
  const zoom=Math.max(.01,viewport?.zoom??1);
  const width=Math.max(1,size?.width??1000),height=Math.max(1,size?.height??650);
  return {
    left:(-(viewport?.x??0)-overscan)/zoom,
    right:(width-(viewport?.x??0)+overscan)/zoom,
    top:(-(viewport?.y??0)-overscan)/zoom,
    bottom:(height-(viewport?.y??0)+overscan)/zoom,
  };
}

/**
 * Integer-range lookup per lane is O(visible columns + visible rows), unlike
 * filtering every node every time the mouse moves.
 */
export function selectViewportGraph(workflow,layout,edgeIndex,viewport,size,moved=new Map()) {
  const bounds=computeViewportBounds(viewport,size);
  const groups=[];
  let candidates=0;
  for(const col of layout.columns){
    if(col.x+COLUMN_WIDTH<bounds.left||col.x>bounds.right)continue;
    const rows=layout.rowsByColumn.get(col.index)??[];
    const start=Math.max(0,Math.ceil((bounds.top-FIRST_Y-COLUMN_HEIGHT)/COLUMN_ROW_SPACING));
    const end=Math.min(rows.length,Math.floor((bounds.bottom-FIRST_Y)/COLUMN_ROW_SPACING)+1);
    if(end<=start)continue;
    groups.push({rows,start,end});
    candidates+=end-start;
  }
  const selected=new Map();
  // Fair per-column sampling at extreme zoom-out; users can zoom in to see
  // every row. Never discard full workflow nodes or modify graph connectivity.
  const stride=Math.max(1,Math.ceil(candidates/MAX_CANVAS_NODES));
  for(const group of groups){
    for(let i=group.start;i<group.end;i+=stride){
      const n=group.rows[i];
      const pos=moved.get(n.id)??layout.positions.get(n.id);
      if(inside(pos,bounds))selected.set(n.id,n);
    }
  }
  // Include dragged nodes using their current position, even if their original
  // lane index is now outside the viewport.
  const byId=layout.nodeById;
  for(const [id,pos] of moved){
    if(inside(pos,bounds)&&byId?.has(id))selected.set(id,byId.get(id));
    else selected.delete(id);
  }
  // Prefer the chosen root if it is actually within the current viewport.
  const root=byId.get(workflow.rootId);
  const rootPos=moved.get(root?.id)??layout.positions.get(root?.id);
  if(root&&inside(rootPos,bounds))selected.set(root.id,root);
  const visibleIds=new Set(selected.keys());
  const edges=[];
  let matchingEdges=0;
  for(const id of visibleIds){
    for(const edge of edgeIndex.get(id)??[]){
      if(!visibleIds.has(edge.target))continue;
      matchingEdges++;
      if(edges.length<MAX_CANVAS_EDGES)edges.push(edge);
    }
  }
  const headings=layout.columns.filter(c=>c.x+COLUMN_WIDTH>=bounds.left&&c.x<=bounds.right&&bounds.top<=44&&bounds.bottom>=0);
  return {
    nodes:[...selected.values()],edges,headings,
    candidates,matchingEdges,
    sampledNodes:Math.max(0,candidates-selected.size),
    sampledEdges:Math.max(0,matchingEdges-edges.length),
    bounds,
  };
}
