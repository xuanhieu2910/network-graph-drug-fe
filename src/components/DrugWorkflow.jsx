import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import {
  ReactFlow, ReactFlowProvider,useReactFlow,useNodesState,useEdgesState,
  Background,Controls,MiniMap,Handle,Position,MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Pill,Dna,GitBranch,HeartPulse,Activity,UserRound,TriangleAlert,Network,
  FlaskConical,ChevronsLeft,ChevronLeft,ChevronRight,ChevronsRight,
  LocateFixed,Scan,
} from 'lucide-react';
import {
  extractWorkflow,extractAllNodesWorkflow,filterWorkflowByTypes,
} from '../data/workflowBuilder.js';
import {NODE_COLORS,NODE_LABELS} from '../config/graphConfig.js';
import {layoutWorkflowColumns,COLUMN_WIDTH,COLUMN_HEIGHT} from '../data/workflowColumns.js';
import '../css/DrugWorkflow.css';

const ICONS={
  Drug:Pill,Protein:Network,KeggGene:Dna,Pathway:GitBranch,Disease:HeartPulse,
  HPO:UserRound,ADR:TriangleAlert,KeggDisease:HeartPulse,
  KeggNetwork:Activity,KeggDrugTarget:FlaskConical,KeggElement:Activity,
};
const PALETTE={reference:'#4589ec',association:'#f08a24',annotation:'#e95b65',similarity:'#bf42a0',clinical:'#7488aa'};
const fmt=v=>Number(v??0).toLocaleString('vi-VN');

