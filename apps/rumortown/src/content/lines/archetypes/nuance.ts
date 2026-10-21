/** Neutral replies and positive cautions, separately authored so good news never sounds threatening. */
import { defineSets } from '../define.js';
import type { LineSet } from '../types.js';

const authoredNuanceSets: LineSet[] = [
  ...defineSets({ voice: 'blunt' }, {
    'accuse neutral any-subject': ['You know the answer. Speak.', 'Your turn. What happened?', 'Tell it straight. No wandering.', 'You were there. Say so.'],
    'deny neutral any-subject': ['You heard wrong.', 'No. Check your facts.', 'Wrong account. Ask again.', 'You have it backwards.'],
    'apologize neutral any-subject': ['My error. You were right.', 'Sorry. Gave you bad information.', 'You deserved a straight answer. Sorry.', 'Wrong of me. I will tell you plainly now.'],
    'forgive neutral any-subject': ['You made a mistake. Done.', 'No debt. You and me are square.', 'You corrected it. Enough.', 'We can stop here. Your apology is accepted.'],
    'refuse neutral any-subject': ['You can ask elsewhere.', 'No answer for you today.', 'You will get nothing more from me.', 'Not your business. Enough.'],
    'warn fav any-subject': ['Give credit. {claim}.', 'Keep the kindness quiet. {claim}.', 'Do not spoil a good thing. {claim}.', 'No fuss needed. {claim}.'],
    'warn neutral any-subject': ['You should check before acting.', 'Keep your eyes open. No need to rush.', 'You can wait for the facts.', 'Take care with what you repeat.'],
    'doubt fav hedged': ['Might be so. Cannot swear.', 'Perhaps true. Need to check.', 'Maybe right. Not settled yet.', 'Could be kindness. Need more than talk.'],
    'doubt harm hedged any-subject': ['You ask me? Cannot say yet.', 'Your guess is as good as mine.', 'I cannot tell you either way.', 'Maybe. You had best wait.'],
  }),
  ...defineSets({ voice: 'gentle' }, {
    'accuse neutral any-subject': ['Could you tell me your part in it?', 'You might help us understand.', 'I need to ask you what happened.', 'Please do not leave me guessing about you.'],
    'deny neutral any-subject': ['I think you have been told wrongly.', 'No, that is not what I meant to tell you.', 'Please let me correct that for you.', 'You have a mistaken account, I am afraid.'],
    'apologize neutral any-subject': ['I muddled things for you. I am sorry.', 'You were right to ask again. Forgive me.', 'Sorry. I should have listened to you.', 'I am sorry for giving you the wrong impression.'],
    'forgive neutral any-subject': ['You meant well. Let us leave it.', 'I accept your apology, of course.', 'You can stop worrying about that now.', 'There is no hard feeling between us.'],
    'refuse neutral any-subject': ['I would rather you asked another time.', 'Please do not press me for an answer.', 'You will have to let me be quiet on this.', 'I cannot tell you more just now.'],
    'warn fav any-subject': ['Please leave a little privacy. {claim}.', 'Let a quiet favour stay quiet. {claim}.', 'Be gentle with this good news. {claim}.', 'Do not make a burden of the thanks. {claim}.'],
    'warn neutral any-subject': ['Please take your time before deciding.', 'You need not act before you understand.', 'Be careful with the words you pass along.', 'I would like you to check first, gently.'],
    'doubt fav hedged': ['Perhaps it is so. I cannot be sure.', 'It might be true. I dearly hope so.', 'Maybe there is kindness there. I do not know.', 'I only half heard. It could be right.'],
    'doubt harm hedged any-subject': ['I wish I could give you a certain answer.', 'Perhaps. Please do not rely on my guess.', 'I cannot tell you for sure, dear one.', 'You may be right. I am still unsure.'],
  }),
  ...defineSets({ voice: 'sharp' }, {
    'accuse neutral any-subject': ['You have facts to contribute. Start there.', 'Your part in this, please. Precisely.', 'You know more than you have said.', 'Answer the question you were asked.'],
    'deny neutral any-subject': ['You have the facts in the wrong order.', 'No. Your account needs correcting.', 'You may repeat it. That will not make it right.', 'Wrong. I expect you to check next time.'],
    'apologize neutral any-subject': ['I misinformed you. I will correct it.', 'You were right. I was careless. Sorry.', 'I owe you an accurate account. Here it is.', 'I gave you a verdict without the facts. Sorry.'],
    'forgive neutral any-subject': ['You corrected yourself. Sensible.', 'Apology accepted. Improve your sources.', 'You can stop explaining. We are done.', 'We are square. You may relax.'],
    'refuse neutral any-subject': ['You have asked enough questions.', 'Your curiosity is not my obligation.', 'You can do your own enquiring.', 'No answer. You will survive.'],
    'warn fav any-subject': ['Do not sneer at this. {claim}.', 'Give credit before finding faults. {claim}.', 'Keep your prying out of it. {claim}.', 'Do not turn kindness into a spectacle. {claim}.'],
    'warn neutral any-subject': ['Check before you announce a verdict.', 'You will want facts before making a fool of yourself.', 'Take care with your conclusions.', 'You should ask how, when and who saw it.'],
    'doubt fav hedged': ['Possibly true. Do not embroider it.', 'Maybe. I require rather more evidence.', 'It might be so. I am reserving judgement.', 'Perhaps kind. Perhaps a mistake in the telling.'],
    'doubt harm hedged any-subject': ['You want certainty? I have not got it yet.', 'Perhaps. Your account still needs checking.', 'I cannot give you a verdict on half the facts.', 'You may be right. I am not signing my name to it.'],
  }),
  ...defineSets({ voice: 'dreamy' }, {
    'accuse neutral any-subject': ['Where do you belong in this picture?', 'You were there, were you not?', 'I keep coming back to your part in it.', 'You have left a space in the story. Why?'],
    'deny neutral any-subject': ['You have followed the wrong thread.', 'That is not the thing I meant you to see.', 'You are remembering a different moment.', 'No. The story you have is a little crooked.'],
    'apologize neutral any-subject': ['I led your thoughts the wrong way. Sorry.', 'You were clear. I was wandering. Forgive me.', 'I gave you half a thought as if it were whole.', 'I am sorry. You deserved my full attention.'],
    'forgive neutral any-subject': ['You can leave that worry here.', 'We found our way back. That is enough.', 'Your apology has cleared the air.', 'You need not carry the mistake away.'],
    'refuse neutral any-subject': ['I cannot put an answer in your hands yet.', 'Let me keep that thought a little longer, will you?', 'You must let the silence stand for now.', 'I would rather you left that question open.'],
    'warn fav any-subject': ['Do not startle a quiet kindness. {claim}.', 'Leave a little shade for the giver. {claim}.', 'Let this good thing breathe. {claim}.', 'Keep a gentle hand on this story. {claim}.'],
    'warn neutral any-subject': ['You may want to see where that path leads first.', 'Keep a clear thought before you act.', 'You could lose the truth by hurrying.', 'Take care which story you follow home.'],
    'doubt harm hedged any-subject': ['I cannot quite see it yet. Can you?', 'You may be right. The edges are still misty.', 'Perhaps. I cannot offer you more than that.', 'I would wait, if you can. My thoughts are unsettled.'],
  }),
  ...defineSets({ voice: 'pious' }, {
    'accuse neutral any-subject': ['You owe the truth no less than your neighbour.', 'Tell us your part without embellishment.', 'You were present. What can you tell us?', 'Let your answer be a plain one.'],
    'deny neutral any-subject': ['You have been given a mistaken account.', 'That is not the truth I would have you carry.', 'I must correct your understanding of it.', 'No. You should hear the matter afresh.'],
    'apologize neutral any-subject': ['I misled you through carelessness. Forgive me.', 'You deserved the truth in full. I fell short.', 'I owe you a correction and a little humility.', 'I should have attended to your words. I am sorry.'],
    'forgive neutral any-subject': ['Your apology is freely accepted.', 'You have owned the error. Let peace follow.', 'We can begin again with better understanding.', 'Let your mind be easy on this matter.'],
    'refuse neutral any-subject': ['You must allow me to keep my own counsel.', 'I cannot give you another soul’s confidence.', 'Let your enquiry rest for now.', 'You will have to accept my silence today.'],
    'warn fav any-subject': ['Do not let praise become vanity. {claim}.', 'Respect a private act of charity. {claim}.', 'Let the thanks be modest. {claim}.', 'Be mindful of the giver’s wishes. {claim}.'],
    'warn neutral any-subject': ['You should enquire before judging.', 'Guard your tongue until the facts are known.', 'Be certain your words will not cause needless hurt.', 'Let prudence guide you before haste does.'],
    'doubt harm hedged any-subject': ['I cannot offer you certainty where I have none.', 'Perhaps. You must allow me to suspend judgement.', 'Your account may be right. I have no witness.', 'I would ask you to wait for a clearer truth.'],
  }),
  ...defineSets({ voice: 'jolly' }, {
    'accuse neutral any-subject': ['Your verse is missing. Sing out.', 'Where did you come into the tale?', 'You were in the middle of it, were you not?', 'Tell your part before the rest runs away with us.'],
    'deny neutral any-subject': ['You have danced into the wrong story.', 'That is not the tale I told you.', 'No, friend. You missed a verse.', 'Your news took a wrong turn somewhere.'],
    'apologize neutral any-subject': ['I sent you down the wrong road. Sorry, friend.', 'You had it right. I improved the story too much.', 'Forgive me. I gave you news with a wheel missing.', 'You deserved facts and got a performance. Sorry.'],
    'forgive neutral any-subject': ['We have both taken wrong turnings. Welcome back.', 'Your apology can sit down beside my forgiveness.', 'You corrected the tale. We can smile again.', 'No need for you to sing a lament over that.'],
    'refuse neutral any-subject': ['You will have to find a different storyteller.', 'That verse stays in my pocket, if you please.', 'You cannot coax that one out of me.', 'Let us find you a kinder subject.'],
    'warn fav any-subject': ['Do not cheer so loudly the giver flees. {claim}.', 'Keep the good secret kindly. {claim}.', 'Let the deed have its own small applause. {claim}.', 'Mind you do not spoil the surprise. {claim}.'],
    'warn neutral any-subject': ['Mind your step before joining that dance.', 'You should hear the last verse before singing along.', 'Keep your wits as well as your good spirits.', 'You may want a second telling before you act.'],
    'doubt harm hedged any-subject': ['You ask me? I have not heard the ending.', 'Perhaps, friend. Your guess may beat mine.', 'I cannot sing you a certain answer yet.', 'You may be right. The tale is still on the road.'],
  }),
  ...defineSets({ voice: 'weary' }, {
    'accuse neutral any-subject': ['Your account, please. I can wait a moment.', 'You had a part in it. Explain that much.', 'Give your version before the day runs out.', 'You may as well tell me while I am here.'],
    'deny neutral any-subject': ['You have it wrong. I shall explain once.', 'That account will not do you any good.', 'No. You have confused two different things.', 'You were told badly. That much is clear.'],
    'apologize neutral any-subject': ['I wasted your time with a wrong account. Sorry.', 'You deserved more care from me.', 'I owe you the right facts. I was too tired to check.', 'You were right to question me. I am sorry.'],
    'forgive neutral any-subject': ['You made a mistake. No need to make a burden of it.', 'Your apology will do. Let us get on.', 'You can put that down now. I have.', 'We have spent enough time regretting it.'],
    'refuse neutral any-subject': ['You must ask when I have a little strength left.', 'I cannot give you any more of this day.', 'Your question can wait until the work is done.', 'Let me rest from answering you.'],
    'warn fav any-subject': ['Do not wear the giver out with thanks. {claim}.', 'Leave a decent deed some peace. {claim}.', 'Remember the kindness without demanding more. {claim}.', 'Let the good news rest gently. {claim}.'],
    'warn neutral any-subject': ['Save yourself trouble. Check your facts.', 'You do not need another mistake to put right.', 'Be careful before adding to your work.', 'Take your time. Haste leaves more to mend.'],
    'doubt harm hedged any-subject': ['I cannot give you a certain answer after this day.', 'Perhaps. You should ask somebody less tired.', 'You may be right. I have not checked.', 'I would wait, if I were you. There is too little known.'],
  }),
];

// These doubts express uncertainty itself, equally apt for a harmful or a favourable account.
export const nuanceSets: LineSet[] = authoredNuanceSets.flatMap((set) =>
  set.act === 'doubt' && set.hedged && set.anySubject && set.valence === -1
    ? [set, { ...set, valence: 1, lines: [...set.lines] }] : [set],
);
