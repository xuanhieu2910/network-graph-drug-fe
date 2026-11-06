import { useEffect, useMemo, useRef, useState } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import { calculateSigmaLayout } from "../data/sigmaLayout.js";
import { NODE_COLORS } from "../config/graphConfig";
import "../css/GraphNetwork.css";

const EMPTY_ARRAY = [];
const asId = (value) => String(value);
const getColor = (type) => NODE_COLORS[type] || "#94A3B8";

/**
 * Compatible with GraphPage:
 * data, types, mode, selectedId, onSelectNode, command, onViewStats,
 * dragMode, showEdges, layoutVersion.
 *
 * Requires Sigma.js v4 and Vite's module Web Worker support.
 */
export default function GraphNetwork({
  data,
  types = EMPTY_ARRAY,
  mode = "full",
  selectedId = null,
  onSelectNode,
  command,
  onViewStats,
  dragMode = "node",
  showEdges = true,
  layoutVersion = 0,
}) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const dragModeRef = useRef(dragMode);
  const selectedIdRef = useRef(selectedId);
  const showEdgesRef = useRef(showEdges);
  const selectRef = useRef(onSelectNode);
  const statsRef = useRef(onViewStats);
  const commandRef = useRef(command);
  const [busy, setBusy] = useState(false);
  const [layoutError, setLayoutError] = useState("");
  const [layoutInfo, setLayoutInfo] = useState(null);

  dragModeRef.current = dragMode;
  selectedIdRef.current = selectedId;
  showEdgesRef.current = showEdges;
  selectRef.current = onSelectNode;
  statsRef.current = onViewStats;
  commandRef.current = command;

  // Changing selection in FULL mode must not recompute the entire layout.
  const neighborhoodId = mode === "neighbors" ? selectedId : null;
  const prepared = useMemo(() => {
    const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
    const edges = Array.isArray(data?.edges) ? data.edges : [];
    const allowed = new Set(types);
    const validNodes = nodes.filter((n) => n && n.id != null && allowed.has(n.type));
    const validIds = new Set(validNodes.map((n) => asId(n.id)));
    const focus = neighborhoodId == null ? null : asId(neighborhoodId);

    let ids = validIds;
    if (mode === "neighbors") {
      ids = new Set();
      if (focus !== null && validIds.has(focus)) {
        ids.add(focus);
        for (const edge of edges) {
          if (edge?.source == null || edge?.target == null) continue;
          const a = asId(edge.source);
          const b = asId(edge.target);
          if (a === focus && validIds.has(b)) ids.add(b);
          if (b === focus && validIds.has(a)) ids.add(a);
        }
      }
    }

    const visibleNodes = validNodes.filter((n) => ids.has(asId(n.id)));
    const visibleEdges = edges.filter((e) =>
      e && e.source != null && e.target != null &&
      ids.has(asId(e.source)) && ids.has(asId(e.target)),
    );
    const degrees = new Map();
    for (const edge of visibleEdges) {
      const a = asId(edge.source);
      const b = asId(edge.target);
      degrees.set(a, (degrees.get(a) || 0) + 1);
      degrees.set(b, (degrees.get(b) || 0) + 1);
    }
    const packedNodes = visibleNodes.map((n) => ({
      id: asId(n.id),
      label: String(n.label ?? n.name ?? n.id),
      type: n.type,
      size: Math.min(7.5, 2.8 + Math.log2((degrees.get(asId(n.id)) || 0) + 1) * 0.65),
    }));
    return {
      nodes: packedNodes,
      edges: visibleEdges.map((e) => ({ source: asId(e.source), target: asId(e.target) })),
    };
  }, [data?.nodes, data?.edges, types, mode, neighborhoodId]);

  useEffect(() => {
    statsRef.current?.({ nodes: prepared.nodes.length, edges: prepared.edges.length });
  }, [prepared]);

  // Prefer the light Worker; render with a dependency-free synchronous fallback
  // if Worker loading, execution, timeout, or structured messages fail.
  useEffect(() => {
    const container = containerRef.current;
    if (rendererRef.current) {
      rendererRef.current.observer?.disconnect();
      rendererRef.current.sigma.kill();
      rendererRef.current = null;
    }
    setLayoutError("");
    setLayoutInfo(null);
    if (!container || !prepared.nodes.length) {
      setBusy(false);
      return undefined;
    }

    let disposed = false;
    let completed = false;
    let worker = null;
    let watchdog = null;
    setBusy(true);

    const stopWorker = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = null;
      if (worker) worker.terminate();
      worker = null;
    };

    const renderPositions = (result, viaFallback = false) => {
      if (disposed || completed) return;
      // Reject malformed results rather than constructing a silent blank canvas.
      if (!Array.isArray(result?.positions) || result.positions.length !== prepared.nodes.length) {
        if (!viaFallback) { fallback("Invalid layout worker response"); return; }
        setLayoutError("Layout response has missing node coordinates.");
        setBusy(false);
        return;
      }
      const positions = new Map(result.positions.map(p => [String(p.id), p]));
      if (prepared.nodes.some(n => !positions.has(n.id) ||
        !Number.isFinite(positions.get(n.id).x) || !Number.isFinite(positions.get(n.id).y))) {
        if (!viaFallback) { fallback("Layout positions contain invalid coordinates"); return; }
        setLayoutError("Layout contains invalid node coordinates.");
        setBusy(false);
        return;
      }
      completed = true;
      stopWorker();
      try {
        const memberMap = new Map();
        for (const component of result.movableComponents || []) {
          for (const id of component) memberMap.set(id, component);
        }
        const graph = new Graph({ type: "mixed", multi: true, allowSelfLoops: true });
        for (const n of prepared.nodes) {
          const p = positions.get(n.id);
          graph.addNode(n.id, {
            x: p.x, y: p.y, size: n.size, baseSize: n.size,
            label: n.label, baseLabel: n.label,
            color: getColor(n.type), baseColor: getColor(n.type), type: n.type,
          });
        }
        prepared.edges.forEach((edge, i) => {
          if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
            graph.addDirectedEdgeWithKey(`edge-${i}`, edge.source, edge.target, {
              size: 0.55, color: "#CDD7E5",
            });
          }
        });

        // These nested settings match Sigma v4's current constructor API.
        const sigma = new Sigma(graph, container, {
          settings: {
            autoRescale: "once",
            autoRescaleContent: "nodes",
            itemSizesReference: "positions",
            enableNodeDrag: true,
            getDraggedNodes: id =>
              dragModeRef.current === "component" ? memberMap.get(id) || [id] : [id],
            renderEdgeLabels: false,
            labelDensity: 0.25,
            labelRenderedSizeThreshold: 9,
            stagePadding: 50,
            enableEdgeEvents: false,
            hideLabelsOnMove: true,
            hideEdgesOnMove: graph.size > 12000,
          },
        });
        sigma.on("clickNode", ({ node }) => selectRef.current?.(node));
        sigma.on("clickStage", () => selectRef.current?.(null));
        const observer = typeof ResizeObserver === "function"
          ? new ResizeObserver(() => { if (!disposed) sigma.resize(); })
          : null;
        observer?.observe(container);
        rendererRef.current = { sigma, graph, observer };
        applyPresentation(graph, selectedIdRef.current, showEdgesRef.current);
        setLayoutInfo({
          components: result.componentCount, islands: result.islandCount,
          fallback: viaFallback,
        });
        setBusy(false);
        if (commandRef.current?.type === "zoomIn" || commandRef.current?.type === "zoomOut") {
          executeCommand(sigma, commandRef.current);
        }
      } catch (err) {
        setLayoutError(`Sigma.js render error: ${err?.message || String(err)}`);
        setBusy(false);
      }
    };

    // Defined as a function declaration so renderPositions can invoke it.
    function fallback(reason) {
      if (disposed || completed) return;
      console.warn("[Drug Network Explorer] Sigma layout worker unavailable; using fallback:", reason);
      stopWorker();
      try {
        renderPositions(calculateSigmaLayout(prepared), true);
      } catch (error) {
        completed = true;
        setLayoutError(`Worker and fallback layout failed: ${error?.message || String(error)}`);
        setBusy(false);
      }
    }

    try {
      worker = new Worker(new URL("./graphLayout.worker.js", import.meta.url), { type: "module" });
      worker.onerror = event => {
        event.preventDefault?.();
        fallback(event.message || "Worker script failed to load or execute");
      };
      worker.onmessageerror = () => fallback("Worker response could not be decoded");
      worker.onmessage = ({ data: result }) => {
        if (disposed || completed) return;
        if (result?.error) { fallback(result.error); return; }
        renderPositions(result);
      };
      worker.postMessage(prepared);
      // Covers Workers hanging without reporting an error.
      watchdog = setTimeout(() => fallback("Worker did not respond in 8 seconds"), 8000);
    } catch (error) {
      fallback(error?.message || String(error));
    }

    return () => {
      disposed = true;
      stopWorker();
      if (rendererRef.current) {
        rendererRef.current.observer?.disconnect();
        rendererRef.current.sigma.kill();
        rendererRef.current = null;
      }
    };
  }, [prepared, layoutVersion]);

  useEffect(() => {
    const current = rendererRef.current;
    if (current) applyPresentation(current.graph, selectedId, showEdges);
  }, [selectedId, showEdges]);

  useEffect(() => {
    if (rendererRef.current) executeCommand(rendererRef.current.sigma, command);
  }, [command]);

  return (
    <div className="kg-sigma-root">
      <div className="kg-sigma-canvas" ref={containerRef} aria-label="Interactive Drug ADR knowledge graph" />
      {busy && <div className="kg-sigma-status" role="status"><span className="kg-sigma-spinner" /> Calculating separated graph layout…</div>}
      {!busy && layoutError && <div className="kg-sigma-status kg-sigma-error" role="alert">{layoutError}</div>}
      {!busy && layoutInfo && <div className="kg-sigma-metadata">{layoutInfo.components.toLocaleString()} connected components · {layoutInfo.islands.toLocaleString()} layout groups{layoutInfo.fallback ? " · Safe fallback layout" : ""}</div>}
    </div>
  );
}