export function NodeSymbol({type,size=19}) {
  const Icon=ICONS[type]??Activity;
  return <Icon size={size} strokeWidth={2.1} aria-hidden="true"/>;
}
function BiomedicalNode({data,selected}) {
  const n=data.entity;
  return <div className={`kg-biomedical-node ${selected?'is-selected':''} ${data.root?'is-root':''} ${n.referenceOnly?'is-reference-only':''}`}
    style={{'--node-color':NODE_COLORS[n.type]??'#7c93ac'}} title={`${n.label} (${n.id})`}>
    <Handle type="target" position={Position.Left} isConnectable={false}/>
    <span className="kg-biomedical-icon"><NodeSymbol type={n.type} size={27}/></span>
    <span className="kg-biomedical-kind">{NODE_LABELS[n.type]??n.type}</span>
    <strong>{n.label}</strong>
    <small>{String(n.id).split(':').slice(1).join(':')}{n.referenceOnly?' · ID từ Gene–Disease':''}</small>
    <Handle type="source" position={Position.Right} isConnectable={false}/>
  </div>;
}
function ColumnHeading({data}){
  return <div className="kg-column-heading">
    <span className="kg-column-heading-number">{data.index+1}</span>
    <span>{data.title}</span>
    <small>{fmt(data.count)} node</small>
  </div>;
}
const nodeTypes={biomedical:BiomedicalNode,columnHeading:ColumnHeading};
function toFlowEdge(e){
  const color=PALETTE[e.evidence]??'#a4afc0';
  return {id:e.id,source:e.source,target:e.target,type:'default',animated:false,
    pathOptions:{curvature:.34},
    style:{stroke:color,strokeWidth:e.evidence==='similarity'||e.evidence==='clinical'?2:2.5,
      strokeDasharray:e.evidence==='similarity'?'7 6':e.evidence==='association'?'3 5':e.evidence==='clinical'?'9 6':undefined},
    markerEnd:{type:MarkerType.ArrowClosed,color},data:{edge:e}};
}
function Canvas({workflow,onPick,isFullscreen}){
  const [nodes,setNodes,onNodesChange]=useNodesState([]);
  const [edges,setEdges,onEdgesChange]=useEdgesState([]);
  const [layoutError,setLayoutError]=useState('');
  const [navType,setNavType]=useState('Drug');
  const [navIndex,setNavIndex]=useState(0);
  const canvasRef=useRef(null);
  const {setViewport,setCenter,fitView}=useReactFlow();
  const layout=useMemo(()=>layoutWorkflowColumns(workflow.nodes,workflow.edges,workflow.rootId),[workflow]);
  const navGroups=useMemo(()=>{
    const result=new Map();
    for(const n of workflow.nodes){
      if(!result.has(n.type))result.set(n.type,[]);
      result.get(n.type).push(n);
    }
    for(const group of result.values())group.sort((a,b)=>
      (layout.positions.get(a.id)?.y??0)-(layout.positions.get(b.id)?.y??0));
    return result;
  },[workflow,layout]);
  const selectedType=navGroups.has(navType)?navType:layout.columns[0]?.types[0];
  const activeGroup=navGroups.get(selectedType)??[];
  const boundedIndex=Math.min(navIndex,Math.max(0,activeGroup.length-1));

  useEffect(()=>{
    let alive=true;
    setLayoutError('');
    try {
      const flowNodes=workflow.nodes.map(n=>({id:n.id,type:'biomedical',
        position:layout.positions.get(n.id)??{x:0,y:100},
        data:{entity:n,root:n.id===workflow.rootId},draggable:true,selectable:true}));
      const headings=layout.columns.map(col=>({id:`__column_${col.index}`,type:'columnHeading',
        position:{x:col.x,y:0},
        data:{index:col.index,title:col.title,count:col.count},draggable:false,selectable:false,
        connectable:false,focusable:false,style:{width:COLUMN_WIDTH,height:44}}));
      setNodes([...headings,...flowNodes]);
      setEdges(workflow.edges.map(toFlowEdge));
      // Focus an actual node at a readable scale, never fit all 2,000+ nodes
      // into a postage-stamp-sized viewport.
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        if(!alive)return;
        const target=layout.positions.get(workflow.rootId)??layout.positions.values().next().value;
        if(!target)return;
        const width=canvasRef.current?.clientWidth??1000;
        const zoom=Math.max(.76,Math.min(1,(width-90)/950));
        setViewport({x:48-target.x*zoom,y:160-target.y*zoom,zoom},{duration:0});
      }));
    } catch(error){if(alive)setLayoutError(`Column layout failed: ${error.message}`);}
    return ()=>{alive=false;};
  },[workflow,layout,setNodes,setEdges,setViewport]);

  const jump=useCallback((type,index)=>{
    const group=navGroups.get(type)??[];
    if(!group.length)return;
    const bounded=Math.max(0,Math.min(index,group.length-1));
    const node=group[bounded];
    const position=layout.positions.get(node.id);
    if(!position)return;
    setNavType(type);setNavIndex(bounded);
    setCenter(position.x+COLUMN_WIDTH/2,position.y+COLUMN_HEIGHT/2,{zoom:1.02,duration:250});
    onPick(node.id);
  },[navGroups,layout,setCenter,onPick]);
  const focusRoot=useCallback(()=>{
    const position=layout.positions.get(workflow.rootId)??layout.positions.values().next().value;
    if(position)setCenter(position.x+COLUMN_WIDTH/2,position.y+COLUMN_HEIGHT/2,{zoom:1.02,duration:250});
  },[layout,workflow.rootId,setCenter]);
  const handleFitAll=useCallback(()=>fitView({padding:.1,duration:250,minZoom:.08,maxZoom:.85,includeHiddenNodes:true}),[fitView]);
  const onNodeClick=useCallback((_evt,node)=>{
    if(node.type!=='biomedical')return;
    onPick(node.id);
    const group=navGroups.get(node.data.entity.type)??[];
    const idx=group.findIndex(n=>n.id===node.id);
    if(idx>=0){setNavType(node.data.entity.type);setNavIndex(idx);}
  },[onPick,navGroups]);
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
      <button title="Về node gốc" aria-label="Về node gốc" onClick={focusRoot}><LocateFixed size={15}/></button>
      <button title="Fit toàn bộ (đồ thị nhiều node sẽ rất nhỏ)" aria-label="Fit toàn bộ" onClick={handleFitAll}><Scan size={15}/></button>
    </div>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick} nodesConnectable={false} elementsSelectable nodesDraggable
      onlyRenderVisibleElements fitView={false} minZoom={.05} maxZoom={2.5}
      proOptions={{hideAttribution:true}}>
      <Background color="#d7e4f4" gap={22} size={1}/>
      <Controls position="bottom-left" showInteractive={false}/>
      {workflow.nodes.length<=350&&<MiniMap position="bottom-right" nodeColor={n=>n.type==='columnHeading'?'#f4f6f9':NODE_COLORS[n.data?.entity?.type]??'#a4b0c0'} pannable zoomable/>}
    </ReactFlow>
    {layoutError&&<div className="kg-flow-alert">{layoutError}</div>}
  </div>;
}

