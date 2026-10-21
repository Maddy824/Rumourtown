/** Positive cautions protect a kindness, rather than treating its giver as dangerous. */
import { defineSets } from '../define.js';

export const coreNuanceSets = [
  ...defineSets({ speaker: 'mira' }, {
    'warn fav any-subject': ['Do not pick holes in a good deed. {claim}.', 'Leave the thanks at the door. {claim}.', 'Credit, without a fuss. {claim}.', 'Do not make kindness more work. {claim}.'],
    'doubt harm hedged any-subject': ['You want my verdict? I need facts first.', 'Perhaps. I cannot tell you before I have checked.', 'You might be right. Might is not enough.', 'I will answer you when I know. Not before.'],
    'doubt fav hedged any-subject': ['You may have found a kindness. I need to see it.', 'Perhaps. I cannot give you credit on hearsay.', 'I would like to believe you. I am not sure yet.', 'You ask me? Nice if true. Let us check.'],
  }),
  ...defineSets({ speaker: 'tom' }, {
    'warn fav any-subject': ['Please do not make a fuss of it. {claim}.', 'Let the good work speak quietly. {claim}.', 'Mind you do not embarrass anyone. {claim}.', 'Keep the kindness out of an argument. {claim}.'],
    'doubt harm hedged any-subject': ['I cannot tell you for certain. I wish I could.', 'You might be right. I would rather ask first.', 'Perhaps. Do not count on my answer yet.', 'I do not know enough to say to you. Sorry.'],
    'doubt fav hedged any-subject': ['You may be right. I hope so, anyway.', 'I would like to believe you. I have only heard a little.', 'Perhaps. I cannot promise you that it is true.', 'I am not sure. Will you let me ask?'],
  }),
  ...defineSets({ speaker: 'ben' }, {
    'warn fav any-subject': ['Do not spoil a decent turn. {claim}.', 'Good deed. No gawping. {claim}.', 'Keep the thanks short. {claim}.', 'No prying. Just give credit. {claim}.'],
    'doubt harm hedged any-subject': ['You ask me? Not enough to go on.', 'Might be. You need more than my guess.', 'Cannot give you an answer yet.', 'You may be right. Not swearing to it.'],
    'doubt fav hedged any-subject': ['Could be. You seen proof?', 'Maybe. Cannot tell you for sure.', 'You might be right. Hope you are.', 'Not sure. You will have to wait.'],
  }),
  ...defineSets({ speaker: 'ada' }, {
    'warn fav any-subject': ['Do not pull a kindness to pieces, child. {claim}.', 'Leave a little privacy. {claim}.', 'Give thanks, not a cross-examination. {claim}.', 'Mind the good thread in this. {claim}.'],
    'doubt harm hedged any-subject': ['You ask me for certainty from a sickbed? Perhaps.', 'Maybe, child. You have brought me half a thread.', 'I cannot tell you what I do not know.', 'You may be right. My old ears want a second telling.'],
    'doubt fav hedged any-subject': ['You may be right, child. I have heard too little.', 'Perhaps. Do not ask me to weave certainty from that.', 'I hope you are right. Hope is not knowledge.', 'You will have to wait for a firmer answer.'],
  }),
  ...defineSets({ speaker: 'rosa' }, {
    'warn fav any-subject': ['Do not smother a kindness with questions, love. {claim}.', 'Keep a little quiet for the giver, pet. {claim}.', 'Mind we do not spoil this lovely thing. {claim}.', 'Let the good news stay good, love. {claim}.'],
    'doubt harm hedged any-subject': ['You want me to swear to it, love? I could not.', 'Maybe, pet. You know how stories grow at the inn.', 'I cannot give you more than a guess, love.', 'You might be right. I will keep listening.'],
    'doubt fav hedged any-subject': ['You may be right, love. What a lovely thought.', 'Maybe so, pet. I cannot promise you.', 'I hope you are right. I only heard a little.', 'Perhaps, love. Let me ask before I tell you yes.'],
  }),
  ...defineSets({ speaker: 'jonah' }, {
    'warn fav any-subject': ['Give the deed its proper weight. {claim}.', 'Do not grind a good thing into dust. {claim}.', 'Leave the kindness fairly measured. {claim}.', 'Take care not to demand more. {claim}.'],
    'doubt harm hedged any-subject': ['You ask for certainty on half a measure? Not yet.', 'Perhaps. I cannot weigh what you have not brought me.', 'You may be right. The balance has not settled.', 'I would give you an answer if the facts were in.'],
    'doubt fav hedged any-subject': ['You may be right. I have not weighed it properly.', 'Perhaps. A good deed still needs a full account, you see.', 'I cannot assure you yet. Let the matter settle.', 'You have a pleasing story. It may even be true.'],
  }),
];
