import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, Check, ChevronRight, CircleDot,
  Download, Eye, GitBranch, Layers3, Link2, Maximize2, Minimize2, RefreshCw,
  Search, SlidersHorizontal, Target, Workflow, X,
} from 'lucide-react';
import DrugWorkflow, {NodeSymbol} from '../components/DrugWorkflow.jsx';
import GraphNetwork from '../components/GraphNetwork.jsx';
import {loadGraph} from '../data/sampleGraph.js';
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
function Inspector({node,data,onFocus}) {
  const related=useMemo(()=>{
    if(!node)return [];
    const lookup=new Map(data.nodes.map(n=>[n.id,n]));
    return data.edges.filter(e=>e.source===node.id||e.target===node.id)
      .slice(0,45).map(e=>({edge:e,other:lookup.get(e.source===node.id?e.target:e.source)}))
      .filter(x=>x.other);
  },[node,data]);
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
  const [mode,setMode]=useState('workflow'),[rootId,setRootId]=useState(null),[selectedId,setSelectedId]=useState(null);
  const [query,setQuery]=useState(''),[types,setTypes]=useState(GRAPH_NODE_TYPES);
  const [showEdges,setShowEdges]=useState(true),[layoutVersion,setLayoutVersion]=useState(0);
  const [command,setCommand]=useState({seq:0,type:'fit'}),[viewStats,setViewStats]=useState({nodes:0,edges:0});
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
    if(mode==='workflow')return;
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
  const found=lookup.get(selectedId)??null;
  const selected=found && types.includes(found.type) ? found : null;
  const counts=useMemo(()=>Object.fromEntries(GRAPH_NODE_TYPES.map(t=>[t,data.nodes.filter(n=>n.type===t).length])),[data.nodes]);
  const suggestions=useMemo(()=>{
    const q=query.trim().toLowerCase();if(q.length<2)return [];
    return data.nodes.filter(n=>types.includes(n.type) && `${n.id} ${n.label}`.toLowerCase().includes(q)).slice(0,15);
  },[data.nodes,query,types]);
  const focus=useCallback(id=>{setRootId(id);setSelectedId(id);setMode('workflow');},[]);
  const searchPick=useCallback(node=>{
    setSelectedId(node.id);setQuery('');
    if(['Drug','ADR','HPO','Disease'].includes(node.type))focus(node.id);
    else{setMode('neighbors');issue('fit');}
  },[focus,issue]);
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
        <label className="kg-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm thuốc, gene, bệnh, ADR…" aria-label="Tìm kiếm node"/>
          {query&&<button aria-label="Xóa tìm kiếm" onClick={()=>setQuery('')}><X size={15}/></button>}</label>
        {suggestions.length>0&&<div className="kg-suggestions">{suggestions.map(n=><button key={n.id} onClick={()=>searchPick(n)}><span style={{color:NODE_COLORS[n.type]}}><NodeSymbol type={n.type} size={16}/></span><span><b>{n.label}</b><small>{NODE_LABELS[n.type]??n.type} · {n.id}</small></span></button>)}</div>}
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
          {[['workflow','Workflow: Drug → ADR'],['full','Full Network (Sigma.js)'],['neighbors','1-hop neighborhood']].map(([value,label])=><button key={value} className={`kg-mode ${mode===value?'active':''}`} onClick={()=>setMode(value)}><CircleDot size={16}/>{label}</button>)}
          <div className="kg-mode-tools"><button className="kg-btn kg-btn-small" onClick={()=>issue('zoomIn')}>Zoom +</button><button className="kg-btn kg-btn-small" onClick={()=>issue('zoomOut')}>Zoom −</button><button className="kg-btn kg-btn-small" onClick={()=>issue('fit')}>Fit</button></div>
          {mode!=='workflow'&&<><label className="kg-inline-check"><input type="checkbox" checked={showEdges} onChange={e=>setShowEdges(e.target.checked)}/> Show edges</label>
          <button className="kg-btn kg-btn-wide" onClick={()=>setLayoutVersion(v=>v+1)}><RefreshCw size={15}/> Re-layout network</button></>}
        </section>
      </aside>
      <div className="kg-center">
        <Pipeline types={types} data={data} rootId={rootId}/>
        <section ref={graphPanelRef} className={`kg-panel kg-graph-panel${fallbackFullscreen?' kg-fullscreen-fallback':''}`}>
          <div className="kg-graph-header"><span className="kg-title-mode"><Workflow size={18}/>{mode==='workflow'?'Drug → ADR Workflow':mode==='full'?'Full Network (Sigma.js)':'Neighborhood (Sigma.js)'}</span>
            <div className="kg-graph-actions">
              <span className="kg-view-meta">{mode==='workflow'?'Kéo node · Phóng to · Chọn node':'Kéo node · Kéo canvas · Nhấp node để xem quan hệ'}</span>
              <button type="button" className="kg-fullscreen-btn" onClick={toggleFullscreen}
                aria-label={isFullscreen?'Thoát toàn màn hình':'Phóng to toàn màn hình'} aria-pressed={isFullscreen}
                title={isFullscreen?'Thu nhỏ đồ thị (Esc)':'Phóng to đồ thị toàn màn hình'}>
                {isFullscreen?<Minimize2 size={17}/>:<Maximize2 size={17}/>}<span>{isFullscreen?'Thu nhỏ':'Toàn màn hình'}</span>
              </button>
            </div></div>
          <div className="kg-canvas-wrap">
            {mode==='workflow'?<DrugWorkflow data={data} rootId={rootId} types={types} onPick={selectFromCanvas} onFocus={focus} isFullscreen={isFullscreen}/>
              :<GraphNetwork data={data} types={types} mode={mode==='neighbors'?'neighbors':'full'} selectedId={selectedId}
                 onSelectNode={selectFromCanvas} command={command} onViewStats={setViewStats} showEdges={showEdges}
                 layoutVersion={layoutVersion} dragMode="node"/>}
          </div>
        </section>
        <Diagnostics diag={diag}/>
      </div>
      <aside className="kg-panel kg-right-panel"><h2><Eye size={19}/> Node inspector</h2><Inspector node={selected} data={data} onFocus={focus}/>
        <div className="kg-right-note"><AlertTriangle size={17}/> Không diễn giải các quan hệ kiểu hình hoặc thống kê là bằng chứng nhân quả nếu chưa được xác thực.</div>
      </aside>
    </div>
  </main>;
}
function NetworkSymbol({size=21}) {return <GitBranch size={size}/>;}
