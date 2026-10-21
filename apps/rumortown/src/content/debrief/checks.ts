export interface CheckItem {
  readonly id: string;
  readonly statement: string;
  readonly answer: boolean;
  readonly explanation: string;
}

/** Statements describe this game's rules, not promises about every real conversation. */
export const checks: readonly CheckItem[] = [
  {
    id: 'trusted-teller',
    statement: 'A trusted teller can shift belief more than an untrusted teller.',
    answer: true,
    explanation: 'In the village, trust changes how much weight a listener gives a telling.',
  },
  {
    id: 'shared-origin',
    statement: 'Hearing the same claim from three people who all got it from one source is three times the evidence.',
    answer: false,
    explanation: 'Those tellers share an origin. A listener who remembers that origin gives the extra tellings less weight.',
  },
  {
    id: 'repetition-cap',
    statement: 'Repeating a claim can raise belief, but the repetition boost has a limit.',
    answer: true,
    explanation: 'Repeated words become familiar. The boost is capped; each telling does not add the same amount.',
  },
  {
    id: 'gossiper-standing',
    statement: 'Someone who keeps spreading harmful gossip gains trust from listeners over time.',
    answer: false,
    explanation: 'Habitual negative gossip costs the teller standing. Listeners lose trust in that person over time.',
  },
  {
    id: 'source-memory',
    statement: 'A villager can remember a claim after forgetting where it came from.',
    answer: true,
    explanation: 'Source memory fades faster than memory of the claim, so the words can outlast the name attached to them.',
  },
  {
    id: 'negative-belief',
    statement: 'A harmful claim gets a belief boost just because it is harmful.',
    answer: false,
    explanation: 'Negative content gets a sharing boost in this game, not an automatic belief boost.',
  },
  {
    id: 'firsthand-evidence',
    statement: 'Seeing an event yourself carries more weight than hearing about it.',
    answer: true,
    explanation: 'The village gives direct evidence more weight than hearsay. A witness can contradict a story that has travelled widely.',
  },
  {
    id: 'denial-erases',
    statement: 'A bare denial removes every trace of belief in a rumor.',
    answer: false,
    explanation: 'A denial lowers belief but leaves some residue. It removes less belief than a correction with an alternative explanation.',
  },
  {
    id: 'alternative-explanation',
    statement: 'A correction with an alternative explanation works better than a bare denial.',
    answer: true,
    explanation: 'Explaining what happened gives listeners a replacement account. In the rules, it removes more belief than simply denying the claim.',
  },
  {
    id: 'late-correction',
    statement: 'Waiting until a rumor has been repeated several times makes a correction stronger.',
    answer: false,
    explanation: 'Corrections work best early. After at least three repetitions, the same correction has less effect.',
  },
  {
    id: 'no-backfire',
    statement: 'In this game, a correction never raises belief in the rumor it corrects.',
    answer: true,
    explanation: 'The correction rule can lower belief or leave it unchanged. It does not include a backfire effect.',
  },
  {
    id: 'friendship-irrelevant',
    statement: 'Liking the accused makes no difference to a listener hearing a harmful claim.',
    answer: false,
    explanation: 'Liking the accused dampens a harmful claim on the first hearing. Existing relationships affect how the story lands.',
  },
  {
    id: 'telling-allies',
    statement: 'Villagers are more inclined to tell allies about someone the listener is not close to.',
    answer: true,
    explanation: 'Closeness to the listener encourages telling. Closeness between the listener and the target discourages it.',
  },
  {
    id: 'instant-trust-repair',
    statement: 'Exposing a lie and correcting it immediately restores everyone\'s trust.',
    answer: false,
    explanation: 'Belief and trust change separately. Trust falls twice as fast as it rises, and exposure permanently limits trust in the liar.',
  },
  {
    id: 'hearing-versus-acting',
    statement: 'Hearing a rumor once is not enough to meet the requirements for public side-taking.',
    answer: true,
    explanation: 'Public side-taking needs belief above 0.75 and two independent sources. Loyalty and the cost of conflict also affect the decision.',
  },
  {
    id: 'every-rumor-travels',
    statement: 'Every rumor will travel if the village waits long enough.',
    answer: false,
    explanation: 'Some rumors die without being passed on. Listeners who already know a story also discourage further telling.',
  },
  {
    id: 'lost-details',
    statement: 'Retelling can strip away details and words that signal uncertainty.',
    answer: true,
    explanation: 'Retellings can lose peripheral details and qualifiers. Social and negative details are more likely to survive.',
  },
  {
    id: 'apology-beats-evidence',
    statement: 'For a false accusation of dishonesty, an apology repairs trust better than a denial with evidence of innocence.',
    answer: false,
    explanation: 'For an integrity accusation, the rules favor a denial backed by exonerating evidence over an apology.',
  },
  {
    id: 'trust-loss',
    statement: 'An exposed liar loses trust faster than they can earn it back.',
    answer: true,
    explanation: 'Trust losses count twice as much as gains. Once exposed, a liar also has a permanent ceiling on trust.',
  },
  {
    id: 'complete-attribution',
    statement: 'Every teller always passes on the full chain of people a rumor came through.',
    answer: false,
    explanation: 'Attribution is passed on only some of the time. The chain can shorten as the claim travels.',
  },
];
