export type CharacterId = 'mira' | 'tom' | 'ben';
export type ClaimId = 'stole' | 'gaveTo';
export type PlaceId = 'bakery' | 'square' | 'house' | 'cottage';
export type Source = CharacterId | 'stranger' | 'saw' | 'noticed';
export type SpeechAct = 'gossip' | 'confront' | 'deny' | 'explain' | 'defend' | 'doubt' | 'agree' | 'reconcile';
export type Action = SpeechAct | 'routine';
export interface Claim {
  id: ClaimId; kind: ClaimId; about: 'tom'; object: 'bread'; target?: 'ada';
  text: string; harmful: boolean;
}
export interface Hop { source: Source; tick: number }
export interface Provenance {
  source: Source; tick: number; delta: number;
  origin: string; chain: Hop[]; independent: boolean;
  kind: 'hearsay' | 'firsthand' | 'familiarity' | 'correction';
}
export interface Belief {
  logOdds: number; confidence: number; unsupported: number;
  exposures: number; familiarity: number; provenance: Provenance[];
}
export interface Decision { tick: number; action: Action; why: string; score: number }
export interface Character {
  id: CharacterId; place: PlaceId;
  beliefs: Record<ClaimId, Belief>;
  trust: Record<CharacterId | 'stranger', number>;
  affinity: Record<CharacterId, number>;
  decisions: Decision[]; lastSpeech: number;
  told: Record<string, number>;
  accusations: Partial<Record<CharacterId, number>>;
  confronted: boolean; reconciled: boolean;
}
export interface Intervention { t: number; to: CharacterId; claim: ClaimId }
export interface ShareState { v: 1; seed: number; witness: boolean; interventions: Intervention[] }
export interface StoryEvent {
  id: number; tick: number; kind: 'move' | 'fact' | 'speech' | 'whisper' | 'outcome';
  text: string; actor?: CharacterId; to?: CharacterId; place?: PlaceId;
  act?: SpeechAct; claim?: ClaimId; why?: string;
  transmits?: boolean;
  beliefLink?: { character: CharacterId; claim: ClaimId; confidence: number; provenanceCount: number };
}
export interface World {
  tick: number; characters: Record<CharacterId, Character>;
  events: StoryEvent[]; outcome: string; randomState: number; config: ShareState;
}
