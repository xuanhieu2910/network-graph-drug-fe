/** Graph entities match the uploaded Python models; never conflate KEGG Disease and MONDO. */
export const NODE_TYPES = Object.freeze({
  DRUG: "Drug", PROTEIN: "Protein", KEGG_GENE: "KeggGene",
  PATHWAY: "Pathway", DISEASE: "Disease", HPO: "HPO", ADR: "ADR",
  KEGG_DISEASE: "KeggDisease", KEGG_NETWORK: "KeggNetwork",
  KEGG_DRUG_TARGET: "KeggDrugTarget", KEGG_ELEMENT: "KeggElement",
});
export const EDGE_TYPES = Object.freeze({
  DRUG_PROTEIN: "DrugProtein", PROTEIN_GENE: "ProteinGene",
  GENE_PATHWAY: "GenePathway", GENE_DISEASE: "GeneDisease",
  DISEASE_HPO: "DiseaseHPO", DRUG_ADR: "DrugADR", ADR_HPO: "ADRHPO", GENE_KEGG_DISEASE: "GeneKeggDisease",
  GENE_KEGG_NETWORK: "GeneKeggNetwork",
  GENE_KEGG_DRUG_TARGET: "GeneKeggDrugTarget",
  GENE_KEGG_ELEMENT: "GeneKeggElement",
});
export const NODE_LABELS = Object.freeze({
  Drug: "Drug", Protein: "Protein", KeggGene: "KEGG Gene", Pathway: "Pathway",
  Disease: "MONDO Disease", HPO: "HPO Phenotype", ADR: "ADR LLT (MedDRA)",
  KeggDisease: "KEGG Disease", KeggNetwork: "KEGG Network",
  KeggDrugTarget: "KEGG Drug Target", KeggElement: "KEGG Element",
});
export const NODE_COLORS = Object.freeze({
  Drug: "#1487f5", Protein: "#9664f4", KeggGene: "#23c9ab",
  Pathway: "#f6b91b", Disease: "#fa658c", HPO: "#12b0cd",
  ADR: "#cf489c", KeggDisease: "#e87d66", KeggNetwork: "#506fe8",
  KeggDrugTarget: "#b27a40", KeggElement: "#7da33a",
});
export const EDGE_COLORS = Object.freeze({
  DrugProtein: "#7d96bc", ProteinGene: "#7d96bc",
  GenePathway: "#97a8bd", GeneDisease: "#c8a1ad",
  DiseaseHPO: "#93b7c2", DrugADR: "#d88ab5", ADRHPO: "#b18ec6", GeneKeggDisease: "#d5a3a0",
  GeneKeggNetwork: "#a6a7d3", GeneKeggDrugTarget: "#bcaa98",
  GeneKeggElement: "#a5b98b",
});
export const EDGE_LABELS = Object.freeze({
  DrugProtein: "Drug → Protein (DrugProtein)",
  ProteinGene: "Protein → KEGG Gene (UnitProteinKeggGene)",
  GenePathway: "KEGG Gene → Pathway (KeggPathway)",
  GeneDisease: "KEGG Gene → MONDO Disease (HumanGenDisease)",
  DiseaseHPO: "MONDO Disease → HPO (MondoHumanPhenotype)",
  DrugADR: "Drug → ADR (DrugAdrLlt)",
  ADRHPO: "ADR → HPO mapping (AdrHpo)",
  GeneKeggDisease: "KEGG Gene → KEGG Disease (KeggDisease)",
  GeneKeggNetwork: "KEGG Gene → KEGG Network (KeggNetwork)",
  GeneKeggDrugTarget: "KEGG Gene → KEGG Drug Target (KeggDrugTarget)",
  GeneKeggElement: "KEGG Gene → KEGG Element (KeggElement)",
});
export const GRAPH_NODE_TYPES = Object.values(NODE_TYPES);
