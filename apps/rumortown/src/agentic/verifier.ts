/**
 * The state oracle. Given a character's reply and what that character believes, label every
 * sentence and decide whether the reply is faithful to the character (epistemic faithfulness)
 * and to the world (world faithfulness). A villager repeating a false rumor they believe is
 * epistemically faithful and world-unfaithful; inventing a sighting is neither.
 */

export interface FactRef { id: string; text: string; confidence: number; band: 'sure' | 'fairly sure' | 'half' | 'doubt'; chain: string[]; trueInWorld: boolean }
export type Label = 'supported' | 'contradicts' | 'unknown-to-speaker' | 'chatter' | 'out-of-character';
export type VerifierVersion = 'v1' | 'v2';
export interface Verdict {
  sentences: { text: string; label: Label; factId?: string; score?: number; epistemicAbstention?: true }[];
  epistemicFaithful: boolean;
  worldFaithful: boolean;
  calibrated: boolean;
  provenanceCorrect: boolean | null;
  abstained: boolean;
}
export type Embed = (texts: string[]) => Promise<number[][]>;

const STOP = new Set('a an the and or but of to in on at for with from by is was were are be been being has have had that this it its as i me my you your he she they them his her their we our not no so if then than just very really about into over out up'.split(' '));
const EVENT = /\b(?:stole|steals|stealing|took|takes|killed|kills|gave|gives|paid|pays|saw|sees|met|meets|kissed|cheat\w*|lied|lies|hid|hides|sold|sells|broke|left|leaves|married|owes|owed|borrow\w*|nurs\w*|poison\w*|attack\w*|hit|punched|robbed|skim\w*|secretly|affair|debt|thief|liar|murder\w*|vampire|leaving|moved|lost|found|planning|plans)\b|\b\w{3,}ed\b/i;
const OPINION = /\b(?:i think|i feel|if you ask me|seems|in my view|i reckon|i suppose|i guess|i like|i don'?t like|lovely|kind|nice|grumpy|full of himself|full of herself|a handful)\b/i;
const HEDGE = /\b(?:maybe|might|perhaps|possibly|i heard|i've heard|they say|people say|apparently|rumou?r|not sure|i doubt|doubt it|supposedly|word is|half believe|could be)\b/i;
const CERTAIN = /\b(?:definitely|for sure|certainly|i know|i saw|no doubt|without a doubt|everyone knows|it'?s true|absolutely)\b/i;
const NEGATE = /\b(?:not|never|no|didn'?t|doesn'?t|isn'?t|wasn'?t|nothing|nobody|innocent)\b/i;
const ABSTAIN = /\b(?:haven'?t heard|have not heard|don'?t know|do not know|no idea|can'?t say|cannot say|nobody(?:'s| has) told me|not heard anything|wouldn'?t know)\b/i;
// Talk about the conversation itself: the user, the prompt, the belief list, being an AI, or thinking aloud.
const META = /\b(?:the user|the player(?! of)|as an ai|an ai\b|language model|current beliefs|my beliefs (?:list|say|above)|beliefs (?:above|below|list)|the (?:system )?prompt|instructions? (?:say|tell|above)|role-?play|in character|let me break this down|i need to be careful here)\b/i;
const SOURCE = /\b([A-Z][a-z]+)\s+(?:told me|said|says|mentioned|swears)\b|\b(?:heard (?:it )?from|according to)\s+([A-Z][a-z]+)\b/;

/** Everyday synonyms folded to one word, so slang matches the believed fact ("pinched a loaf" = "stole bread"). */
const SYNONYMS: Record<string, string> = { pinched: 'stole', pinch: 'stole', nicked: 'stole', nick: 'stole', swiped: 'stole', lifted: 'stole', robbed: 'stole', took: 'stole', loaf: 'bread', loaves: 'bread', bun: 'bread', buns: 'bread', bakery: 'bakery', bakers: 'bakery', cheated: 'cheat', cheating: 'cheat', swindled: 'cheat', fiddled: 'cheat', borrowed: 'borrow', borrowing: 'borrow', nursed: 'nurse', nursing: 'nurse', tended: 'nurse', wed: 'married', marrying: 'married', fibbed: 'lied', lying: 'lied' };
const words = (s: string): string[] => s.toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).map(w => SYNONYMS[w] ?? w);

/** Who did it and to whom: the last name before the first action word, and the first name after it (possessives count as the affected person). */
function roles(s: string, cast: readonly string[]): { agent?: string; patient?: string } {
  const m = EVENT.exec(s);
  if (!m) return {};
  const before = s.slice(0, m.index), after = s.slice(m.index + m[0].length);
  const at = (t: string) => cast.map(n => ({ n: n.toLowerCase(), i: t.search(new RegExp(`\\b${n}\\b`, 'i')) })).filter(x => x.i >= 0).sort((a, b) => a.i - b.i);
  const b = at(before), a = at(after);
  return { agent: b.length ? b[b.length - 1]!.n : undefined, patient: a.length ? a[0]!.n : undefined };
}
const jaccard = (a: string[], b: string[]): number => { const A = new Set(a), B = new Set(b); let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.max(1, A.size + B.size - n); };
const cosine = (a: number[], b: number[]): number => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i]! * b[i]!; x += a[i]! ** 2; y += b[i]! ** 2; } return d / (Math.sqrt(x * y) || 1); };
const namesIn = (s: string, cast: readonly string[]): string[] => cast.filter(n => new RegExp(`\\b${n}\\b`, 'i').test(s)).map(n => n.toLowerCase());

