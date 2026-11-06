import {Pill,Dna,GitBranch,HeartPulse,Activity,UserRound,TriangleAlert,Network,FlaskConical} from 'lucide-react';

const ICONS={
  Drug:Pill,Protein:Network,KeggGene:Dna,Pathway:GitBranch,Disease:HeartPulse,
  HPO:UserRound,ADR:TriangleAlert,KeggDisease:HeartPulse,
  KeggNetwork:Activity,KeggDrugTarget:FlaskConical,KeggElement:Activity,
};

export function NodeSymbol({type,size=19}) {
  const Icon=ICONS[type]??Activity;
  return <Icon size={size} strokeWidth={2.1} aria-hidden="true"/>;
}
