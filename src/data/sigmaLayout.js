/**
 * Deterministic, dependency-free layout for Sigma.js.
 * This module intentionally has no DOM, browser, Sigma, or graphology imports.
 * It can execute inside a Vite module Worker OR synchronously on the main thread
 * when Workers are blocked/unsupported/fail to load.
 *
 * Only given graph edges contribute to adjacency. Coordinates do not express
 * pharmacological or causal relationships. Disconnected components never get
 * connected by an artificial edge.
 */
const TWO_PI = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function stableHash(value) {
  let h = 2166136261;
  for (const ch of String(value)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function makeIsland(ids, coordinates, kind) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const id of ids) {
    const p = coordinates.get(id);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  for (const id of ids) {
    const p = coordinates.get(id);
    coordinates.set(id, { x: p.x - centerX, y: p.y - centerY });
  }
  return {
    ids, coordinates, kind,
    // Half-diagonal: enclosing circle of all node centers, plus border clearance.
    radius: Math.max(28, Math.hypot(maxX - minX, maxY - minY) / 2 + 25),
  };
}

/** Each large connected component becomes one independently arranged island. */
function arrangeConnected(ids, adjacency, degrees) {
  const coord = new Map();
  if (ids.length === 2) {
    coord.set(ids[0], { x: -25, y: 0 });
    coord.set(ids[1], { x: 25, y: 0 });
  } else if (ids.length <= 7) {
    const radius = Math.max(35, (ids.length * 22) / TWO_PI);
    ids.forEach((id, i) => {
      const angle = TWO_PI * i / ids.length;
      coord.set(id, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
    });
  } else {
    // Breadth-first rings preserve topological distance without slow force passes.
    // Deterministic sorting keeps the layout stable when filters change.
    const root = [...ids].sort((a, b) =>
      (degrees.get(b) || 0) - (degrees.get(a) || 0) || a.localeCompare(b))[0];
    const queue = [root];
    const distance = new Map([[root, 0]]);
    for (let idx = 0; idx < queue.length; idx++) {
      const id = queue[idx];
      for (const next of adjacency.get(id) || []) {
        if (distance.has(next)) continue;
        distance.set(next, distance.get(id) + 1);
        queue.push(next);
      }
    }
    const rings = new Map();
    for (const id of ids) {
      const d = distance.get(id) ?? 0;
      if (!rings.has(d)) rings.set(d, []);
      rings.get(d).push(id);
    }
    let previousRadius = 0;
    for (const d of [...rings.keys()].sort((a, b) => a - b)) {
      const bucket = rings.get(d).sort((a, b) => a.localeCompare(b));
      if (d === 0) {
        coord.set(bucket[0], { x: 0, y: 0 });
        continue;
      }
      // Both radial clearance and circumferential separation are guaranteed.
      const radius = Math.max(previousRadius + 43, (bucket.length * 25) / TWO_PI, 43);
      const offset = (stableHash(`ring:${root}:${d}`) % 1000) / 1000 * TWO_PI;
      bucket.forEach((id, index) => {
        const theta = offset + TWO_PI * index / bucket.length;
        coord.set(id, { x: radius * Math.cos(theta), y: radius * Math.sin(theta) });
      });
      previousRadius = radius;
    }
  }
  return makeIsland(ids, coord, 'connected');
}

/**
 * @param {{nodes:Array<{id:string,type?:string,size?:number}>,edges:Array<{source:string,target:string}>}} input
 * @returns {{positions:Array<{id:string,x:number,y:number}>, movableComponents:string[][],componentCount:number,islandCount:number,algorithm:string}}
 */
export function calculateSigmaLayout(input = {}) {
  const rawNodes = Array.isArray(input.nodes) ? input.nodes : [];
  const rawEdges = Array.isArray(input.edges) ? input.edges : [];
  const byId = new Map();
  for (const node of rawNodes) {
    if (!node || node.id == null) continue;
    const id = String(node.id);
    if (!byId.has(id)) byId.set(id, { ...node, id });
  }
  if (!byId.size) {
    return { positions: [], movableComponents: [], componentCount: 0, islandCount: 0, algorithm: 'bfs-islands' };
  }

  const parent = new Map([...byId.keys()].map(id => [id, id]));
  const size = new Map([...byId.keys()].map(id => [id, 1]));
  const adjacency = new Map([...byId.keys()].map(id => [id, []]));
  const degrees = new Map([...byId.keys()].map(id => [id, 0]));
  const find = (id) => {
    let p = id;
    while (parent.get(p) !== p) p = parent.get(p);
    while (parent.get(id) !== id) {
      const next = parent.get(id);
      parent.set(id, p);
      id = next;
    }
    return p;
  };
  for (const edge of rawEdges) {
    if (!edge || edge.source == null || edge.target == null) continue;
    const a = String(edge.source), b = String(edge.target);
    if (!byId.has(a) || !byId.has(b) || a === b) continue;
    adjacency.get(a).push(b);
    adjacency.get(b).push(a);
    degrees.set(a, degrees.get(a) + 1);
    degrees.set(b, degrees.get(b) + 1);
    let pa = find(a), pb = find(b);
    if (pa !== pb) {
      if (size.get(pa) < size.get(pb)) [pa, pb] = [pb, pa];
      parent.set(pb, pa);
      size.set(pa, size.get(pa) + size.get(pb));
    }
  }

  const components = new Map();
  for (const id of byId.keys()) {
    const root = find(id);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(id);
  }
  const movableComponents = [];
  const singletonBuckets = new Map();
  const islands = [];
  for (const ids of components.values()) {
    if (ids.length === 1) {
      const type = byId.get(ids[0]).type || 'Other';
      if (!singletonBuckets.has(type)) singletonBuckets.set(type, []);
      singletonBuckets.get(type).push(ids[0]);
    } else {
      movableComponents.push(ids);
      islands.push(arrangeConnected(ids, adjacency, degrees));
    }
  }
  // Disconnected singletons are *visually* grouped by type, not connected.
  for (const [type, ids] of singletonBuckets) {
    const coord = new Map();
    ids.sort((a, b) => a.localeCompare(b));
    ids.forEach((id, i) => {
      const angle = i * GOLDEN_ANGLE;
      const radius = 23 * Math.sqrt(i + 0.4);
      coord.set(id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    });
    islands.push(makeIsland(ids, coord, `isolated:${type}`));
  }

  islands.sort((a, b) => b.radius - a.radius || a.kind.localeCompare(b.kind));
  // Nonoverlapping shelf-packing runs in O(islands + nodes), avoiding O(n²)
  // island intersection checks on graphs with thousands of components.
  const totalArea = islands.reduce((sum, c) => sum + (2 * c.radius + 35) ** 2, 0);
  const largestDiameter = islands.length ? 2 * islands[0].radius : 0;
  const shelfWidth = Math.max(900, largestDiameter + 35, Math.sqrt(totalArea) * 1.35);
  let x = 0, y = 0, rowHeight = 0;
  const positions = [];
  for (const island of islands) {
    const extent = 2 * island.radius + 35;
    if (x && x + extent > shelfWidth) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    const centerX = x + island.radius + 17.5;
    const centerY = y + island.radius + 17.5;
    for (const id of island.ids) {
      const p = island.coordinates.get(id);
      positions.push({ id, x: centerX + p.x, y: centerY + p.y });
    }
    x += extent;
    rowHeight = Math.max(rowHeight, extent);
  }
  return {
    positions,
    movableComponents,
    componentCount: components.size,
    islandCount: islands.length,
    algorithm: 'bfs-islands',
  };
}
