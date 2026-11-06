/**
 * HPO-anchored exploration. The data are a multirelational KG, NOT a single
 * undirected connected component: following arbitrary edges from an HPO can
 * pull in almost the entire drug network via shared drugs and pathways.
 *
 * Only validated, typed API edges are traversed, in the specified direction.
 * Never synthesize ADR–Disease edges: both may be annotated to one phenotype,
 * but that overlap alone does not establish an ADR–Disease association.
 */
const TYPED_EDGES = Object.freeze({
  DiseaseHPO: ['Disease', 'HPO'],
  ADRHPO: ['ADR', 'HPO'],
  GeneDisease: ['KeggGene', 'Disease'],
  ProteinGene: ['Protein', 'KeggGene'],
  DrugProtein: ['Drug', 'Protein'],
  DrugADR: ['Drug', 'ADR'],
  GenePathway: ['KeggGene', 'Pathway'],
  GeneKeggDisease: ['KeggGene', 'KeggDisease'],
  GeneKeggNetwork: ['KeggGene', 'KeggNetwork'],
  GeneKeggDrugTarget: ['KeggGene', 'KeggDrugTarget'],
  GeneKeggElement: ['KeggGene', 'KeggElement'],
});
const EMPTY = Object.freeze([]);

export function normalizePhenotypeSearch(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd').toLowerCase().trim();
}

export function makePhenotypeIndex(data = {}) {
  const byId = new Map();
  const byTarget = new Map();
  const bySource = new Map();
  const hpos = [];
  for (const node of data.nodes ?? []) {
    if (!node?.id) continue;
    byId.set(String(node.id), node);
    if (node.type === 'HPO') {
      const metadata = node.original ?? {};
      const text = [node.label, node.id, metadata.hpo_id, metadata.database_id,
        metadata.hpo_name, metadata.synonyms, metadata.alt_id]
        .filter(value => value !== undefined && value !== null && typeof value !== 'object')
        .join(' ');
      hpos.push({ node, text: normalizePhenotypeSearch(text),
        label: normalizePhenotypeSearch(node.label), id: normalizePhenotypeSearch(node.id) });
    }
  }
  // Relations have a fixed, proven entity type at each endpoint.
  for (const edge of data.edges ?? []) {
    const expected = TYPED_EDGES[edge?.type];
    if (!expected) continue;
    const source = byId.get(String(edge.source));
    const target = byId.get(String(edge.target));
    if (!source || !target || source.type !== expected[0] || target.type !== expected[1]) continue;
    let src = bySource.get(edge.type);
    if (!src) { src = new Map(); bySource.set(edge.type, src); }
    let dst = byTarget.get(edge.type);
    if (!dst) { dst = new Map(); byTarget.set(edge.type, dst); }
    if (!src.has(edge.source)) src.set(edge.source, []);
    if (!dst.has(edge.target)) dst.set(edge.target, []);
    src.get(edge.source).push(edge);
    dst.get(edge.target).push(edge);
  }
  // Compute unique, *validated* ADR and MONDO Disease associations for each HPO.
  // Sorting this index once avoids repeatedly walking the entire edge array
  // when the user enables the ADR ∩ Disease filter or types a search query.
  const phenotypeStats = new Map();
  const sharedHpos = [];
  const overlappingHpoIds = new Set();
  for (const entry of hpos) {
    const id = entry.node.id;
    const adrCount = new Set((byTarget.get('ADRHPO')?.get(id) ?? EMPTY).map(edge => edge.source)).size;
    const diseaseCount = new Set((byTarget.get('DiseaseHPO')?.get(id) ?? EMPTY).map(edge => edge.source)).size;
    const shared = adrCount > 0 && diseaseCount > 0;
    const stats = { adrCount, diseaseCount, shared };
    phenotypeStats.set(id, stats);
    if (shared) { sharedHpos.push(entry); overlappingHpoIds.add(id); }
  }
  sharedHpos.sort((a, b) =>
    Math.min(phenotypeStats.get(b.node.id).adrCount, phenotypeStats.get(b.node.id).diseaseCount)
      - Math.min(phenotypeStats.get(a.node.id).adrCount, phenotypeStats.get(a.node.id).diseaseCount) ||
    (phenotypeStats.get(b.node.id).adrCount + phenotypeStats.get(b.node.id).diseaseCount)
      - (phenotypeStats.get(a.node.id).adrCount + phenotypeStats.get(a.node.id).diseaseCount) ||
    a.node.label.localeCompare(b.node.label)
  );
  return { byId, byTarget, bySource, hpos, phenotypeStats, sharedHpos, overlappingHpoIds };
}