export default function DrugWorkflow({data,rootId,onPick,onFocus,types,isFullscreen}){
  const [scope,setScope]=useState('all');
  const sourceWorkflow=useMemo(()=>scope==='all'?
    extractAllNodesWorkflow(data,rootId):extractWorkflow(data,rootId),[data,rootId,scope]);
  const workflow=useMemo(()=>filterWorkflowByTypes(sourceWorkflow,types),[sourceWorkflow,types]);
  if(!sourceWorkflow.rootId)return <div className="kg-flow-empty">
    <Pill size={32}/><h3>Chưa có dữ liệu graph</h3><p>Hãy kiểm tra API và nhấn Reload APIs.</p>
  </div>;
  if(workflow.rootHidden && scope==='related')return <div className="kg-flow-empty">
    <Pill size={32}/><h3>Loại node gốc đang bị ẩn</h3><p>Bật lại {NODE_LABELS[workflow.rootType]??workflow.rootType} trong Node types hoặc chuyển sang Tất cả node.</p>
    <button className="kg-scope-btn" onClick={()=>setScope('all')}>Hiển thị tất cả node</button>
  </div>;
  const totalTypes=new Set(workflow.nodes.map(n=>n.type)).size;
  return <div className="kg-drug-workflow">
    <div className="kg-workflow-status">
      <span><b>{fmt(workflow.nodes.length)}</b> node · <b>{fmt(workflow.edges.length)}</b> cạnh thực · <b>{fmt(totalTypes)}</b> loại node</span>
      <span className="kg-workflow-scope-switch" role="group" aria-label="Phạm vi hiển thị">
        <button className={scope==='all'?'active':''} aria-pressed={scope==='all'} onClick={()=>setScope('all')}>Tất cả node theo loại</button>
        <button className={scope==='related'?'active':''} aria-pressed={scope==='related'} onClick={()=>setScope('related')}>Nhánh liên quan node chọn</button>
      </span>
    </div>
    <div className="kg-workflow-reading-notice">
      {scope==='all'?<>
        Hiển thị toàn bộ node từ API, kể cả node chưa có cạnh; <b>{fmt(workflow.connectedNodeCount)}</b> node cùng thành phần liên thông với node gốc đang mở, <b>{fmt(workflow.disconnectedNodeCount)}</b> node còn lại.
      </>:<>
        Không cắt giới hạn số Protein, Gene, Pathway, HPO hay ADR; chỉ hiển thị các node thực sự liên quan theo cạnh đã nạp.
        {workflow.completeMechanism?' Có tuyến bằng chứng kiểu hình.':' Chưa có tuyến Drug → ADR hoàn chỉnh qua kiểu hình.'}
      </>}
      {workflow.hiddenNodeCount>0&&` Đã ẩn ${fmt(workflow.hiddenNodeCount)} node theo bộ lọc.`}
    </div>
    <ReactFlowProvider><Canvas workflow={workflow} onPick={onPick} isFullscreen={isFullscreen}/></ReactFlowProvider>
    <div className="kg-workflow-legend">
      <span><i style={{borderColor:PALETTE.reference}}/> Target / mapping / pathway</span>
      <span><i style={{borderColor:PALETTE.association,borderTopStyle:'dotted'}}/> Gene–disease association</span>
      <span><i style={{borderColor:PALETTE.annotation}}/> Disease–HPO annotation</span>
      <span><i style={{borderColor:PALETTE.similarity,borderTopStyle:'dashed'}}/> HPO–ADR phenotype mapping</span>
      <span><i style={{borderColor:PALETTE.clinical,borderTopStyle:'dashed'}}/> Drug–ADR recorded association</span>
    </div>
  </div>;
}
