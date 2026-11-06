import { memo,useCallback,useEffect,useMemo,useRef,useState } from 'react';
import {
  ReactFlow, ReactFlowProvider,useReactFlow,useNodesState,useEdgesState,
  Background,Controls,Handle,Position,MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Pill,UserRound,ChevronsLeft,ChevronLeft,ChevronRight,ChevronsRight,
  LocateFixed,Scan,
} from 'lucide-react';
import {
  extractWorkflow,extractAllNodesWorkflow,filterWorkflowByTypes,makeWorkflowIndex,buildPhenotypeWorkflow,
} from '../data/workflowBuilder.js';
import {NODE_COLORS,NODE_LABELS} from '../config/graphConfig.js';
import {NodeSymbol} from './NodeSymbol.jsx';
import {layoutWorkflowColumns,COLUMN_WIDTH,COLUMN_HEIGHT,COLUMN_ROW_SPACING,FIRST_Y} from '../data/workflowColumns.js';
import {indexWorkflowEdges,selectViewportGraph} from '../data/workflowViewport.js';
import '../css/DrugWorkflow.css';

const PALETTE={reference:'#4589ec',association:'#f08a24',annotation:'#e95b65',similarity:'#bf42a0',clinical:'#7488aa'};
const fmt=v=>Number(v??0).toLocaleString('vi-VN');
const BiomedicalNode=memo(function BiomedicalNode({data,selected}) {
  const n=data.entity;
  return <div className={`kg-biomedical-node ${selected?'is-selected':''} ${data.root?'is-root':''} ${n.referenceOnly?'is-reference-only':''}`}
    style={{'--node-color':NODE_COLORS[n.type]??'#7c93ac'}} title={`${n.label} (${n.id})`}>
    <Handle id="in-left" type="target" position={Position.Left} isConnectable={false}/>
    <Handle id="in-right" type="target" position={Position.Right} isConnectable={false}/>
    <span className="kg-biomedical-icon"><NodeSymbol type={n.type} size={27}/></span>
    <span className="kg-biomedical-kind">{NODE_LABELS[n.type]??n.type}</span>
    <strong>{n.label}</strong>
    <small>{String(n.id).split(':').slice(1).join(':')}{n.referenceOnly?' · ID từ Gene–Disease':''}</small>
    <Handle id="out-right" type="source" position={Position.Right} isConnectable={false}/>
    <Handle id="out-left" type="source" position={Position.Left} isConnectable={false}/>
  </div>;
});
function ColumnHeading({data}){
  return <div className="kg-column-heading">
    <span className="kg-column-heading-number">{data.index+1}</span>
    <span>{data.title}</span>
    <small>{fmt(data.count)} node</small>
  </div>;
}
const nodeTypes={biomedical:BiomedicalNode,columnHeading:ColumnHeading};
function toFlowEdge(e,variant){
  const color=PALETTE[e.evidence]??'#a4afc0';
  // ADRHPO is ADR -> HPO in the original KG. Route this edge from the
  // right-hand ADR lane into the HPO right handle in focused workflow.
  const fromRightToLeft=variant==='phenotype'&&e.type==='ADRHPO';
  return {id:e.id,source:e.source,target:e.target,type:'straight',animated:false,
    sourceHandle:fromRightToLeft?'out-left':'out-right',
    targetHandle:fromRightToLeft?'in-right':'in-left',
    style:{stroke:color,strokeWidth:e.evidence==='similarity'||e.evidence==='clinical'?2:2.5,
      strokeDasharray:e.evidence==='similarity'?'7 6':e.evidence==='association'?'3 5':e.evidence==='clinical'?'9 6':undefined},
    markerEnd:{type:MarkerType.ArrowClosed,color},data:{edge:e}};
}
function Canvas({workflow,onPick,variant,command}){
  // React Flow is only ever given the on-screen portion of the graph. Its
  // internal Zustand store therefore never contains thousands of offscreen
  // DOM nodes or SVG paths; the complete KG remains in `workflow`.
  const [nodes,setNodes,onNodesChange]=useNodesState([]);
  const [edges,setEdges,onEdgesChange]=useEdgesState([]);
  const [navType,setNavType]=useState('Drug');
  const [navIndex,setNavIndex]=useState(0);
  const [canvasSize,setCanvasSize]=useState({width:1000,height:650});
  const [viewport,setViewportState]=useState(null);
  const [movedVersion,setMovedVersion]=useState(0);
  const movedPositions=useRef(new Map());
  const viewportTimer=useRef(null);
  const latestMovingViewport=useRef(null);
  const canvasRef=useRef(null);
  const {setViewport,setCenter,zoomIn,zoomOut}=useReactFlow();
  const lastCommandSeq=useRef(command?.seq??0);

  const layout=useMemo(()=>layoutWorkflowColumns(workflow.nodes,workflow.edges,workflow.rootId,
    {anchorType:variant==='phenotype'?'HPO':null}),[workflow,variant]);
  const edgeIndex=useMemo(()=>indexWorkflowEdges(workflow.edges),[workflow.edges]);
  const navGroups=useMemo(()=>new Map(layout.columns.map(col=>[
    col.types[0],layout.rowsByColumn.get(col.index)??[],
  ])),[layout]);
  const nodeNavIndex=useMemo(()=>{
    const result=new Map();
    for(const [type,group] of navGroups)for(let i=0;i<group.length;i++)result.set(group[i].id,{type,index:i});
    return result;
  },[navGroups]);
  const selectedType=navGroups.has(navType)?navType:layout.columns[0]?.types[0];
  const activeGroup=navGroups.get(selectedType)??[];
  const boundedIndex=Math.min(navIndex,Math.max(0,activeGroup.length-1));

  // Initial viewport points at the root, not a fit-to-thousands tiny graph.
  const initialViewport=useMemo(()=>{
    const pos=layout.positions.get(workflow.rootId)??layout.positions.values().next().value??{x:0,y:0};
    return variant==='phenotype'
      ? {x:450-(pos.x+COLUMN_WIDTH/2)*.82,y:200-pos.y*.82,zoom:.82}
      : {x:60-pos.x*.90,y:200-pos.y*.90,zoom:.90};
  },[layout,workflow.rootId,variant]);
  const activeViewport=viewport??initialViewport;

  useEffect(()=>{
    const element=canvasRef.current;
    if(!element)return;
    const measure=()=>{
      const width=Math.max(1,element.clientWidth),height=Math.max(1,element.clientHeight);
      setCanvasSize(prev=>prev.width===width&&prev.height===height?prev:{width,height});
    };
    measure();
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;
    observer?.observe(element);
    return ()=>observer?.disconnect();
  },[]);
  useEffect(()=>{
    movedPositions.current=new Map();
    setMovedVersion(v=>v+1);
    setViewportState(initialViewport);
    setViewport(initialViewport,{duration:0});
  },[initialViewport,setViewport]);
  useEffect(()=>()=>{
    if(viewportTimer.current!==null)clearTimeout(viewportTimer.current);
  },[]);

  // Limit state commits during pan/zoom. The overscan buffer prevents flashing
  // while the pointer moves between throttled viewport updates.
  const onMove=useCallback((_event,next)=>{
    latestMovingViewport.current=next;
    if(viewportTimer.current!==null)return;
    viewportTimer.current=setTimeout(()=>{
      viewportTimer.current=null;
      setViewportState(latestMovingViewport.current);
    },95);
  },[]);
  const onMoveEnd=useCallback((_event,next)=>{
    if(viewportTimer.current!==null){clearTimeout(viewportTimer.current);viewportTimer.current=null;}
    if(next){latestMovingViewport.current=next;setViewportState(next);}
  },[]);
  const scene=useMemo(()=>selectViewportGraph(
    workflow,layout,edgeIndex,activeViewport,canvasSize,movedPositions.current,
  ),[workflow,layout,edgeIndex,activeViewport,canvasSize,movedVersion]);
  const flowNodes=useMemo(()=>{
    const entityNodes=scene.nodes.map(n=>({
      id:n.id,type:'biomedical',
      position:movedPositions.current.get(n.id)??layout.positions.get(n.id)??{x:0,y:100},
      data:{entity:n,root:n.id===workflow.rootId},
      draggable:true,selectable:true,
    }));
    const headings=scene.headings.map(col=>({
      id:`__column_${col.index}`,type:'columnHeading',
      position:{x:col.x,y:0},
      data:{index:col.index,title:col.title,count:col.count},
      draggable:false,selectable:false,connectable:false,focusable:false,
      style:{width:COLUMN_WIDTH,height:44},
    }));
    return [...headings,...entityNodes];
  },[scene,layout.positions,workflow.rootId]);
  const flowEdges=useMemo(()=>scene.edges.map(edge=>toFlowEdge(edge,variant)),[scene.edges,variant]);
  useEffect(()=>{
    setNodes(flowNodes);
    setEdges(flowEdges);
  },[flowNodes,flowEdges,setNodes,setEdges]);

  const jump=useCallback((type,index)=>{
    const group=navGroups.get(type)??[];
    if(!group.length)return;
    const bounded=Math.max(0,Math.min(index,group.length-1));
    const node=group[bounded];
    const position=movedPositions.current.get(node.id)??layout.positions.get(node.id);
    if(!position)return;
    setNavType(type);setNavIndex(bounded);
    setCenter(position.x+COLUMN_WIDTH/2,position.y+COLUMN_HEIGHT/2,{zoom:1.02,duration:200});
    onPick(node.id);
  },[navGroups,layout,setCenter,onPick]);
  const overviewColumns=useCallback(()=>{
    // Show the first rows across ALL active entity columns without shrinking
    // vertically to thousands of rows (which makes every entity unreadable).
    if (!layout.columns.length) return;
    const left=Math.min(...layout.columns.map(c=>c.x));
    const right=Math.max(...layout.columns.map(c=>c.x+COLUMN_WIDTH));
    const zoom=Math.max(.08,Math.min(.92,(canvasSize.width-90)/Math.max(1,right-left)));
    const next={x:(canvasSize.width-(right-left)*zoom)/2-left*zoom,
      y:Math.max(25,canvasSize.height*.24-FIRST_Y*zoom),zoom};
    setViewportState(next);
    setViewport(next,{duration:200});
  },[layout,canvasSize,setViewport]);
  const focusRoot=useCallback(()=>{
    const position=movedPositions.current.get(workflow.rootId)??
      layout.positions.get(workflow.rootId)??layout.positions.values().next().value;
    if(position)setCenter(position.x+COLUMN_WIDTH/2,position.y+COLUMN_HEIGHT/2,{zoom:1.02,duration:200});
  },[layout,workflow.rootId,setCenter]);
  const handleFitAll=useCallback(()=>{
    // fitView() only knows the currently mounted virtual window. Use the
    // entire coordinate domain when fitting, even for 100k+ nodes.
    const left=Math.min(0,...layout.columns.map(c=>c.x));
    const right=Math.max(COLUMN_WIDTH,...layout.columns.map(c=>c.x+COLUMN_WIDTH));
    const bottom=Math.max(COLUMN_HEIGHT,...layout.columns.map(c=>
      FIRST_Y+Math.max(0,c.count-1)*COLUMN_ROW_SPACING+COLUMN_HEIGHT));
    const zoom=Math.max(.001,Math.min(.85,(canvasSize.width-80)/Math.max(1,right-left),
      (canvasSize.height-90)/Math.max(1,bottom)));
    const next={x:(canvasSize.width-(right-left)*zoom)/2-left*zoom,
      y:(canvasSize.height-bottom*zoom)/2,zoom};
    setViewportState(next);
    setViewport(next,{duration:200});
  },[layout,canvasSize,setViewport]);
  // Sidebar zoom / fit actions also operate on React Flow (not only Sigma).
  useEffect(()=>{
    if(!command || command.seq<=lastCommandSeq.current)return;
    lastCommandSeq.current=command.seq;
    if(command.type==='zoomIn')void zoomIn({duration:150});
    else if(command.type==='zoomOut')void zoomOut({duration:150});
    else if(command.type==='fit')handleFitAll();
  },[command,zoomIn,zoomOut,handleFitAll]);
  const onNodeClick=useCallback((_evt,node)=>{
    if(node.type!=='biomedical')return;
    onPick(node.id);
    const info=nodeNavIndex.get(node.id);
    if(info){setNavType(info.type);setNavIndex(info.index);}
  },[onPick,nodeNavIndex]);
  const onNodeDragStop=useCallback((_event,node)=>{
    if(node.type!=='biomedical')return;
    movedPositions.current.set(node.id,{...node.position});
    setMovedVersion(v=>v+1);
  },[]);
  return <div className="kg-workflow-canvas" ref={canvasRef}>
    <div className="kg-canvas-nav" role="group" aria-label="Đi tới node theo loại">
      <label htmlFor="kg-jump-type">Đi tới loại</label>
      <select id="kg-jump-type" value={selectedType??''}
        onChange={e=>jump(e.target.value,0)}>
        {layout.columns.map(col=><option key={col.index} value={col.types[0]}>
          {col.title} ({fmt(col.count)})
        </option>)}
      </select>
      <button title="Node đầu tiên" aria-label="Node đầu tiên" onClick={()=>jump(selectedType,0)} disabled={!activeGroup.length}><ChevronsLeft size={15}/></button>
      <button title="Node trước" aria-label="Node trước" onClick={()=>jump(selectedType,boundedIndex-1)} disabled={boundedIndex===0}><ChevronLeft size={15}/></button>
      <small>{activeGroup.length?`${fmt(boundedIndex+1)}/${fmt(activeGroup.length)}`:'0/0'}</small>
      <button title="Node tiếp theo" aria-label="Node tiếp theo" onClick={()=>jump(selectedType,boundedIndex+1)} disabled={boundedIndex>=activeGroup.length-1}><ChevronRight size={15}/></button>
      <button title="Node cuối cùng" aria-label="Node cuối cùng" onClick={()=>jump(selectedType,activeGroup.length-1)} disabled={!activeGroup.length}><ChevronsRight size={15}/></button>
      {variant==='phenotype'&&<button className="kg-workflow-overview" title="Hiển thị đủ các cột Drug, Protein, Gene, Pathway, Disease, HPO, ADR" onClick={overviewColumns}>Tổng quan cột</button>}
      <button title="Về node gốc" aria-label="Về node gốc" onClick={focusRoot}><LocateFixed size={15}/></button>
      <button title="Fit toàn bộ (cần zoom in để thấy chi tiết)" aria-label="Fit toàn bộ" onClick={handleFitAll}><Scan size={15}/></button>
    </div>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick} onNodeDragStop={onNodeDragStop}
      onMove={onMove} onMoveEnd={onMoveEnd} defaultViewport={initialViewport}
      nodesConnectable={false} elementsSelectable nodesDraggable
      onlyRenderVisibleElements fitView={false} minZoom={.001} maxZoom={2.5}
      proOptions={{hideAttribution:true}}>
      <Background color="#d7e4f4" gap={22} size={1}/>
      <Controls position="bottom-left" showInteractive={false}/>
    </ReactFlow>
    <div className="kg-canvas-virtual-info" role="status">
      Đang vẽ {fmt(scene.nodes.length)}/{fmt(workflow.nodes.length)} node · {fmt(scene.edges.length)}/{fmt(workflow.edges.length)} cạnh
      {(scene.sampledNodes>0||scene.sampledEdges>0)&&<span> · Phóng to để xem chi tiết vùng đông</span>}
    </div>
  </div>;
}

