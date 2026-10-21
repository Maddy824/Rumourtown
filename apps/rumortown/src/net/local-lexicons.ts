import type { Claim } from './types.js';

/** Word boundaries matter: e.g. a candlestick is not a candle. No player prose escapes. */
export const objects = [
  'bread', 'loaf', 'flour', 'sack', 'tools', 'coins', 'letter', 'ring', 'wool', 'cloth',
  'honey', 'wheel', 'boat', 'fish', 'eggs', 'milk', 'candle', 'book', 'cart', 'key',
] as const;
export const favourable = ['nursed', 'paid-debt', 'kindness'] as const;
export const takesTarget: readonly Claim['kind'][] = [
  'theft', 'cheating', 'romance', 'lying', 'broken-promise', 'insult', ...favourable,
];

// The browser dossiers omit relationship fields; only this reviewed couple has a spouse link.
export const spouses: Readonly<Record<string, string>> = { sol: 'greta', greta: 'sol' };
export const roleAliases: Readonly<Record<string, readonly string[]>> = {
  'odd-jobs carpenter': ['carpenter'], 'herbalist and midwife': ['herbalist', 'midwife'],
  gravedigger: ['grave digger'],
};

export const lexicons: ReadonlyArray<{ kind: Claim['kind']; strong: RegExp; weak: RegExp }> = [
  { kind: 'nursed', strong: /\b(nurs(?:e[ds]?|ing|d)|cared? for|tend(?:ed|ing)? (?:the sick|\w+(?:'s)? (?:fever|while|through))|bedside|sickbed)\b/u, weak: /\btend(?:ed|ing)?\b/u },
  { kind: 'paid-debt', strong: /\b(repa(?:id|y(?:ed|s|ing)?)|paid (?:\w+ )?back|paid (?:off|\w+ debt)|settled (?:\w+ )?(?:debt|money)|cleared (?:\w+ )?debt|returned all the money)\b/u, weak: /\brepay\b/u },
  { kind: 'kindness', strong: /\b(kindness|kindnes|donat(?:ed|es|ing)|gift|for free|free (?:loaf|meal)|to help|quiet favour)\b/u, weak: /\b(help(?:ed|s|ing)?|generous|kind)\b/u },
  { kind: 'theft', strong: /\b(stole|stolen|stloe|steal(?:s|ing)?|pinch(?:ed|es|ing)?|pocket(?:ed|s|ing)|swip(?:ed|es|ing)|nick(?:ed|s|ing)|took .+ without (?:asking|permission))\b/u, weak: /\b(took|missing)\b/u },
  { kind: 'cheating', strong: /\b(cheat(?:ed|s|ing)?|shortchang(?:ed|es|ing)|shortchagned|false (?:weights?|measure)|overcharg(?:ed|es|ing)|rigged|tamper(?:ed|s|ing)|loaded dice|cards up .+ sleeve|mark(?:ed|ing) the deck)\b/u, weak: /\b(unfair|scam)\b/u },
  { kind: 'romance', strong: /\b(court(?:ed|s|ing)|sweethearts?|romance|dating|romantic dates|in love|boyfriend|girlfriend)\b/u, weak: /\b(flirt(?:ed|s|ing)?|kiss(?:ed|es|ing)?)\b/u },
  { kind: 'lying', strong: /\b(lied|lyed|lies|lying|false (?:story|account)|falsehood|untrue|dishonest)\b/u, weak: /\b(fib(?:bed|s|bing)?|made .+ up)\b/u },
  { kind: 'broken-promise', strong: /\b(broke .+ (?:promise|promiss|pledge)|broke (?:a )?promise|(?:promised|gave .+ word).*(?:broke|never|failed|did not|went back)|went back on .+ word|failed to keep .+ promise)\b/u, weak: /\b(broken promise|let .+ down)\b/u },
  { kind: 'insult', strong: /\b(insult(?:ed|s|ing)?|insluted|mock(?:ed|s|ing)|called .+ (?:fool|idiot|useless|bungler))\b/u, weak: /\b(rude|mean)\b/u },
  { kind: 'hoarding', strong: /\b(hoard(?:ed|s|ing|ng)?|stockpil(?:e|es|ed|ing)|keeping all|hidden .+ (?:sharing|shortage)|secret stash)\b/u, weak: /\bstash\b/u },
  { kind: 'shirking', strong: /\b(shirk(?:s|ed|ing|ng)?|dodg(?:ed|es|ing)|skip(?:s|ped|ping)|sneaking away|avoid(?:s|ed|ing)?|duck(?:s|ed|ing))\b/u, weak: /\b(lazy|idle)\b/u },
  { kind: 'boasting', strong: /\b(brag(?:s|ged|ging)?|boast(?:s|ed|ing)?|boasing)\b/u, weak: /\b(show(?:s|ed|ing)? off)\b/u },
];
