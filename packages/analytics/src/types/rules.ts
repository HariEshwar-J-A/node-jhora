export type YogaCategory = 'Raja' | 'Dhana' | 'Nabhasa' | 'Arishta' | 'Parivartana';

export type Condition =
  | { type: 'placement'; planet: string; houses: number[]; signs?: number[]; from?: 'Lagna' | 'Moon' | 'Sun' }
  | { type: 'lordship'; lordOf: number; placedIn: number[]; from?: 'Lagna' | 'Moon' }
  | { type: 'conjunction'; planets: string[]; minOrb?: number }
  | { type: 'aspect'; aspector: string; target: string | number; kind: 'graha' | 'rashi' }
  | { type: 'strength'; planet: string; minShadbala: number }
  | { type: 'distance'; planet: string; from: string; range: [number, number] };

export interface YogaDef {
  key: string;
  name: string;
  category: YogaCategory;
  conditions: Condition[];
  description_template: string;
}

export interface YogaResult {
  yoga: YogaDef;
  triggeringPlanets: string[];
  strength?: number;
}