function DrugWorkflow({data,rootId,onPick,types,variant="global",command}){
  const focused=variant==='phenotype';
  const [scope,setScope]=useState('all');
  // Focus Workflow uses ONLY the already filtered Sigma subgraph, and never
  // indexes or traverses the loaded full network.
  const graphIndex=useMemo(()=>focused?null:makeWorkflowIndex(data),[data,focused]);
  const sourceWorkflow=useMemo(()=>focused?buildPhenotypeWorkflow(data,rootId):scope==='all'?
    extractAllNodesWorkflow(data,rootId,graphIndex):extractWorkflow(data,rootId,graphIndex),
    [data,rootId,scope,graphIndex,focused]);
  const workflow=useMemo(()=>filterWorkflowByTypes(sourceWorkflow,types),[sourceWorkflow,types]);
  if(!sourceWorkflow.rootId)return <div className="kg-flow-empty">
    <Pill size={32}/><h3>Chưa có dữ liệu graph</h3><p>Hãy kiểm tra API và nhấn Reload APIs.</p>
  </div>;
  if(workflow.rootHidden && (focused||scope==='related'))return <div className="kg-flow-empty">
    <Pill size={32}/><h3>Loại node gốc đang bị ẩn</h3><p>Bật lại {NODE_LABELS[workflow.rootType]??workflow.rootType} trong Node types hoặc chuyển sang Tất cả node.</p>
    {!focused&&<button className="kg-scope-btn" onClick={()=>setScope('all')}>Hiển thị tất cả node</button>}
  </div>;
  const totalTypes=new Set(workflow.nodes.map(n=>n.type)).size;
  return <div className="kg-drug-workflow">
    <div className="kg-workflow-status">
      <span><b>{fmt(workflow.nodes.length)}</b> node · <b>{fmt(workflow.edges.length)}</b> cạnh thực · <b>{fmt(totalTypes)}</b> loại node</span>
      {focused?<span className="kg-focused-workflow-chip"><UserRound size={14}/> HPO Focus · mạng con đang chọn</span>:
        <span className="kg-workflow-scope-switch" role="group" aria-label="Phạm vi hiển thị">
          <button className={scope==='all'?'active':''} aria-pressed={scope==='all'} onClick={()=>setScope('all')}>Tất cả node theo loại</button>
          <button className={scope==='related'?'active':''} aria-pressed={scope==='related'} onClick={()=>setScope('related')}>Nhánh liên quan node chọn</button>
        </span>}
    </div>
    <div className="kg-workflow-reading-notice">
      {focused?<>
        Chỉ hiển thị mạng con đã lọc từ HPO đang chọn. Disease → HPO ← ADR thể hiện hai liên kết annotation thật; không suy diễn cạnh ADR–Disease. Mặc định giữ cả Drug–Protein–Gene–Pathway của hai nhánh ADR và Disease khi chọn chế độ mở rộng hoặc ADR ∩ Disease. Dùng “Tổng quan cột” hoặc “Đi tới loại” để xem phần nằm ngoài màn hình.
      </>:scope==='all'?<>
        Giữ toàn bộ node từ API, kể cả node chưa có cạnh; canvas chỉ vẽ vùng đang nhìn để giảm lag; <b>{fmt(workflow.connectedNodeCount)}</b> node cùng thành phần liên thông với node gốc đang mở, <b>{fmt(workflow.disconnectedNodeCount)}</b> node còn lại.
      </>:<>
        Không cắt giới hạn số Protein, Gene, Pathway, HPO hay ADR; chỉ hiển thị các node thực sự liên quan theo cạnh đã nạp.
        {workflow.completeMechanism?' Có tuyến bằng chứng kiểu hình.':' Chưa có tuyến Drug → ADR hoàn chỉnh qua kiểu hình.'}
      </>}
      {workflow.hiddenNodeCount>0&&` Đã ẩn ${fmt(workflow.hiddenNodeCount)} node theo bộ lọc.`}
    </div>
    <ReactFlowProvider><Canvas workflow={workflow} onPick={onPick} variant={variant} command={command}/></ReactFlowProvider>
    <div className="kg-workflow-legend">
      <span><i style={{borderColor:PALETTE.reference}}/> Target / mapping / pathway</span>
      <span><i style={{borderColor:PALETTE.association,borderTopStyle:'dotted'}}/> Gene–disease association</span>
      <span><i style={{borderColor:PALETTE.annotation}}/> Disease–HPO annotation</span>
      <span><i style={{borderColor:PALETTE.similarity,borderTopStyle:'dashed'}}/> ADR → HPO phenotype mapping</span>
      <span><i style={{borderColor:PALETTE.clinical,borderTopStyle:'dashed'}}/> Drug–ADR recorded association</span>
    </div>
  </div>;
}

export default memo(DrugWorkflow);