function inbound(index, type, id) {
  return index.byTarget.get(type)?.get(id) ?? EMPTY;
}
function outbound(index, type, id) {
  return index.bySource.get(type)?.get(id) ?? EMPTY;
}

function scoreMatch(entry, q) {
  return entry.id === q || entry.label === q ? 0 :
    entry.id.startsWith(q) || entry.label.startsWith(q) ? 1 :
      entry.text.includes(` ${q}`) ? 2 : 3;
}
function decorateMatch(index, entry, score = 0) {
  return { node: entry.node, score, ...(index.phenotypeStats.get(entry.node.id) ?? {
    adrCount: 0, diseaseCount: 0, shared: false,
  }) };
}

export function searchPhenotypes(index, rawQuery, limit = 15) {
  const q = normalizePhenotypeSearch(rawQuery);
  if (!q) return [];
  const matches = [];
  for (const entry of index.hpos) {
    if (entry.text.includes(q)) matches.push(decorateMatch(index, entry, scoreMatch(entry, q)));
  }
  matches.sort((a, b) => a.score - b.score ||
    (b.adrCount + b.diseaseCount) - (a.adrCount + a.diseaseCount) ||
    a.node.label.localeCompare(b.node.label));
  return matches.slice(0, Math.max(0, limit));
}

/**
 * All HPO terms jointly annotated by >=1 ADR and >=1 MONDO Disease.
 * An intersection is at the phenotype node, never a fabricated ADR–Disease edge.
 * An empty query lists the most connected shared HPOs so the user can browse
 * immediately without needing to know a phenotype name in advance.
 */
export function listOverlappingPhenotypes(index, rawQuery = '', limit = 25) {
  const q = normalizePhenotypeSearch(rawQuery);
  const candidates = index.sharedHpos ?? EMPTY;
  const matches = q ? candidates.filter(entry => entry.text.includes(q)) : candidates;
  if (q) matches.sort((a, b) => scoreMatch(a, q) - scoreMatch(b, q) ||
    Math.min(index.phenotypeStats.get(b.node.id).adrCount, index.phenotypeStats.get(b.node.id).diseaseCount) -
      Math.min(index.phenotypeStats.get(a.node.id).adrCount, index.phenotypeStats.get(a.node.id).diseaseCount) ||
    a.node.label.localeCompare(b.node.label));
  return {
    total: matches.length,
    items: matches.slice(0, Math.max(0, limit)).map(entry => decorateMatch(index, entry, q ? scoreMatch(entry, q) : 0)),
  };
}

/**
 * scope:
 *  direct = only the HPO plus its direct ADR and Disease annotations.
 *  mechanism = both molecular branches anchored to this exact HPO:
 *    Disease <- Gene <- Protein <- Drug
 *    ADR <- Drug -> Protein -> Gene -> Pathway / KEGG annotations.
 *  overlap = the *same expanded evidence network* but ONLY if the HPO is
 *    annotated by at least one ADR AND one Disease. Intersection is at HPO;
 *    drug/protein/gene coincidences are inspectable, not causal claims.
 *
 * Every edge in the result is validated in the source KG. Never follow
 * a selected drug to an unrelated ADR, or a disease to an unrelated HPO.
 */
