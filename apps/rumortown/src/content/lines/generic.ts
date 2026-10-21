/**
 * Plain lines anyone may say: the last resort when neither the speaker nor their voice archetype has a
 * line for the moment. They cover every act, valence and person, so selection never comes up empty.
 * No names, and no he or she for the subject: these must suit anyone. Lines that might be said to the
 * subject's face (to-subject and any-subject) always speak to the listener as "you".
 */
import { defineSets } from './define.js';

export const genericSets = defineSets({}, {
  // Greetings and goodbyes
  greet: ['Hello there.', 'Good day to you.', 'Well, {listener}.', 'There you are.', 'How do, {listener}?', 'All well with you?'],
  'greet daypart:morning': ['Morning.', 'Morning, {listener}.', 'Early start for you too, then.'],
  'greet daypart:evening': ['Evening.', 'Evening, {listener}.', 'Nearly done for the day?'],
  'greet close': ["There's a face I like to see.", 'Come here, you. How are things?'],
  'greet rival': ['{listener}. Well.', "Oh. It's you."],
  'greet mood:low': ["Hello. Don't ask how I am.", 'Oh. Hello.'],
  farewell: ["Well, I'll let you get on.", 'Mind how you go.', "Right. I'd best be off.", 'Good day, {listener}.', 'See you about.', 'Back to {place} for me.'],
  'farewell daypart:evening': ['Good night, then.', 'Sleep well, {listener}.', 'Home for me. Good night.'],

  // Small talk with no topic, or one the bank does not know
  smalltalk: [
    'Quiet day, so far.',
    'Funny old week, this.',
    "There's always talk of {topic} this time of year.",
    'Everyone has something to say about {topic}.',
  ],
  'smalltalk topic:bread': ['Smells like the ovens are going.', "Can't beat fresh bread, can you?"],
  'smalltalk topic:weather': ['Misty start again.', 'Clouds over the hill. Rain later, maybe.'],
  'smalltalk topic:chores': ['Always something wants mending.', "The wood won't chop itself."],
  'smalltalk topic:the-fair': ["The fair's on Sunday now, I hear.", 'Will you go to the fair?'],
  'smalltalk topic:prices': ["Flour's dearer again.", 'Everything costs more than it did.'],
  'smalltalk topic:the-river': ["River's high.", "Mind the bank by the bridge. It's soft."],
  'smalltalk topic:music': ['Will there be music at the inn tonight?', 'I could do with a tune.'],
  'smalltalk topic:tiredness': ["I'm fit to drop.", 'Long day.'],
  'smalltalk topic:tomorrow': ['What are you about tomorrow?', 'Tomorrow can wait till tomorrow.'],

  // News: village happenings, or a claim passed on as plain fact
  news: [
    "The fair's moved to Sunday.",
    "Ada's still poorly, I hear.",
    "River's up after the rain in the hills.",
    "There's a stranger about. Keeps to the edges.",
    "Lio's playing at the inn tonight.",
    "The chapel roof's leaking again.",
  ],
  'news neutral': ['Did you hear? {claim}.', "Here's a thing: {claim}.", 'Word is {claim}.', "You'll have heard {claim}?"],
  'news harm': ['Word going round is {claim}.', 'Have you heard? {claim}, they say.'],
  'news fav': ["Here's some nice news: {claim}.", 'Did you hear the good news? {claim}.'],

  // Gossip
  'gossip harm': [
    'Have you heard? {claim}.',
    'Keep it to yourself, but {claim}.',
    'I had it from {source}: {claim}.',
    "They're saying {claim}.",
  ],
  'gossip harm hedged': [
    "I heard, maybe, that {claim}. I don't know.",
    'Could be nothing, but {claim}. So they say.',
    "Don't quote me. I heard {claim}.",
  ],
  'gossip fav': [
    "Here's a nice thing: {claim}.",
    'Did you know {claim}? Good of {subjectObj}.',
    "{source} told me {claim}. Nice, isn't it?",
    "You'll like this. {claim}.",
  ],
  'gossip fav hedged': ["I heard, maybe, that {claim}. Wouldn't that be nice?", "Someone said {claim}. I hope it's so.", 'Might be wrong, but {claim}.'],
  'gossip neutral': ['Did you know {claim}?', "Here's a thing for you. {claim}.", '{source} mentioned {claim}.', 'Funny thing: {claim}.'],
  'gossip harm to-subject': [
    "You should know what's being said. {claim}.",
    "I'd want to know, so I'll tell you. Folk are saying {claim}.",
    'People are talking about you. They say {claim}.',
  ],
  'gossip fav to-subject': ['Folk are saying {claim}. Is it true?', "You've a good name today. They say {claim}.", 'I heard {claim}. Good on you.'],
  'gossip any-subject': ['Have you heard the talk going round?', 'You know how folk love a story.', "You can't move in this village for talk."],

  // Warnings: harmful claims only
  'warn harm': [
    'Be careful around {subject}. {claim}.',
    'A word to the wise: {claim}.',
    'Watch your things. {claim}.',
    "I'd keep my distance from {subject}, if I were you.",
  ],
  'warn harm hedged': [
    'It may be nothing, but I heard {claim}. Be careful.',
    "I can't swear to it. Still, mind yourself around {subject}.",
    'I heard, maybe, that {claim}. Just so you know.',
  ],
  'warn harm to-subject': [
    'Mind yourself. People are saying {claim}.',
    "You'd best know: there's talk about you, and it isn't kind.",
    "Watch yourself. They're saying {claim}.",
  ],
  'warn any-subject': ['Mind how you go these days.', "Keep your eyes open. That's all I'll say."],

  // Confiding
  'confide harm': ["I've told nobody else. I think {claim}.", 'This stays between us. {claim}.', "It's been on my mind. {claim}."],
  'confide fav': ["Don't tell a soul, but {claim}.", "Between us, {claim}. I think it's lovely.", 'I found out {claim}. Keep it quiet.'],
  'confide neutral': ['Between us, {claim}.', "I'll tell you, since it's you. {claim}."],
  'confide harm self': ["I've done something I'm not proud of.", 'Can you keep a thing to yourself? {claim}.', 'I need to tell someone. {claim}.'],
  'confide fav self': ["Don't make a fuss, but {claim}.", 'Keep this quiet. {claim}.', "I'd rather nobody knew. {claim}."],
  'confide neutral self': ['Between you and me, {claim}.', 'You might as well know. {claim}.'],
  'confide harm to-subject': ['I have to be honest. I heard {claim}, and I wondered.', "I'd sooner say it to your face. I heard {claim}."],
  'confide any-subject': ['Can I tell you something, just between us?', "I've something on my mind, if you'll hear it."],

  // Accusing
  'accuse harm to-subject': [
    "I know {claim}. Don't pretend.",
    "You did it, didn't you?",
    "Everyone's saying {claim}. Well?",
    "Look me in the eye and say you didn't.",
  ],
  'accuse fav to-subject': ["Don't think I don't know. {claim}.", 'Caught you out. {claim}, and you never said.', 'You kept that quiet. {claim}.'],
  'accuse harm': ['Ask {subject}. Go on, ask.', "{subject} did it. I'll say it to anyone.", 'You all know {claim}.'],
  'accuse fav': ["{subject} won't say it, so I will. {claim}.", 'It was {subject}. {claim}.'],
  'accuse any-subject': ["One of you knows more than you're saying.", 'I want the truth from you, and I want it now.'],

  // Denying
  'deny harm self': ['I did no such thing.', "That's not true, and you know it.", 'Never. Not once.', 'Whoever said that is lying.'],
  'deny fav self': ["Me? No. You've got that wrong.", 'It was nothing. Anyone would have.', "Don't make more of it than it was."],
  'deny neutral self': ["That's not how it was.", "No. You've got it muddled."],
  'deny harm': ["That's not true.", '{subject} never did that.', 'Rubbish. Not {subject}.'],
  'deny fav': ["I don't think that's right.", "No, that wasn't {subject}."],
  'deny harm to-subject': ['I never said that about you.', 'Not from me. I never said you did.'],
  'deny any-subject': ["No. You've got that wrong.", "That's not so, whatever you've heard."],

  // Explaining: often the innocent alternative
  'explain fav self': [
    "It's not what it looks like. {claim}.",
    'If you must know, {claim}.',
    "Here's the truth of it. {claim}.",
    "I didn't want a fuss. {claim}.",
  ],
  'explain neutral self': ["It's nothing like that. {claim}.", "There's a plain answer. {claim}.", 'Ask anyone. {claim}.'],
  'explain harm self': ['I know how it looks.', 'Let me tell it properly before you judge.', "There's more to it than that."],
  'explain fav': ["There's a simpler answer. {claim}.", 'You have it the wrong way round. {claim}.', "Here's what really happened. {claim}."],
  'explain neutral': ["It's nothing of the sort. {claim}.", "There's a plain answer: {claim}.", "That's easy. {claim}."],
  'explain harm': ["There's more to it than people are saying.", "It's not as simple as that."],
  'explain fav firsthand': ['I saw it myself. {claim}.', 'I was there. {claim}.', 'With my own eyes. {claim}.'],
  'explain neutral firsthand': ['I saw it with my own eyes. {claim}.', 'I was standing right there. {claim}.'],
  'explain any-subject': ["It's not what you think.", "Let me explain, if you'll listen."],

  // Defending
  'defend harm': [
    "Leave {subjectObj} be. That's not true.",
    "I've known {subject} all my life. Never.",
    "Who started this? It's wicked.",
    'Not {subject}. Not in a hundred years.',
  ],
  'defend harm firsthand': ["I was there. It wasn't like that.", "I saw it, and that's not what happened."],
  'defend fav': ["It's true. {claim}. Give credit.", 'Good. {claim}, and about time someone said so.', "That's {subject} all over."],
  'defend neutral': ["There's no harm in it. {claim}.", "Leave it. {claim}, that's all."],
  'defend harm to-subject': ["Don't you listen to them.", 'Head up. Nobody with sense believes it of you.', "I know you. I know it isn't true."],
  'defend any-subject': ["Enough. You've said enough.", "That's not fair, and you know it."],

  // Doubting
  'doubt harm': ["That doesn't sound like {subject}.", 'Says who?', "I'll believe it when I see it."],
  'doubt harm hedged': ["I don't know. Maybe. Maybe not.", "I couldn't say either way.", "Hm. I'm not sure of that."],
  'doubt fav': ['{subject}? Really?', 'That would be a first.', "Hm. I'd like to see it."],
  'doubt fav hedged': ["Maybe. I couldn't say.", "It would be nice if it's so."],
  'doubt neutral': ['Is that so?', "I'm not sure that's right."],
  'doubt harm to-subject': ["I'll not believe it till I hear it from you.", "I don't know what to think of you just now."],
  'doubt any-subject': ["I'm not so sure, are you?", 'Hm. Maybe, if you say so.', "You'll forgive me if I wait and see."],

  // Agreeing
  'agree harm': ['I always thought so.', 'That explains a thing or two.', "I'm not surprised. Not really."],
  'agree fav': ['That sounds right.', 'Good. I always liked {subject}.', "That's {subject} for you."],
  'agree neutral': ["That's so.", "I'd heard the same."],
  'agree harm to-subject': ["Don't look at me like that. Everyone knows what you did.", "It's true, isn't it? You can't deny it."],
  'agree fav to-subject': ["It's true, isn't it? Good for you.", "Don't be modest. We all know it was you."],
  'agree any-subject': ["Aye, I'll grant you that.", 'True enough, as you say.', "You're right there."],

  // Apologising
  'apologize harm to-subject': [
    "I'm sorry. I believed {claim}, and I shouldn't have.",
    "I was wrong about you. I'm sorry.",
    'I listened to talk when I should have asked you.',
    'Forgive me. I thought the worst of you.',
  ],
  'apologize fav to-subject': ["I'm sorry I doubted it. {claim}, and I scoffed.", "I should have known it was you. I'm sorry."],
  'apologize harm': ["I'm sorry I passed that on. It wasn't true.", "I shouldn't have said it. I was wrong.", "Forget what I told you. I'm sorry."],
  'apologize harm self': ["I'm sorry. {claim}, and I should have said.", 'I owe you an apology. It was me.'],
  'apologize any-subject': ['I owe you an apology, truly.', "You were owed better. I'm sorry.", 'Can you forgive me?'],

  // Forgiving
  'forgive harm self': ["It's done. Let's leave it.", "You thought the worst of me. I'll let it go.", "All right. We'll say no more.", 'I forgive you. Just ask me next time.'],
  'forgive fav self': ['No harm done.', "It's all right. Forget it."],
  'forgive harm': ["It's done with. Let it go.", 'Least said, soonest mended.'],
  'forgive any-subject': ["It's forgotten. You needn't fret.", 'All right. You and I are square.', "Let's leave it there, you and I."],

  // Refusing
  'refuse harm self': ["I won't answer that here.", "I've nothing to say.", 'Not in front of everyone.'],
  'refuse harm': ["I won't hear it.", 'Keep it to yourself.', "I'm not passing that on."],
  'refuse fav': ["It's not my business either way.", "I'll leave that be."],
  'refuse harm to-subject': ["I'm not getting into that with you.", 'Not now, and not with you.'],
  'refuse any-subject': ["I'll not, and you can't make me.", 'Not today. Ask me another time, if you must.', "I'd rather not, if it's all the same to you."],

  // Reacting to the stranger's whisper. Said to the stranger: never {listener} or {source}.
  'reactToWhisper harm stance:sceptical': ['And who are you to say that?', "A stranger's word? I'll want more than that.", "You'd best be sure of that."],
  'reactToWhisper harm stance:neutral': ['Is that so.', "I'll keep it in mind.", "Hm. I hadn't heard."],
  'reactToWhisper harm stance:receptive': ["I knew something wasn't right.", 'That explains a lot.', 'Is it really? Well, well.'],
  'reactToWhisper fav stance:sceptical': ['Why tell me that?', 'Kind words from a stranger. What do you want?'],
  'reactToWhisper fav stance:neutral': ["That's good to hear.", 'Is that so? Well.'],
  'reactToWhisper fav stance:receptive': ["That's lovely to hear.", 'I always thought well of {subjectObj}.'],
  'reactToWhisper neutral': ['Is that right.', 'Hm. Thank you, I suppose.'],
  'reactToWhisper harm self': ['About me? Say that to my face.', "Who's been telling you that?", "That's a lie, and I'll know who started it."],
  'reactToWhisper fav self': ['Who told you that?', 'Never mind what I do.'],
  'reactToWhisper any-subject': ['Why are you telling me this?', 'Hm. And you are?'],
});