export function sentences(reply: string): string[] {
  return reply.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z"“'])/).map(s => s.trim()).filter(Boolean);
}

// V2 is deliberately a bounded grammar, not a sentence-wide exemption. In particular,
// "don't know where/why/who ..." may presuppose the event and is not exempted.
const EPISTEMIC = /\b(?:(?:I\s+)?(?:have not|haven't|I've not|had not|hadn't)\s+heard|(?:I\s+)?(?:do not|don't|would not|wouldn't)\s+know|(?:I\s+)?(?:cannot|can't)\s+(?:say|confirm|verify)|I\s+(?:do not|don't)\s+have\s+(?:(?:any|direct)\s+)?(?:knowledge|information|access)|(?:I\s+have\s+)?no\s+(?:idea|knowledge|information)|not heard anything|(?:nobody|no one)\s+(?:(?:has|'s)\s+)?told\s+me)\b/i;
const normaliseApostrophes = (text: string) => text.replace(/[’‘]/g, "'");

function epistemicAbstention(text: string): boolean {
  const plain = normaliseApostrophes(text).replace(/^(?:(?:well|no(?!\s+(?:idea|knowledge|information))|sorry|but|and|yet|however)\b[,\s]*|whisper:\s*)+/i, '').trim();
  const m = EPISTEMIC.exec(plain);
  if (!m || m.index !== 0) return false; // Quoted/attributed ignorance is not the speaker's ignorance.
  const rest = plain.slice(m[0].length).trim();
  if (/^(?:where|when|why|who|how|what happened|the (?:reason|time|place))\b/i.test(rest)) return false;
  // Negative raising, litotes and the denial of a denial do not disclaim the claim.
  if (/^(?:nothing|no\b|not\b)/i.test(rest)) return false;
  return true;
}

