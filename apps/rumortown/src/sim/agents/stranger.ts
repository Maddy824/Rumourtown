/** The player's avatar: a visible stranger who whispers claims and is trusted less each time one falls apart. */
import type { ClaimId } from 'rumormind';
import type { Dossier, LineKey, VillagerId } from '../types.js';
import { agentOf, emit, nameOf, strangerClaimOf, type Ctx } from './context.js';
import { hearFromStranger } from './hearing.js';
import { BUBBLE_TICKS, IMPORTANCE, WHISPER_RANGE } from './params.js';
import { remember } from './reflection.js';
import { STRANGER_ID } from './text.js';
import { whisperWitnesses } from './witness.js';

/** A stand-in dossier so line keys can address the stranger. */
export const STRANGER: Dossier = {
  id: STRANGER_ID,
  name: 'the stranger',
  pronouns: { subject: 'they', object: 'them', possessive: 'their' },
  age: 30,
  role: 'stranger',
  tier: 'background',
  communities: [],
  home: 'square',
  workplace: 'square',
  traits: { honesty: 0.5, emotionality: 0.5, extraversion: 0.5, agreeableness: 0.5, conscientiousness: 0.5, openness: 0.5 },
  closeTo: [],
  secrets: [],
  schedule: [{ start: 0, place: 'square', activity: 'idle' }],
  look: { body: 'slight', skin: '#D9A077', hair: { style: 'short', color: '#2E2A22' }, hat: 'hood', top: '#5C4B7A', bottom: '#2E2A22', prop: 'none' },
  voice: 'Quiet. Asks more than tells.',
};

/**
 * Whisper a claim to a villager. Needs the player within two tiles unless `force` (a replayed
 * intervention, which also puts the stranger beside the listener). Returns false when refused.
 */
export function whisper(ctx: Ctx, listenerId: VillagerId, claimId: ClaimId, force: boolean): boolean {
  const listener = agentOf(ctx, listenerId);
  const claim = ctx.claims.get(claimId);
  if (!listener || !claim || claim.about === listenerId) return false;
  const player = ctx.player.mover;
  if (!force && ctx.world.distance(player.pos, listener.mover.pos) > WHISPER_RANGE) return false;
  if (force) {
    player.stop();
    player.pos.x = listener.mover.pos.x;
    player.pos.y = listener.mover.pos.y;
  }

  const existing = strangerClaimOf(ctx, claim.id);
  if (existing) existing.heardBy.add(listenerId);
  else {
    ctx.strangerClaims.push({
      claimId: claim.id,
      firstTick: ctx.tick,
      firstListener: listenerId,
      heardBy: new Set([listenerId]),
      backedAccuser: new Set(),
      backedAccused: new Set(),
      correctedFirsthand: new Set(),
      exposedVillagers: new Map(),
      trustLost: false,
    });
  }
  hearFromStranger(ctx, listener, claim);

  const listenerName = nameOf(ctx, listenerId, true);
  const witnesses = whisperWitnesses(ctx, listener);
  for (const id of witnesses) {
    const w = agentOf(ctx, id);
    if (!w) continue;
    w.whisperWitnessed.add(claim.id);
    remember(ctx, w, IMPORTANCE.sawWhisper, `saw the stranger whisper to ${listenerName}`, `The stranger has been whispering to ${listenerName}`, listenerId);
  }
  emit(ctx, { kind: 'whisper', tick: ctx.tick, listener: listenerId, claimId: claim.id, witnesses });

  const key: LineKey = {
    act: 'reactToWhisper',
    speaker: listener.d,
    listener: STRANGER,
    claim,
    source: 'stranger',
    confidence: listener.ledger.confidence(claim.id),
    mood: listener.mood.value(ctx.tick),
    tick: ctx.tick,
  };
  const subject = ctx.castMap.get(claim.about);
  if (subject) key.subject = subject;
  const spoken = ctx.talk.say(key, ctx.rng);
  emit(ctx, { kind: 'line', tick: ctx.tick, speaker: listenerId, listeners: [], act: 'reactToWhisper', text: spoken.text, lineId: spoken.lineId, claimId: claim.id });
  listener.bubble = { text: spoken.text, untilTick: ctx.tick + BUBBLE_TICKS };
  const dx = player.pos.x - listener.mover.pos.x;
  const dy = player.pos.y - listener.mover.pos.y;
  if (Math.abs(dx) + Math.abs(dy) > 0.01) listener.mover.facing = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'e' : 'w') : dy >= 0 ? 's' : 'n';
  remember(ctx, listener, IMPORTANCE.heardRumor, `the stranger said ${claim.text}`, `The stranger says ${claim.text}`, claim.about);
  return true;
}
