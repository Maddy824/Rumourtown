import type { CharacterId, SpeechAct } from './types';

export const LINES: Record<SpeechAct, Record<CharacterId, string[]>> = {
  gossip: {
    mira: ['Well, {claim}. Explain that.', 'Something smells off: {claim}.', 'You should know: {claim}.'],
    tom: ['I think {claim}. Please be kind.', 'Between us, {claim}.', 'Perhaps this helps: {claim}.'],
    ben: ['Word is, {claim}.', 'Listen: {claim}.', 'Here’s what I know: {claim}.'],
  },
  confront: {
    mira: ['Tom! My bread isn’t yours to take!', 'A missing loaf, Tom. Care to explain?', 'Tom, did you steal from my bakery?'],
    tom: ['Can we talk about the missing bread?', 'I need to ask about that loaf.', 'Please tell me what happened.'],
    ben: ['Tom. What happened to that bread?', 'Someone’s missing a loaf. Talk.', 'Did you take Mira’s bread?'],
  },
  deny: {
    mira: ['That is not what happened.', 'Don’t put words in my mouth.', 'You’ve got the wrong story.'],
    tom: ['I wasn’t trying to steal. I meant to pay later.', 'Please, I meant to pay for that loaf.', 'I took it on credit, not in secret.'],
    ben: ['No. That’s wrong.', 'That story doesn’t add up.', 'I don’t buy it.'],
  },
  explain: {
    mira: ['Here’s the missing piece: {claim}.', 'There is another explanation: {claim}.', 'Wait. {claim}.'],
    tom: ['Ada is sick. I brought her bread; I’ll pay Mira.', 'The loaf was for Ada. I should have left a note.', 'I gave it to Ada. She was too ill to come out.'],
    ben: ['The bread went to Ada.', 'Ada needed food. Tom helped.', 'There’s your answer: {claim}.'],
  },
  defend: {
    mira: ['Hold on. {claim}.', 'Let’s hear him out. {claim}.', 'Fair is fair: {claim}.'],
    tom: ['Please hear the other side: {claim}.', 'There may be kindness here. {claim}.', 'Let’s be gentle. {claim}.'],
    ben: ['Leave Tom alone. {claim}.', 'I trust Tom. {claim}.', 'Enough. {claim}.'],
  },
  doubt: {
    mira: ['A stranger’s word? I’ll keep my eyes open.', 'That’s a claim, not proof.', 'Hmm. I want the whole story.'],
    tom: ['I’m not sure that’s fair.', 'Perhaps there’s more to it.', 'Let’s not rush to judge.'],
    ben: ['Says who? You’re a stranger.', 'I’m not buying that yet.', 'Tom deserves better than a rumor.'],
  },
  agree: {
    mira: ['That explains a thing or two.', 'I thought something was wrong.', 'Right. I’ll remember that.'],
    tom: ['I hear you.', 'Thank you for telling me.', 'I’ll keep that in mind.'],
    ben: ['All right. I heard you.', 'That checks out enough for now.', 'Got it.'],
  },
  reconcile: {
    mira: ['Tom, I judged too fast. I’m sorry.', 'I owe you an apology, Tom. Next time, leave a note.', 'I had the wrong end of it. Sorry, Tom.'],
    tom: ['We’re all right. Let’s start again.', 'No hard feelings. I should have explained.', 'Let’s share a loaf and move on.'],
    ben: ['Good. We can move on.', 'Glad that’s settled.', 'All right. Friends again.'],
  },
};

export function line(act: SpeechAct, speaker: CharacterId, random: number, claim: string): string {
  const options = LINES[act][speaker];
  return options[Math.floor(random * options.length)]!.replaceAll('{claim}', claim.charAt(0).toLowerCase() + claim.slice(1));
}