export function extractPhenotypeSubgraph(index, hpoId, scope = 'mechanism', types = null) {
  const root = index.byId.get(hpoId);
  if (!root || root.type !== 'HPO') return null;
  const chosen = new Set([hpoId]);
  const selectedEdges = new Map();
  const include = edge => {
    if (!edge) return;
    chosen.add(edge.source);
    chosen.add(edge.target);
    selectedEdges.set(String(edge.id), edge);
  };
  const getSources = (type, targets) => {
    const sources = new Set();
    for (const target of targets) for (const edge of inbound(index, type, target)) {
      include(edge);
      sources.add(edge.source);
    }
    return sources;
  };
  const diseases = getSources('DiseaseHPO', [hpoId]);
  const adrs = getSources('ADRHPO', [hpoId]);
  const directDiseaseEdges = inbound(index, 'DiseaseHPO', hpoId);
  const directAdrEdges = inbound(index, 'ADRHPO', hpoId);
  const isShared = diseases.size > 0 && adrs.size > 0;

  // A shared HPO is required for the intersection view. The direct and
  // mechanism scopes also support one-sided HPOs (no invented counterpart).
  if (scope === 'overlap' && !isShared) {
    chosen.clear();
    chosen.add(hpoId);
    selectedEdges.clear();
  } else if (scope === 'mechanism' || scope === 'overlap') {
    // Disease-side molecular context:
    // HPO <- Disease <- Gene <- Protein <- Drug
    const diseaseGenes = getSources('GeneDisease', diseases);
    const diseaseProteins = getSources('ProteinGene', diseaseGenes);
    const diseaseDrugs = getSources('DrugProtein', diseaseProteins);

    // ADR-side molecular context:
    // HPO <- ADR <- Drug -> Protein -> Gene -> Pathway
    // Note: targets/pathways on this branch describe a drug's known target
    // context, NOT a proven molecular mechanism for its reported ADR.
    const adrDrugs = getSources('DrugADR', adrs);
    const getTargets = (type, sources) => {
      const targets = new Set();
      for (const source of sources) for (const edge of outbound(index, type, source)) {
        include(edge);
        targets.add(edge.target);
      }
      return targets;
    };
    const adrProteins = getTargets('DrugProtein', adrDrugs);
    const adrGenes = getTargets('ProteinGene', adrProteins);
    const genes = new Set([...diseaseGenes, ...adrGenes]);

    // Annotate these discovered genes only. Do not expand into adjacent
    // Diseases, HPOs or unselected Drugs via the broader global network.
    for (const relation of [
      'GenePathway', 'GeneKeggDisease', 'GeneKeggNetwork',
      'GeneKeggDrugTarget', 'GeneKeggElement',
    ]) getTargets(relation, genes);

    // Include validated cross-links *between already selected endpoints*.
    // These reveal overlaps of the ADR-drug and disease-gene branches at
    // Drug / Protein / Gene, without traversing to unrelated entities.
    const drugIds = new Set([...diseaseDrugs, ...adrDrugs]);
    const proteins = new Set([...diseaseProteins, ...adrProteins]);
    for (const [type, sources] of [
      ['DrugADR', drugIds], ['DrugProtein', drugIds],
      ['ProteinGene', proteins], ['GeneDisease', genes],
    ]) {
      for (const source of sources) for (const edge of outbound(index, type, source)) {
        if (chosen.has(edge.target)) include(edge);
      }
    }
  }
  const allowed = types == null ? null : new Set(types);
  const visibleIds = allowed ? new Set([...chosen].filter(id => allowed.has(index.byId.get(id)?.type))) : chosen;
  const nodes = [...visibleIds].map(id => index.byId.get(id));
  const edges = [...selectedEdges.values()].filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
  const uniqueBySource = edges => [...new Set(edges.map(e => e.source))].map(id => index.byId.get(id)).filter(Boolean);
  return {
    nodes, edges, root, scope,
    // Raw evidence counts refer to validated edges, independent of checkboxes.
    summary: {
      adrNodes: uniqueBySource(directAdrEdges),
      diseaseNodes: uniqueBySource(directDiseaseEdges),
      adrEdges: directAdrEdges.length,
      diseaseEdges: directDiseaseEdges.length,
      shared: isShared,
      typeCounts: Object.fromEntries([...new Set(nodes.map(n => n.type))].map(type =>
        [type, nodes.filter(n => n.type === type).length])),
      visibleNodes: nodes.length, visibleEdges: edges.length,
      rootVisible: visibleIds.has(hpoId),
    },
  };
}
