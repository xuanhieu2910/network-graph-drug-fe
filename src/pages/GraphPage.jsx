import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, Check, ChevronRight, CircleDot,
  Download, Eye, GitBranch, Layers3, Link2, Maximize2, Minimize2, RefreshCw,
  Search, SlidersHorizontal, Target, Workflow, X,
} from 'lucide-react';
import {NodeSymbol} from '../components/NodeSymbol.jsx';
const DrugWorkflow=lazy(()=>import('../components/DrugWorkflow.jsx'));
const GraphNetwork=lazy(()=>import('../components/GraphNetwork.jsx'));
import {loadGraph} from '../data/sampleGraph.js';
import {makePhenotypeIndex,searchPhenotypes,listOverlappingPhenotypes,extractPhenotypeSubgraph} from '../data/phenotypeFocus.js';
import {GRAPH_NODE_TYPES,NODE_COLORS,NODE_LABELS} from '../config/graphConfig.js';
import '../css/GraphPage.css';

const EMPTY={nodes:[],edges:[],diagnostics:null};
const fmt=n=>Number(n??0).toLocaleString('en-US');
const CORE_TYPES=['Drug','Protein','KeggGene','Pathway','Disease','HPO','ADR'];
const TYPE_HINT={Drug:'Thuốc',Protein:'Đích tác động',KeggGene:'Gen KEGG',Pathway:'Con đường sinh học',Disease:'Bệnh MONDO',HPO:'Kiểu hình bệnh',ADR:'Phản ứng có hại'};
const EDGE_INFO={
  DrugProtein:'Target / Drug–Protein', ProteinGene:'Protein–Gene mapping',
  GenePathway:'Gene–Pathway', GeneDisease:'Gene–Disease association',
  DiseaseHPO:'Disease–HPO annotation', ADRHPO:'ADR–HPO phenotype mapping',
  DrugADR:'Drug–ADR recorded association',
};
function Metric({icon:Icon,label,value,danger=false}) {
  return <div className={`kg-metric ${danger?'kg-metric-danger':''}`}><span className="kg-metric-symbol"><Icon size={21}/></span><div><small>{label}</small><strong>{fmt(value)}</strong></div></div>;
}
function Step({type,visible=true,count=0}) {
  return <div className={`kg-pipeline-step${visible?'':' kg-step-disabled'}`}
    style={{'--step-color':NODE_COLORS[type]}}>
    <span className="kg-pipeline-icon"><NodeSymbol type={type} size={26}/></span>
    <b>{TYPE_HINT[type]??NODE_LABELS[type]??type}</b>
    <small>{NODE_LABELS[type]??type}</small>
    <strong className="kg-class-count">{fmt(count)} node</strong>
  </div>;
}
function Pipeline({types,data}) {
  // Actual API node counts only; these are TYPE summaries, not six fabricated
  // biological nodes or a misleading Drug → Disease causal chain.
  const counts=useMemo(()=>{
    const result=new Map();
    for(const n of data?.nodes??[])result.set(n.type,(result.get(n.type)??0)+1);
    return result;
  },[data]);
  const categories=GRAPH_NODE_TYPES.filter(type=>(counts.get(type)??0)>0);
  return <section className="kg-pipeline">
    <div className="kg-pipeline-title"><Workflow size={19}/>
      <b>Phân loại node thực tế từ API</b>
      <span>Mỗi thẻ là một loại dữ liệu — không phải một node hay một cạnh</span>
    </div>
    <div className="kg-pipeline-grid kg-dynamic-pipeline-grid">
      {categories.map(type=><Step key={type} type={type}
        count={counts.get(type)} visible={types.includes(type)}/>)}
    </div>
    <p className="kg-pipeline-note"><GitBranch size={15}/>
      Sơ đồ phía dưới hiển thị từng node theo đúng nhóm và thứ tự. Node không có cạnh vẫn hiển thị trong chế độ “Tất cả node theo loại”.
      Quan hệ nào chưa có trong API sẽ không được vẽ thành liên kết.
    </p>
  </section>;
}
function Inspector({node,edgeAdjacency,nodeLookup,onFocus}) {
  const related=useMemo(()=>{
    if(!node)return [];
    return (edgeAdjacency.get(node.id)??[]).slice(0,45)
      .map(e=>({edge:e,other:nodeLookup.get(e.source===node.id?e.target:e.source)}))
      .filter(x=>x.other);
  },[node,edgeAdjacency,nodeLookup]);
  if(!node)return <div className="kg-no-selection"><Target size={36}/><h3>Node inspector</h3><p>Nhấn vào một node trên canvas hoặc chọn từ ô tìm kiếm để xem thuộc tính và các liên kết.</p></div>;
  const attrs=Object.entries(node.original??{}).filter(([,v])=>v!==null&&v!==undefined&&v!==''&&typeof v!=='object').slice(0,25);
  return <div className="kg-inspector">
    <div className="kg-inspector-heading" style={{'--inspect-color':NODE_COLORS[node.type]??'#60748c'}}>
      <div className="kg-inspector-icon"><NodeSymbol type={node.type} size={28}/></div>
      <div><small>{NODE_LABELS[node.type]??node.type}</small><h3>{node.label}</h3><code>{node.id}</code></div>
    </div>
    {['Drug','ADR','HPO','Disease'].includes(node.type)&&<button className="kg-btn kg-btn-blue kg-btn-wide" onClick={()=>onFocus(node.id)}><Workflow size={16}/> Mở quan hệ của node này</button>}
    <div className="kg-sidebar-subtitle">Quan hệ trực tiếp <span>{related.length}{related.length===45?'+':''}</span></div>
    <div className="kg-rel-list">{related.length?related.slice(0,9).map(({edge,other})=><div className="kg-rel" key={edge.id}>
      <span className="kg-rel-bullet" style={{background:NODE_COLORS[other.type]??'#aaa'}}/>
      <div><b>{other.label}</b><small>{EDGE_INFO[edge.type]??edge.type}</small></div><ChevronRight size={14}/>
    </div>):<p className="kg-tiny-muted">Chưa tìm thấy cạnh hợp lệ nối node này.</p>}</div>
    <div className="kg-sidebar-subtitle">Thuộc tính từ API</div>
    <div className="kg-attributes">{attrs.length?attrs.map(([k,v])=><div key={k}><span>{k}</span><strong title={String(v)}>{String(v).slice(0,240)}</strong></div>):<p className="kg-tiny-muted">Không có thuộc tính bổ sung.</p>}</div>
  </div>;
}
/** Search results and HPO-focused analysis use actual typed API associations. */
function PhenotypeSummary({focus,scope,setScope,mode,setMode}) {
  if (!focus) return null;
  const {root,summary}=focus;
  const list=(items,label,type)=><div className="kg-phenotype-side" key={type}>
    <h4 style={{color:NODE_COLORS[type]}}>{label} <span>{fmt(items.length)}</span></h4>
    {items.length?<div className="kg-phenotype-entities">{items.slice(0,6).map(n=><div key={n.id} title={n.id}>
      <NodeSymbol type={type} size={14}/><span>{n.label}</span></div>)}
      {items.length>6&&<small>Và {fmt(items.length-6)} node khác trong mạng con</small>}</div>
      :<p>Chưa có cạnh tương ứng từ dữ liệu API.</p>}
  </div>;
  return <section className="kg-phenotype-summary" aria-live="polite">
    <div className="kg-phenotype-summary-head">
      <div><small>HPO đang phân tích</small><h3>{root.label}</h3><code>{root.id.replace(/^hpo:/i,'')}</code></div>
      <span className="kg-phenotype-visible-count">{fmt(summary.visibleNodes)} node · {fmt(summary.visibleEdges)} cạnh đang hiển thị</span>
    </div>
    <div className="kg-hpo-view-switch" role="group" aria-label="Chế độ hiển thị HPO Focus">
      <button type="button" className={mode==='phenotype'?'active':''} aria-pressed={mode==='phenotype'}
        onClick={()=>setMode('phenotype')}><GitBranch size={15}/> Sigma.js</button>
      <button type="button" className={mode==='phenotypeWorkflow'?'active':''} aria-pressed={mode==='phenotypeWorkflow'}
        onClick={()=>setMode('phenotypeWorkflow')}><Workflow size={15}/> Workflow</button>
    </div>
    <div className="kg-phenotype-scopes" aria-label="Phạm vi mạng con HPO">
      {[['mechanism','Toàn bộ nhánh liên quan'],['direct','Liên kết HPO trực tiếp'],['overlap','ADR ∩ Disease']]
        .map(([value,label])=><button type="button" key={value} className={scope===value?'active':''}
          aria-pressed={scope===value} onClick={()=>setScope(value)}>{label}</button>)}
    </div>
    <div className="kg-phenotype-type-overview" aria-label="Số node theo loại trong mạng con HPO">
      {CORE_TYPES.map(type=><span className="kg-phenotype-type-count" key={type}
        title={`${NODE_LABELS[type]??type}: ${fmt(summary.typeCounts?.[type]??0)} node`}
        style={{'--hpo-type-color':NODE_COLORS[type]}}><NodeSymbol type={type} size={15}/>
        {type==='KeggGene'?'Gene':type} <b>{fmt(summary.typeCounts?.[type]??0)}</b></span>)}
    </div>
    <div className="kg-phenotype-branches">
      {list(summary.adrNodes,'ADR → HPO','ADR')}
      <div className="kg-phenotype-intersection"><CircleDot size={19}/><b>HPO chung</b>
        <strong>{summary.shared?'Có cả hai nhánh':'Chưa đủ hai nhánh'}</strong></div>
      {list(summary.diseaseNodes,'Disease → HPO','Disease')}
    </div>
    <p className="kg-phenotype-explanation">
      {scope==='mechanism'?'Mở rộng hai nhánh theo cạnh thật: HPO ← Disease ← Gene ← Protein ← Drug và HPO ← ADR ← Drug → Protein → Gene → Pathway. Các target/pathway của thuốc là bối cảnh phân tử, không mặc nhiên là nguyên nhân ADR. Không mở sang HPO khác.':
        scope==='direct'?'Chỉ hiển thị HPO và các ADR / MONDO Disease có cạnh ánh xạ trực tiếp đến HPO này.':
          'Chỉ chọn HPO có cả ADR và Disease; vẫn hiển thị các nhánh Drug–Protein–Gene–Pathway liên quan từ cả hai phía. Không suy diễn cạnh ADR–Disease hoặc quan hệ nhân quả.'}
    </p>
    {!summary.rootVisible&&<p className="kg-phenotype-warning">Node HPO đang bị ẩn trong bộ lọc Node types. Bật lại HPO để xem mạng.</p>}
    {!summary.adrNodes.length&&<p className="kg-phenotype-warning">Không có ADR–HPO hợp lệ cho HPO này trong dữ liệu đã tải. Kiểm tra API adr_hpo và adr_llt.</p>}
    {!summary.diseaseNodes.length&&<p className="kg-phenotype-warning">Không có Disease–HPO hợp lệ cho HPO này trong dữ liệu đã tải. Kiểm tra API mondo_human_phenotype và ánh xạ database_id.</p>}
  </section>;
}
function Diagnostics({diag}){
  if(!diag)return null;
  const summary=Object.entries(diag.sources??{}).filter(([,v])=>v.received>0);
  return <details className="kg-diagnostics"><summary><SlidersHorizontal size={16}/> API & ID diagnostics <b>{fmt(diag.missingEdges)} unresolved edges</b></summary>
    <p>Chỉ ghi nhận các cạnh có hai đầu mút hợp lệ; không tự sinh node Protein/Drug/Gene/Bệnh từ một ID chưa xác minh. HPO chỉ được tạo từ API danh mục HPO; mã HP chỉ có trong bảng quan hệ không được tính vào danh mục. ADR chỉ đến từ /adr_llt; mã ADR chỉ tồn tại trong quan hệ được báo thiếu, không tự tạo node.</p>
    <div className="kg-diagnostic-numbers"><span>Raw nodes: {fmt(diag.receivedNodes)}</span><span>Rendered nodes: {fmt(diag.renderedNodes)}</span><span>Raw edges: {fmt(diag.receivedEdges)}</span><span>Rendered edges: {fmt(diag.renderedEdges)}</span></div>
    <p><b>Gene–Disease API:</b> {diag.sourceLoadStatus?.geneDiseases?.status??'unknown'} · {fmt(diag.sourceLoadStatus?.geneDiseases?.rows)} rows · {fmt(diag.sources?.geneDiseases?.edgesAdded)} GeneDisease edges · {fmt(diag.missingBySource?.geneDiseases)} unresolved.
      {' '}URL: <code>{diag.sourceLoadStatus?.geneDiseases?.url??'unknown'}</code>.
      {diag.sourceLoadStatus?.geneDiseases?.message&&` ${diag.sourceLoadStatus.geneDiseases.message}`}</p>
    <p><b>Disease–HPO API:</b> {diag.sourceLoadStatus?.mondoPhenotypes?.status??'unknown'} · URL: <code>{diag.sourceLoadStatus?.mondoPhenotypes?.url??'unknown'}</code> · {fmt(diag.sourceLoadStatus?.mondoPhenotypes?.rows)} dòng · {fmt(diag.sources?.mondoPhenotypes?.edgesAdded)} cạnh DiseaseHPO hợp lệ · {fmt(diag.missingBySource?.mondoPhenotypes)} cạnh không khớp ID · {fmt(diag.invalidMondoHpoRelationRows)} dòng sai schema.
      {(diag.sourceLoadStatus?.mondoPhenotypes?.sampleKeys?.length??0)>0&&` Trường mẫu: ${diag.sourceLoadStatus.mondoPhenotypes.sampleKeys.join(', ')}`}
      {diag.sourceLoadStatus?.mondoPhenotypes?.message&&` ${diag.sourceLoadStatus.mondoPhenotypes.message}`}</p>
    <p><b>MONDO catalog:</b> {fmt(diag.diseaseCatalogCount)} bệnh từ API danh mục; {fmt(diag.diseaseReferenceCount)} MONDO ID-only từ các liên kết gene–disease (không tính là bệnh đã xác minh danh mục).</p>
    <p><b>ADR LLT API:</b> {diag.sourceLoadStatus?.adrLlts?.status??'unknown'} · URL: <code>{diag.sourceLoadStatus?.adrLlts?.url??'unknown'}</code>
      {(diag.sourceLoadStatus?.adrLlts?.sampleKeys?.length??0)>0 && ` · Trường mẫu: ${diag.sourceLoadStatus.adrLlts.sampleKeys.join(', ')}`}.</p>
    <p><b>ADR LLT catalog:</b> {fmt(diag.sources?.adrLlts?.received)} dòng API → {fmt(diag.adrCatalogCount??0)} UMLS CUI duy nhất;
      {' '}{fmt(diag.adrCatalogDuplicateRows??0)} dòng trùng CUI; {fmt(diag.nonLltAdrCatalogRows??0)} dòng có mức MedDRA khác LLT;
      {' '}{fmt(diag.malformedAdrCatalogRows??0)} dòng thiếu/sai UMLS CUI;
      {' '}{fmt(diag.missingLevelAdrCatalogRows??0)} dòng chưa khai báo mức MedDRA.
      {' '}Tham chiếu ADR ngoài catalog: {fmt(diag.unlistedAdrReferenceCount??0)} ID
      (adrHpo: {fmt(diag.unlistedAdrByCollection?.adrHpo??0)}, drugAdrLlts: {fmt(diag.unlistedAdrByCollection?.drugAdrLlts??0)}).
      {' '}Đây là số UMLS CUI, không nhất thiết bằng số thuật ngữ LLT phân biệt bằng MedDRA code.</p>
    <p><b>HPO API:</b> {diag.sourceLoadStatus?.hpoTerms?.status ?? 'unknown'} · URL: <code>{diag.sourceLoadStatus?.hpoTerms?.url || 'unknown'}</code></p>
    <p><b>HPO catalog:</b> {fmt(diag.sourceLoadStatus?.hpoTerms?.rows)} dòng API; {fmt(diag.hpoCatalogCount??0)} ID duy nhất;
      {' '}{fmt(diag.malformedHpoCatalogRows??0)} dòng sai schema; {fmt(diag.hpoCatalogDuplicateRows??0)} dòng trùng;
      {' '}{fmt(diag.unlistedHpoReferenceCount??0)} HP tham chiếu ngoài danh mục.
      {(diag.sourceLoadStatus?.hpoTerms?.sampleKeys?.length??0)>0 && ` Trường mẫu: ${diag.sourceLoadStatus.hpoTerms.sampleKeys.join(', ')}`}
      {diag.sourceLoadStatus?.hpoTerms?.message && ` Chi tiết: ${diag.sourceLoadStatus.hpoTerms.message}`}</p>
    {diag.paginationWarnings?.length>0&&<div className="kg-diag-warning"><b>Pagination:</b> {diag.paginationWarnings.join(' • ')}</div>}
    {diag.apiErrors?.length>0&&<div className="kg-diag-warning"><b>API errors:</b> {diag.apiErrors.join(' • ')}</div>}
    {diag.notConfiguredModels?.length>0&&<p><b>Optional APIs chưa cấu hình:</b> {diag.notConfiguredModels.join(', ')}</p>}
    {Object.keys(diag.missingBySource??{}).length>0&&<p><b>Unresolved theo collection:</b> {Object.entries(diag.missingBySource).sort((a,b)=>b[1]-a[1]).map(([name,n])=>`${name}: ${fmt(n)}`).join(' · ')}</p>}
    {diag.conflictingAliases>0&&<p><b>Ambiguous ID aliases:</b> {fmt(diag.conflictingAliases)} (skipped to avoid incorrect edges).</p>}
    <div className="kg-diag-sources">{summary.map(([name,v])=><div key={name}><span>{name}</span><strong>{fmt(v.received)} rows</strong><small>{v.edgesAdded??v.added} mapped</small></div>)}</div>
    {diag.missingExamples?.length>0&&<><h4>Ví dụ cạnh không khớp ID</h4>
      <div className="kg-missing-table">{diag.missingExamples.slice(0,12).map((x,i)=><div key={i}><b>{x.collection}</b><code>{x.sourceKey}</code><ArrowRight size={12}/><code>{x.targetKey}</code><span>{x.missing} missing</span></div>)}</div>
    </>}
  </details>;
}
export default function GraphPage(){
  const [data,setData]=useState(EMPTY),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [progress,setProgress]=useState({completed:0,total:12,phase:'loading'}),[reload,setReload]=useState(0);
  const [mode,setMode]=useState('phenotype'),[rootId,setRootId]=useState(null),[selectedId,setSelectedId]=useState(null);
  const [query,setQuery]=useState(''),[types,setTypes]=useState(GRAPH_NODE_TYPES);
  const [onlySharedHpo,setOnlySharedHpo]=useState(false),[sharedLimit,setSharedLimit]=useState(25);
  const [focusHpoId,setFocusHpoId]=useState(null),[phenotypeScope,setPhenotypeScope]=useState('mechanism');
  const deferredQuery=useDeferredValue(query);
  const [showEdges,setShowEdges]=useState(true),[layoutVersion,setLayoutVersion]=useState(0);
  const [command,setCommand]=useState({seq:0,type:'fit'});
  const graphPanelRef=useRef(null);
  const [nativeFullscreen,setNativeFullscreen]=useState(false);
  const [fallbackFullscreen,setFallbackFullscreen]=useState(false);
  const isFullscreen=nativeFullscreen||fallbackFullscreen;
  const issue=useCallback(type=>setCommand(c=>({seq:c.seq+1,type})),[]);
  // Browser fullscreen fires this event even when Esc is used (not through our button).
  useEffect(()=>{
    const sync=()=>setNativeFullscreen(document.fullscreenElement===graphPanelRef.current);
    document.addEventListener('fullscreenchange',sync);
    sync();
    return ()=>document.removeEventListener('fullscreenchange',sync);
  },[]);
  // CSS-only fallback handles browsers which don't expose/allow Fullscreen API.
  useEffect(()=>{
    if(!fallbackFullscreen)return;
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const escape=e=>{if(e.key==='Escape')setFallbackFullscreen(false);};
    document.addEventListener('keydown',escape);
    return ()=>{document.body.style.overflow=oldOverflow;document.removeEventListener('keydown',escape);};
  },[fallbackFullscreen]);
  const toggleFullscreen=useCallback(async()=>{
    const panel=graphPanelRef.current;
    if(!panel)return;
    if(fallbackFullscreen){setFallbackFullscreen(false);return;}
    if(document.fullscreenElement===panel){
      try{await document.exitFullscreen();}
      catch(e){console.warn('Could not exit fullscreen:',e);}
      return;
    }
    try{
      if(typeof panel.requestFullscreen!=='function')throw new Error('Fullscreen API unsupported');
      await panel.requestFullscreen();
      setNativeFullscreen(true);
    }catch(e){
      // Typical on iOS Safari or when the document denies native fullscreen.
      setFallbackFullscreen(true);
    }
  },[fallbackFullscreen]);
  // Sigma camera refits after the graph panel dimensions change. No network relayout.
  useEffect(()=>{
    if(mode==='workflow'||mode==='phenotypeWorkflow')return;
    let next=0;
    const first=requestAnimationFrame(()=>{next=requestAnimationFrame(()=>issue('fit'));});
    return ()=>{cancelAnimationFrame(first);cancelAnimationFrame(next);};
  },[isFullscreen,mode,issue]);
  useEffect(()=>{
    const ctl=new AbortController();setLoading(true);setError('');
    loadGraph(ctl.signal,setProgress).then(result=>{
      if(ctl.signal.aborted)return;
      setData(result);
      const firstDrug=result.nodes.find(n=>n.type==='Drug');
      setRootId(firstDrug?.id??null);setSelectedId(firstDrug?.id??null);
    }).catch(e=>{if(!ctl.signal.aborted&&e?.name!=='AbortError')setError(e?.message??String(e));})
      .finally(()=>{if(!ctl.signal.aborted)setLoading(false);});
    return ()=>ctl.abort();
  },[reload]);
  const lookup=useMemo(()=>new Map(data.nodes.map(n=>[n.id,n])),[data.nodes]);
  const isHpoMode=mode==='phenotype'||mode==='phenotypeWorkflow';
  const adjacency=useMemo(()=>{
    // Avoid indexing the full graph while exploring a filtered HPO.
    if(isHpoMode)return new Map();
    const result=new Map();
    for(const e of data.edges){
      if(!result.has(e.source))result.set(e.source,[]);
      if(!result.has(e.target))result.set(e.target,[]);
      result.get(e.source).push(e);
      result.get(e.target).push(e);
    }
    return result;
  },[data.edges,isHpoMode]);
  const phenotypeIndex=useMemo(()=>makePhenotypeIndex(data),[data]);
  const focusedPhenotype=useMemo(()=>focusHpoId
    ? extractPhenotypeSubgraph(phenotypeIndex,focusHpoId,phenotypeScope,types) : null,
    [phenotypeIndex,focusHpoId,phenotypeScope,types]);
  const activeData=useMemo(()=>isHpoMode
    ? {nodes:focusedPhenotype?.nodes??[],edges:focusedPhenotype?.edges??[]}
    : data,[isHpoMode,focusedPhenotype,data]);
  const activeLookup=useMemo(()=>isHpoMode
    ? new Map(activeData.nodes.map(n=>[n.id,n])) : lookup,
    [activeData.nodes,lookup,isHpoMode]);
  const activeAdjacency=useMemo(()=>{
    if(!isHpoMode)return adjacency;
    const result=new Map();
    for(const e of activeData.edges){
      if(!result.has(e.source))result.set(e.source,[]);
      if(!result.has(e.target))result.set(e.target,[]);
      result.get(e.source).push(e);
      result.get(e.target).push(e);
    }
    return result;
  },[isHpoMode,activeData.edges,adjacency]);
  const found=activeLookup.get(selectedId)??(isHpoMode?activeLookup.get(focusHpoId):null);
  const selected=found && types.includes(found.type) ? found : null;
  const counts=useMemo(()=>{
    const result=Object.fromEntries(GRAPH_NODE_TYPES.map(t=>[t,0]));
    for(const node of data.nodes)if(node.type in result)result[node.type]++;
    return result;
  },[data.nodes]);
  const overlapResults=useMemo(()=>onlySharedHpo
    ? listOverlappingPhenotypes(phenotypeIndex,deferredQuery,sharedLimit)
    : {items:[],total:0},[phenotypeIndex,deferredQuery,sharedLimit,onlySharedHpo]);
  const suggestions=useMemo(()=>onlySharedHpo ? overlapResults.items : searchPhenotypes(phenotypeIndex,deferredQuery,15),
    [phenotypeIndex,deferredQuery,onlySharedHpo,overlapResults]);
  const toggleSharedHpo=useCallback(checked=>{
    setOnlySharedHpo(checked);
    setSharedLimit(25);
    setMode(current=>current==='phenotypeWorkflow'?'phenotypeWorkflow':'phenotype');
    if (checked) {
      setPhenotypeScope('overlap');
      setTypes(prev=>[...new Set([...prev,...CORE_TYPES])]);
      if (focusHpoId && !phenotypeIndex.overlappingHpoIds.has(focusHpoId)) {
        setFocusHpoId(null); setSelectedId(null);
      }
    } else {
      setPhenotypeScope('mechanism');
    }
  },[focusHpoId,phenotypeIndex]);
  const pickPhenotype=useCallback(node=>{
    if(!node || node.type!=='HPO')return;
    setFocusHpoId(node.id);
    setSelectedId(node.id);
    setPhenotypeScope(onlySharedHpo?'overlap':'mechanism');
    // Selecting a focused phenotype defaults to all seven biological layers.
    // The user can still hide any layer manually afterwards.
    setTypes(prev=>[...new Set([...prev,...CORE_TYPES])]);
    setShowEdges(true);
    setQuery('');
    setMode(current=>current==='phenotypeWorkflow'?'phenotypeWorkflow':'phenotype');
    issue('fit');
  },[issue,onlySharedHpo]);
  const focus=useCallback(id=>{
    const node=lookup.get(id);
    if(node?.type==='HPO') {pickPhenotype(node);return;}
    setRootId(id);setSelectedId(id);setMode('workflow');
  },[lookup,pickPhenotype]);
  const clearPhenotype=useCallback(()=>{
    setFocusHpoId(null);setQuery('');setMode(current=>current==='phenotypeWorkflow'?'phenotypeWorkflow':'phenotype');
    setSelectedId(null);
  },[]);
  const toggleType=useCallback(t=>setTypes(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t]),[]);
  const selectFromCanvas=useCallback(id=>setSelectedId(id),[]);
  const diag=data.diagnostics;
  return <main className="kg-screen">
    <header className="kg-topbar">
      <div className="kg-logo"><Workflow size={33}/></div>
      <div className="kg-brand"><h1>Drug Network Explorer</h1><p>Drug · Protein · KEGG Gene · Pathway · MONDO Disease · HPO Phenotype · ADR (MedDRA)</p></div>
      <div className="kg-top-actions"><button className="kg-btn" disabled={loading} onClick={()=>setReload(r=>r+1)}><RefreshCw size={16}/> Reload APIs</button>
        <button className="kg-btn kg-btn-blue" disabled={loading||!data.nodes.length} onClick={()=>{setMode('full');issue('fit');}}><Layers3 size={16}/> Full Network</button></div>
    </header>
    {error&&<div className="kg-error"><AlertTriangle size={18}/> {error}</div>}
    {!loading && diag?.sourceLoadStatus?.adrLlts && diag.sourceLoadStatus.adrLlts.status !== 'loaded' &&
      <div className="kg-error" role="alert"><AlertTriangle size={18}/>
        ADR LLT catalog: {diag.sourceLoadStatus.adrLlts.status} — {diag.sourceLoadStatus.adrLlts.message || 'Không nạp được danh mục ADR LLT.'}
        {' '}URL: {diag.sourceLoadStatus.adrLlts.url || 'unknown'}
      </div>}
    {!loading && diag?.sourceLoadStatus?.hpoTerms && diag.sourceLoadStatus.hpoTerms.status !== 'loaded' &&
      <div className="kg-error" role="alert"><AlertTriangle size={18}/>
        HPO catalog: {diag.sourceLoadStatus.hpoTerms.status} — {diag.sourceLoadStatus.hpoTerms.message || 'Không nhận được bản ghi HPO hợp lệ.'}
        {' '}URL: {diag.sourceLoadStatus.hpoTerms.url || 'unknown'}
      </div>}
    {!loading && ['disabled','error','empty','no_join'].includes(diag?.sourceLoadStatus?.geneDiseases?.status)&&
      <div className="kg-error" role="alert"><AlertTriangle size={18}/>
        Gene–Disease: {diag.sourceLoadStatus.geneDiseases.status} — {diag.sourceLoadStatus.geneDiseases.message||'No matching GeneDisease edges.'}
        {' '}Xem API & ID diagnostics.
      </div>}
    {!loading && ['disabled','error','empty','no_join','schema_error'].includes(diag?.sourceLoadStatus?.mondoPhenotypes?.status) &&
      <div className="kg-error" role="alert"><AlertTriangle size={18}/>
        Disease–HPO: {diag.sourceLoadStatus.mondoPhenotypes.status} — {diag.sourceLoadStatus.mondoPhenotypes.message || 'Chưa nạp được cạnh MONDO → HPO.'}
        {' '}URL: {diag.sourceLoadStatus.mondoPhenotypes.url || 'unknown'}
      </div>}
    {loading&&<div className="kg-loading"><RefreshCw size={16} className="kg-spin"/> {progress.phase==='building'?'Normalizing biomedical IDs…':`Loading FastAPI sources ${progress.completed}/${progress.total}…`}</div>}
    <section className="kg-metrics"><Metric icon={Layers3} label="Validated nodes" value={data.nodes.length}/><Metric icon={Link2} label="Validated edges" value={data.edges.length}/>
      <Metric icon={Activity} label="Drugs" value={counts.Drug}/><Metric icon={NetworkSymbol} label="Proteins" value={counts.Protein}/><Metric icon={GitBranch} label="Pathways" value={counts.Pathway}/><Metric icon={AlertTriangle} label="ADR LLT (UMLS IDs)" value={counts.ADR}/><Metric icon={AlertTriangle} label="Unresolved edges" value={diag?.missingEdges} danger/></section>
    <div className="kg-main-grid">
      <aside className="kg-panel kg-left-panel">
        <h2><Search size={20}/> Explore network</h2>
        <p className="kg-search-intro">Tìm đúng một <b>Disease Phenotype (HPO)</b> theo tên hoặc mã HP. Xem cùng mạng con trong <b>Sigma.js</b> hoặc <b>Workflow</b>.</p>
        <label className="kg-search"><Search size={17}/><input value={query} onChange={e=>{setQuery(e.target.value);setSharedLimit(25);}}
          onKeyDown={e=>{
            if(e.key==='Escape')setQuery('');
            if(e.key==='Enter'){
              const match=onlySharedHpo
                ? listOverlappingPhenotypes(phenotypeIndex,e.currentTarget.value,1).items[0]
                : searchPhenotypes(phenotypeIndex,e.currentTarget.value,1)[0];
              if(match)pickPhenotype(match.node);
            }
          }}
          placeholder="Tên phenotype hoặc HP:000…" aria-label="Tìm Disease Phenotype theo tên, HPO ID hoặc database ID"
          aria-autocomplete="list" aria-controls="kg-hpo-suggestions" autoComplete="off" disabled={loading}/>
          {query&&<button type="button" aria-label="Xóa nội dung tìm kiếm" onClick={()=>setQuery('')}><X size={15}/></button>}</label>
        <label className={`kg-hpo-intersection-filter${onlySharedHpo?' is-active':''}`}>
          <input type="checkbox" checked={onlySharedHpo} disabled={loading}
            onChange={e=>toggleSharedHpo(e.target.checked)}/>
          <span className="kg-hpo-intersection-filter-copy">
            <b>Chỉ HPO chung: ADR ∩ Disease</b>
            <small>HPO có ít nhất 1 ADR và 1 Disease liên kết thực</small>
          </span>
          <strong>{fmt(phenotypeIndex.sharedHpos.length)}</strong>
        </label>
        {(query.trim()||onlySharedHpo)&&<div className="kg-hpo-result-wrap">
          <div className="kg-hpo-result-header">
            <b>{onlySharedHpo?'HPO giao nhau':'Kết quả HPO'}</b>
            <small>{onlySharedHpo?`${fmt(overlapResults.total)} / ${fmt(phenotypeIndex.hpos.length)} HPO`:`Tối đa ${fmt(suggestions.length)} kết quả`}</small>
          </div>
          <div id="kg-hpo-suggestions" className="kg-suggestions" role="listbox" aria-label="Danh sách Disease Phenotype">
            {suggestions.length?suggestions.map(({node,adrCount,diseaseCount})=><button type="button" role="option"
              aria-selected={node.id===focusHpoId} key={node.id} onClick={()=>pickPhenotype(node)}>
              <span style={{color:NODE_COLORS.HPO}}><NodeSymbol type="HPO" size={17}/></span>
              <span><b>{node.label}</b><small>{node.id.replace(/^hpo:/i,'')} · {fmt(diseaseCount)} Disease · {fmt(adrCount)} ADR</small></span>
              {onlySharedHpo&&<span className="kg-hpo-match-indicator" title="Đã xác nhận hai loại liên kết"><Check size={14}/></span>}
            </button>):<div className="kg-search-empty">{onlySharedHpo&&phenotypeIndex.sharedHpos.length===0
              ? 'Không có HPO chung trong các cạnh đã tải. Kiểm tra hai API ADR–HPO và Disease–HPO trong diagnostics.'
              : 'Không tìm thấy HPO thỏa mãn điều kiện lọc.'}</div>}
          </div>
          {onlySharedHpo&&overlapResults.total>suggestions.length&&<button type="button" className="kg-hpo-show-more"
            onClick={()=>setSharedLimit(v=>v+25)}>Xem thêm 25 phenotype ({fmt(overlapResults.total-suggestions.length)} còn lại)</button>}
        </div>}
        {focusHpoId&&<div className="kg-active-hpo"><span>Đã chọn: <b>{lookup.get(focusHpoId)?.label??focusHpoId}</b></span>
          <button type="button" onClick={()=>{setMode('phenotype');issue('fit');}}>Sigma.js</button>
          <button type="button" onClick={()=>setMode('phenotypeWorkflow')}>Workflow</button>
          <button type="button" onClick={clearPhenotype}>Xóa bộ lọc</button></div>}
        {!loading&&phenotypeIndex.hpos.length===0&&<p className="kg-search-empty">Danh mục HPO đang trống. Kiểm tra HPO API & ID diagnostics bên dưới.</p>}
        {onlySharedHpo&&<p className="kg-overlap-help">Chọn một HPO chung để xem <b>ADR → HPO ← Disease</b> và các nhánh liên quan <b>Drug → Protein → Gene → Pathway</b> ở cả Sigma.js lẫn Workflow. Chỉ sử dụng cạnh thực, không tạo quan hệ ADR–Disease trực tiếp.</p>}
        <section className="kg-sidebar-section"><h3><Layers3 size={17}/> Node types</h3>
          {GRAPH_NODE_TYPES.map(t=><label className="kg-type-filter" key={t}><input type="checkbox" checked={types.includes(t)} onChange={()=>toggleType(t)}/><span className="kg-type-icon" style={{color:NODE_COLORS[t]}}><NodeSymbol type={t} size={17}/></span><span>{NODE_LABELS[t]??t}</span><b>{fmt(counts[t])}</b></label>)}
          <small className="kg-hpo-source" role="status" style={{color: !loading && diag?.sourceLoadStatus?.adrLlts?.status !== 'loaded' ? '#be123c' : undefined}}>
            ADR LLT: {loading ? 'đang tải...' : diag?.sourceLoadStatus?.adrLlts?.status === 'loaded'
              ? `${fmt(diag.adrCatalogCount??0)} UMLS CUI / ${fmt(diag.sourceLoadStatus.adrLlts.rows)} dòng API · ${fmt(diag.unlistedAdrReferenceCount??0)} ID ngoài danh mục`
              : `${diag?.sourceLoadStatus?.adrLlts?.status || 'unknown'} — ${diag?.sourceLoadStatus?.adrLlts?.message || 'xem API & ID diagnostics'}`}
          </small>
          <small className="kg-hpo-source" role="status" style={{color: !loading && diag?.sourceLoadStatus?.hpoTerms?.status !== 'loaded' ? '#be123c' : undefined}}>
            HPO API: {loading ? 'đang tải...' : diag?.sourceLoadStatus?.hpoTerms?.status === 'loaded'
              ? `${fmt(diag.hpoCatalogCount??0)} ID duy nhất / ${fmt(diag.sourceLoadStatus.hpoTerms.rows)} dòng API`
              : `${diag?.sourceLoadStatus?.hpoTerms?.status || 'unknown'} — ${diag?.sourceLoadStatus?.hpoTerms?.message || 'xem API & ID diagnostics'}`}
          </small>
          <small className="kg-hpo-source" role="status">
            Gene–Disease: {loading?'đang tải...':`${diag?.sourceLoadStatus?.geneDiseases?.status??'unknown'} · ${fmt(diag?.sources?.geneDiseases?.edgesAdded)} cạnh hợp lệ / ${fmt(diag?.sourceLoadStatus?.geneDiseases?.rows)} dòng API`}
            {(diag?.diseaseReferenceCount??0)>0&&` · ${fmt(diag.diseaseReferenceCount)} MONDO ID chỉ có trong bảng quan hệ`}
          </small>
          <small className="kg-hpo-source" role="status" style={{color: !loading && diag?.sourceLoadStatus?.mondoPhenotypes?.status!=='loaded' ? '#be123c' : undefined}}>
            Disease–HPO: {loading?'đang tải...':`${diag?.sourceLoadStatus?.mondoPhenotypes?.status??'unknown'} · ${fmt(diag?.sources?.mondoPhenotypes?.edgesAdded)} cạnh / ${fmt(diag?.sourceLoadStatus?.mondoPhenotypes?.rows)} dòng API`}
          </small>
          <div className="kg-filter-actions"><button type="button" onClick={()=>setTypes(GRAPH_NODE_TYPES)} disabled={types.length===GRAPH_NODE_TYPES.length}>Chọn tất cả</button><button type="button" onClick={()=>setTypes([])} disabled={types.length===0}>Bỏ chọn</button></div>
          <small className="kg-hint">Áp dụng chung cho Workflow và Sigma.js. Ẩn một loại node sẽ ẩn cả các cạnh nối với node đó; không tự tạo cạnh đi tắt.</small></section>
        <section className="kg-sidebar-section"><h3><Workflow size={18}/> Graph mode</h3>
          {[['phenotype','HPO focus (Sigma.js)'],['phenotypeWorkflow','HPO focus (Workflow)'],['workflow','Workflow: Drug → ADR'],['full','Full Network (Sigma.js)'],['neighbors','1-hop neighborhood']].map(([value,label])=><button key={value} className={`kg-mode ${mode===value?'active':''}`} onClick={()=>setMode(value)}><CircleDot size={16}/>{label}</button>)}
          <div className="kg-mode-tools"><button className="kg-btn kg-btn-small" onClick={()=>issue('zoomIn')}>Zoom +</button><button className="kg-btn kg-btn-small" onClick={()=>issue('zoomOut')}>Zoom −</button><button className="kg-btn kg-btn-small" onClick={()=>issue('fit')}>Fit</button></div>
          {!['workflow','phenotypeWorkflow'].includes(mode)&&<><label className="kg-inline-check"><input type="checkbox" checked={showEdges} onChange={e=>setShowEdges(e.target.checked)}/> Show edges</label>
          <button className="kg-btn kg-btn-wide" onClick={()=>setLayoutVersion(v=>v+1)}><RefreshCw size={15}/> Re-layout network</button></>}
        </section>
      </aside>
      <div className="kg-center">
        <Pipeline types={types} data={isHpoMode?activeData:data} rootId={rootId}/>
        {isHpoMode&&focusedPhenotype&&<PhenotypeSummary focus={focusedPhenotype} scope={phenotypeScope}
          setScope={setPhenotypeScope} mode={mode} setMode={setMode}/>}
        <section ref={graphPanelRef} className={`kg-panel kg-graph-panel${fallbackFullscreen?' kg-fullscreen-fallback':''}`}>
          <div className="kg-graph-header"><span className="kg-title-mode"><Workflow size={18}/>{mode==='workflow'?'Drug → ADR Workflow':mode==='phenotypeWorkflow'?'Disease Phenotype focus (Workflow)':mode==='full'?'Full Network (Sigma.js)':mode==='phenotype'?'Disease Phenotype focus (Sigma.js)':'Neighborhood (Sigma.js)'}</span>
            <div className="kg-graph-actions">
              <span className="kg-view-meta">{['workflow','phenotypeWorkflow'].includes(mode)?'Kéo node · Phóng to · Chọn node':'Kéo node · Kéo canvas · Nhấp node để xem quan hệ'}</span>
              <button type="button" className="kg-fullscreen-btn" onClick={toggleFullscreen}
                aria-label={isFullscreen?'Thoát toàn màn hình':'Phóng to toàn màn hình'} aria-pressed={isFullscreen}
                title={isFullscreen?'Thu nhỏ đồ thị (Esc)':'Phóng to đồ thị toàn màn hình'}>
                {isFullscreen?<Minimize2 size={17}/>:<Maximize2 size={17}/>}<span>{isFullscreen?'Thu nhỏ':'Toàn màn hình'}</span>
              </button>
            </div></div>
          <div className="kg-canvas-wrap">
            {mode==='workflow'?<Suspense fallback={<div className="kg-loading">Đang mở Workflow…</div>}><DrugWorkflow data={data} rootId={rootId} types={types} onPick={selectFromCanvas} command={command}/></Suspense>
              :isHpoMode&&!focusedPhenotype?<div className="kg-empty-hpo-canvas"><Target size={39}/><h3>{onlySharedHpo?'Chọn một HPO giao nhau':'Chọn một Disease Phenotype'}</h3><p>{onlySharedHpo?'Danh sách bên trái chỉ gồm HPO có đồng thời liên kết ADR và Disease. Chọn một kết quả để xem phần giao nhau trong Sigma.js hoặc Workflow.':'Nhập tên hoặc mã HPO (HP:…) ở ô tìm kiếm bên trái, sau đó chọn kết quả.'}</p></div>
              :isHpoMode&&!focusedPhenotype.summary.rootVisible?<div className="kg-empty-hpo-canvas"><AlertTriangle size={32}/><h3>HPO đang bị ẩn</h3><p>Bật loại node HPO trong bộ lọc để xem mạng con.</p></div>
              :mode==='phenotypeWorkflow'?<Suspense fallback={<div className="kg-loading">Đang mở HPO Workflow…</div>}>
                <DrugWorkflow data={activeData} rootId={focusHpoId}
                  types={types} onPick={selectFromCanvas} variant="phenotype" command={command}/>
               </Suspense>
              :<Suspense fallback={<div className="kg-loading">Đang mở trình vẽ Sigma.js…</div>}>
                <GraphNetwork data={activeData} types={types} mode={mode==='neighbors'?'neighbors':'full'} selectedId={selectedId}
                 focusId={mode==='phenotype'?focusHpoId:null} presentation={mode==='phenotype'?'phenotype':'default'}
                 onSelectNode={selectFromCanvas} command={command} onViewStats={undefined} showEdges={showEdges}
                 layoutVersion={layoutVersion} dragMode="node"/>
               </Suspense>}
          </div>
        </section>
        <Diagnostics diag={diag}/>
      </div>
      <aside className="kg-panel kg-right-panel"><h2><Eye size={19}/> Node inspector</h2><Inspector node={selected} edgeAdjacency={activeAdjacency} nodeLookup={activeLookup} onFocus={focus}/>
        <div className="kg-right-note"><AlertTriangle size={17}/> Không diễn giải các quan hệ kiểu hình hoặc thống kê là bằng chứng nhân quả nếu chưa được xác thực.</div>
      </aside>
    </div>
  </main>;
}
function NetworkSymbol({size=21}) {return <GitBranch size={size}/>;}