function applyPresentation(graph, selectedId, showEdges) {
  const selected = selectedId != null && graph.hasNode(String(selectedId)) ? String(selectedId) : null;
  const neighborhood = selected ? new Set([selected, ...graph.neighbors(selected)]) : null;

  graph.updateEachNodeAttributes((id, attrs) => ({
    ...attrs,
    color: !selected || neighborhood.has(id) ? attrs.baseColor : "#D9E2EE",
    label: !selected || neighborhood.has(id) ? attrs.baseLabel : "",
    size: id === selected ? attrs.baseSize * 1.6 : attrs.baseSize,
  }));
  graph.updateEachEdgeAttributes((_key, attrs, source, target) => ({
    ...attrs,
    hidden: !showEdges,
    color: !selected ? "#C8D4E2" :
      source === selected || target === selected ? "#6A91CA" : "#E4EAF3",
    size: selected && (source === selected || target === selected) ? 1.2 : 0.5,
  }));
}

function executeCommand(sigma, command) {
  if (!command) return;
  const camera = sigma.getCamera();
  switch (command.type) {
    case "fit":
      camera.reset({ duration: 280 });
      break;
    case "zoomIn":
      camera.zoomIn({ factor: 1.4, duration: 220 });
      break;
    case "zoomOut":
      camera.zoomOut({ factor: 1.4, duration: 220 });
      break;
    default:
      break;
  }
}