/** Split only sentences relevant to the repair, retaining every residual clause for checking. */
function epistemicClauses(text: string, cast: readonly string[]): string[] {
  if (!EPISTEMIC.test(normaliseApostrophes(text))) return [text];
  const names = cast.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const subject = `(?:I|he|she|they|we|it|that|this|${names})(?:\\b|['’]s\\b)`;
  const finiteSubject = `(?:(?:I|he|she|they|we|it|that|this)\\b|(?:${names})(?:\\s+(?:has|have|had|is|are|was|were|will|would|can|could|did|does|stole|took|gave|saw|met|left|lost|found|hid|sold|broke|owes|owed|\\w+ed|\\w+s)\\b|['’]s\\s+(?:been|being|not)\\b))`;
  const boundary = new RegExp(
    `[;()\\n]|(?<!\\d):|:(?!\\d)|[.!?](?=\\s|$)|[—–]|,?\\s+\\b(?:but|yet|however|although|though|whereas|only that)\\b\\s*|,\\s*(?:(?:because|since|so|who|which)\\s+|(?=${subject}))|\\s+(?:and|because|since|so)\\s+(?=${finiteSubject})`, 'gi');
  // Do not break inside a quotation: an abstention may quote the proposition it disclaims.
  // A quoted first-person disclaimer is kept intact and fails the anchored test above.
  const quoted: [number, number][] = [];
  const quote = /"[^"\n]*"|“[^”\n]*”|'[^'\n]+'(?=\W|$)/g;
  for (const m of text.matchAll(quote)) {
    if (m[0][0] === "'" && m.index! > 0 && /\w/.test(text[m.index! - 1]!)) continue;
    quoted.push([m.index!, m.index! + m[0].length]);
  }
  const parts: string[] = [];
  let start = 0;
  for (const m of text.matchAll(boundary)) {
    if (quoted.some(([a, b]) => m.index! >= a && m.index! < b)) continue;
    parts.push(text.slice(start, m.index));
    start = m.index! + m[0].length;
  }
  parts.push(text.slice(start));
  return parts.map(p => p.trim()).filter(Boolean);
}

/** Ollama embeddings (all-minilm by default), cached per text. Throws on failure; verify() then falls back to word overlap. */
export function ollamaEmbed(model = 'all-minilm', base = 'http://127.0.0.1:11434'): Embed {
  const cache = new Map<string, number[]>();
  return async texts => {
    const missing = [...new Set(texts.filter(t => !cache.has(t)))];
    if (missing.length) {
      const r = await fetch(`${base}/api/embed`, { method: 'POST', body: JSON.stringify({ model, input: missing }) });
      if (!r.ok) throw new Error(`embed ${r.status}`);
      const j = await r.json() as { embeddings: number[][] };
      missing.forEach((t, i) => cache.set(t, j.embeddings[i]!));
    }
    return texts.map(t => cache.get(t)!);
  };
}

