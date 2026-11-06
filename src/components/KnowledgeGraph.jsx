import { useEffect, useMemo, useRef } from "react";
import { MultiDirectedGraph } from "graphology";
import Sigma from "sigma";
import { NODE_COLORS, EDGE_COLORS, GRAPH_NODE_TYPES } from "../config/graphConfig";

function buildFullGraph(data) {
  const graph = new MultiDirectedGraph();
  for (const node of data?.nodes ?? []) {
    if (!node.id || graph.hasNode(node.id)) continue;
    graph.addNode(node.id, {
      x: Number.isFinite(node.x) ? node.x : 0,
      y: Number.isFinite(node.y) ? node.y : 0,
      size: 2.5,
      label: node.label || node.id,
      labelColor: "#172b4d",
      color: node.color ?? NODE_COLORS[node.type] ?? "#94a3b8",
      type: node.type,
    });
  }
  for (const edge of data?.edges ?? []) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;
    const id = String(edge.id);
    if (graph.hasEdge(id)) continue;
    graph.addDirectedEdgeWithKey(id, edge.source, edge.target, {
      label: edge.relation ?? "",
      type: edge.type,
      size: 0.7,
      color: EDGE_COLORS[edge.type] ?? "#afbdd1",
      opacity: 0.68,
    });
  }
  // Use visual size to hint at relational connectivity, without implying evidence.
  graph.forEachNode((id) => {
    const degree = graph.degree(id);
    graph.setNodeAttribute(id, "size", Math.min(8.7, 2.4 + 1.55 * Math.log2(1 + degree)));
  });
  return graph;
}

function buildVisibleGraph(graph, types, mode, selectedId) {
  const enabled = new Set(types);
  if (mode === "full" && GRAPH_NODE_TYPES.every(t => enabled.has(t))) {
    return graph;
  }
  const allowed = new Set();
  if (mode === "neighbors" && selectedId && graph.hasNode(selectedId)) {
    allowed.add(selectedId);
    for (const neighbor of graph.neighbors(selectedId)) allowed.add(neighbor);
  }
  const view = new MultiDirectedGraph();
  graph.forEachNode((id, attrs) => {
    if (mode === "neighbors" && !allowed.has(id)) return;
    if (id !== selectedId && !enabled.has(attrs.type)) return;
    view.addNode(id, attrs);
  });
  graph.forEachEdge((id, attrs, source, target) => {
    if (view.hasNode(source) && view.hasNode(target)) {
      view.addDirectedEdgeWithKey(id, source, target, attrs);
    }
  });
  return view;
}

/**
 * React wrapper around the official Sigma.js v4 renderer (not @react-sigma/core).
 * @param {{data:object, types:string[], mode:string, selectedId:string|null,
 * onSelectNode:(id:string|null)=>void, command:object, onViewStats:(stats:object)=>void}} props
 */
export default function KnowledgeGraph({
  data, types, mode, selectedId, onSelectNode, command, onViewStats,
}) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const callbackRef = useRef(onSelectNode);
  const selectedRef = useRef(selectedId);
  callbackRef.current = onSelectNode;
  selectedRef.current = selectedId;

  const fullGraph = useMemo(() => buildFullGraph(data), [data]);
  const activeSelection = mode === "neighbors" ? selectedId : null;
  const visibleGraph = useMemo(
    () => buildVisibleGraph(fullGraph, types, mode, activeSelection),
    [fullGraph, types, mode, activeSelection]
  );

  useEffect(() => {
    if (!containerRef.current || fullGraph.order === 0) return;
    const renderer = new Sigma(fullGraph, containerRef.current, {
      settings: {
        renderLabels: fullGraph.order <= 1200,
        renderEdgeLabels: false,
        enableEdgeEvents: false,
        hideEdgesOnMove: fullGraph.size >= 5000,
        labelDensity: 0.5,
        labelRenderedSizeThreshold: 7,
        nodeLabelEvents: "extend",
        itemSizesReference: "screen",
        minCameraRatio: 0.015,
        maxCameraRatio: 12,
      },
      nodeReducer: (key, _data, attrs) => {
        if (selectedRef.current !== key) return {};
        return { size: 9.7, labelVisibility: "visible", zIndex: 1000 };
      },
    });
    rendererRef.current = renderer;
    const clickNode = ({ node }) => callbackRef.current(node);
    const clickStage = () => callbackRef.current(null);
    renderer.on("clickNode", clickNode);
    renderer.on("clickStage", clickStage);

    return () => {
      renderer.off("clickNode", clickNode);
      renderer.off("clickStage", clickStage);
      renderer.kill();
      rendererRef.current = null;
    };
  }, [fullGraph]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) {
      onViewStats({ nodes: visibleGraph.order, edges: visibleGraph.size });
      return;
    }
    if (renderer.getGraph() !== visibleGraph) {
      renderer.setGraph(visibleGraph); // An empty filter must hide previous nodes too.
      if (visibleGraph.order > 0) renderer.getCamera().reset();
    }
    renderer.setSettings({
      renderLabels: visibleGraph.order <= 1200,
      hideEdgesOnMove: visibleGraph.size >= 5000,
    });
    onViewStats({ nodes: visibleGraph.order, edges: visibleGraph.size });
  }, [visibleGraph, onViewStats]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.refresh({ skipIndexation: true });
  }, [selectedId]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !command?.seq) return;
    const camera = renderer.getCamera();
    if (command.type === "fit") camera.reset();
    if (command.type === "zoomIn") camera.zoomIn();
    if (command.type === "zoomOut") camera.zoomOut();
    if (command.type === "center" && command.nodeId && visibleGraph.hasNode(command.nodeId)) {
      const position = renderer.getNodeDisplayData(command.nodeId);
      if (position) {
        camera.animate({ x: position.x, y: position.y, ratio: Math.min(camera.getState().ratio, 0.22) }, { duration: 350 });
      }
    }
  }, [command, visibleGraph]);

  return (
    <div className="kg-graph-wrapper">
      <div className="kg-sigma-stage" ref={containerRef} />
      {visibleGraph.order === 0 && (
        <div className="kg-empty-graph">
          No nodes for this view. Choose more types or select Full Network.
        </div>
      )}
    </div>
  );
}
