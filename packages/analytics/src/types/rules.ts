export type YogaCategory = 'Raja' | 'Dhana' | 'Nabhasa' | 'Arishta';

export interface PlacementCondition { type: 'placement'; planet: string; house?: number[]; sign?: number[]; inOwnSign?: boolean; inExaltation?: boolean; relativeTo?: string; }
export interface LordshipCondition { type: 'lordship'; lordOf: number; placedIn: number; }
export interface ConjunctionCondition { type: 'conjunction'; planets: string[]; }
export interface AspectCondition { type: 'aspect'; from: string; to: string; kind?: 'graha'|'rashi'; }
export interface StrengthCondition { type: 'strength'; planet: string; minShadbala: number; }
export interface DistanceCondition { type: 'distance'; from: string; to: string; minHouse: number; maxHouse: number; }

export type Condition = 
  | PlacementCondition
  | LordshipCondition
  | ConjunctionCondition
  | AspectCondition
  | StrengthCondition
  | DistanceCondition;

export interface YogaDefinition {
  id: string; // Added per prompt
  name: string;
  group: YogaCategory; // Renamed category -> group per prompt
  conditions: Condition[];
  interpretation_key: string; // Added per prompt
}