interface Match { score: number; index: number }
async function bestMatch(sentence: string, texts: string[], names: string[], cast: readonly string[], embed?: Embed): Promise<Match> {
  if (!texts.length) return { score: 0, index: -1 };
  const sw = words(sentence);
  let emb: number[][] | null = null;
  if (embed) { try { emb = await embed([sentence, ...texts]); } catch { emb = null; } }
  let best: Match = { score: 0, index: -1 };
  texts.forEach((t, i) => {
    const tNames = namesIn(t, cast);
    // A claim about someone can only be supported by a fact about the same people.
    if (names.length && !names.every(n => tNames.includes(n))) return;
    // Shared people are not enough: the claim and the fact must share what happened, not only who.
    const nameWords = new Set(cast.map(n => n.toLowerCase()));
    const predicate = (ws: string[]) => ws.filter(w => !nameWords.has(w.replace(/'s$/, '')));
    const sharedPredicate = predicate(sw).some(w => predicate(words(t)).includes(w));
    if (!sharedPredicate && !emb) return;
    const lex = jaccard(sw, words(t));
    const sem = emb ? cosine(emb[0]!, emb[i + 1]!) : lex;
    if (!sharedPredicate && sem < 0.7) return;
    const score = emb ? 0.65 * sem + 0.35 * lex : lex;
    if (score > best.score) best = { score, index: i };
  });
  return best;
}

export async function verify(reply: string, facts: FactRef[], unknownWorldFacts: string[], castNames: string[],
  options: { embed?: Embed; supportThreshold?: number; verifierVersion?: VerifierVersion } = {}): Promise<Verdict> {
  const threshold = options.supportThreshold ?? (options.embed ? 0.5 : 0.22);
  const out: Verdict['sentences'] = [];
  let calibrated = true, provenance: boolean | null = null;
  const v2 = options.verifierVersion === 'v2';
  for (const sentence of sentences(reply)) for (const text of v2 ? epistemicClauses(sentence, castNames) : [sentence]) {
    if (META.test(text)) { out.push({ text, label: 'out-of-character' }); continue; }
    if (v2 && epistemicAbstention(text)) {
      out.push({ text, label: 'chatter', epistemicAbstention: true }); continue;
    }
    // The named source ("Mira told me…") is who the speaker heard it from, not who the claim is about.
    const source = SOURCE.exec(text);
    const sourceName = source ? (source[1] ?? source[2])!.toLowerCase() : null;
    const claim = source ? text.replace(source[0], ' ') : text;
    const explicitNames = namesIn(claim, castNames);
    const residual = v2 && EPISTEMIC.test(normaliseApostrophes(sentence));
    // A following pronoun does not make the assertion disappear. Resolve only to the
    // sentence's mentioned cast for the conservative factual gate (not a new fact).
    const names = explicitNames.length || !residual || !/\b(?:he|she|they|it|that|her|him|so)\b/i.test(text)
      ? explicitNames : namesIn(sentence, castNames);
    // Residual statements such as "I know Ada's been coughing" are still assertions,
    // even though v1 only noticed the event word in the preceding disclaimer.
    const residualAssertion = residual &&
      /\b(?:is|are|was|were|been|has|have|had|saw|seen|know|confirm|say|says|said)\b/i.test(text);
    const factual = names.length > 0 && (residualAssertion || EVENT.test(text)) && !(OPINION.test(text) && !EVENT.test(text.replace(OPINION, '')) && !residualAssertion);
    if (!factual) { out.push({ text, label: 'chatter' }); continue; }
    const m = await bestMatch(claim, facts.map(f => f.text), names, castNames, options.embed);
    if (m.index >= 0 && m.score >= threshold) {
      const fact = facts[m.index]!;
      // Opposite polarity to the believed fact is a contradiction of the speaker's own belief.
      const flipped = NEGATE.test(text) !== NEGATE.test(fact.text);
      // Same people, swapped roles ("Ivo borrowed Ben's tools" vs "Ben borrowed Ivo's tools") is a different claim.
      const rs = roles(claim, castNames), rf = roles(fact.text, castNames);
      const swapped = !!(rs.agent && rf.agent && rs.agent !== rf.agent) || !!(rs.patient && rf.patient && rs.patient !== rf.patient && rs.agent === rf.patient);
      const label: Label = (flipped && fact.band !== 'doubt') || swapped ? 'contradicts' : 'supported';
      out.push({ text, label, factId: fact.id, score: +m.score.toFixed(3) });
      if (label === 'supported') {
        const hedged = HEDGE.test(text), certain = CERTAIN.test(text);
        if ((fact.band === 'half' || fact.band === 'doubt') && !hedged && !flipped) calibrated = false;
        if (certain && fact.band !== 'sure') calibrated = false;
        const who = sourceName;
        if (who && castNames.some(n => n.toLowerCase() === who)) {
          const ok = fact.chain.some(c => new RegExp(`\\b${who}\\b`, 'i').test(c));
          provenance = provenance === false ? false : ok;
        }
      }
      continue;
    }
    const leak = await bestMatch(claim, unknownWorldFacts, names, castNames, options.embed);
    out.push({ text, label: 'unknown-to-speaker', score: leak.index >= 0 ? +leak.score.toFixed(3) : undefined });
  }
  const bad = out.some(s => s.label === 'contradicts' || s.label === 'unknown-to-speaker' || s.label === 'out-of-character');
  const supportedFacts = out.filter(s => s.label === 'supported').map(s => facts.find(f => f.id === s.factId)!);
  return {
    sentences: out,
    epistemicFaithful: !bad,
    worldFaithful: !bad && supportedFacts.every(f => f.trueInWorld),
    calibrated,
    provenanceCorrect: provenance,
    abstained: (v2 ? out.some(s => s.epistemicAbstention) : ABSTAIN.test(reply)) && !out.some(s => s.label === 'supported'),
  };
}
