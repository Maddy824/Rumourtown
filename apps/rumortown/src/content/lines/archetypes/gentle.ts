/** Gentle: soft, kind and slow to judge; worries for everyone. Tom, Nell, Fen. */
import { defineSets } from '../define.js';

export const gentleSets = defineSets({ voice: 'gentle' }, {
  greet: [
    "Hello. I hope you're keeping well.",
    "Oh, hello. How are you, really?",
    "There you are. Are you warm enough?",
    "Hello, {listener}. It's good to see you.",
    "Hello. You look tired. Is everything all right?",
    "Hello. Have you eaten?",
  ],
  "greet daypart:morning": ["Good morning. Did you sleep?", "Morning. Lovely and quiet, isn't it?"],
  "greet daypart:evening": ["Good evening. Nearly home time.", "Evening. Have you had your supper?"],
  "greet mood:low": ["Hello. Forgive me, I'm a little low today.", "Oh, hello. I'm all right. Just tired."],
  farewell: ["Look after yourself.", "Go gently.", "I'll let you get on. Take care.", "Bye for now. Keep warm.", "Back to {place}. Do mind the path.", "It was nice to see you."],
  "farewell daypart:evening": ["Good night. Rest well.", "Night. Sleep sound, if you can."],

  news: [
    "Ada's still poorly, poor soul.",
    "The fair's on Sunday now, I think.",
    "There's a stranger about. I hope they're all right.",
    "Sol and Greta's cow had her calf.",
    "The river's high. Do be careful by the bank.",
  ],
  "news neutral": ["I heard {claim}. I thought you'd like to know.", "Someone mentioned {claim}.", "{claim}, I believe.", "Did you hear {claim}?"],

  smalltalk: ["It's a gentle sort of day.", "I hope the day's been kind to you."],
  "smalltalk topic:bread": ["There's nothing kinder than warm bread.", "Bread and soup. That's comfort.", "I always save a crust for the birds.", "Somebody ought to take Ada a loaf."],
  "smalltalk topic:weather": ["The mist was lovely this morning.", "It's cold. Do wrap up.", "Rain later, I think. Bring the washing in.", "The light's soft today. I like that."],
  "smalltalk topic:chores": ["A little at a time, that's how chores get done.", "I've a few things to see to. Nothing hard.", "I like quiet work. It settles the mind.", "Mending, mostly. Always something to mend."],
  "smalltalk topic:the-fair": ["The fair will be nice, if it's dry.", "I like the fair in the evening, with the lanterns.", "I'll go to the fair for a little while.", "Everyone's so happy at the fair."],
  "smalltalk topic:prices": ["Things are dear. Some folk are struggling.", "I try not to mind the prices.", "It's hard for families, with flour so dear.", "We get by. We always do."],
  "smalltalk topic:the-river": ["The river's lovely, but it frightens me when it's high.", "I like to listen to the water.", "Mind the bank. It gives way.", "The river's been loud all week."],
  "smalltalk topic:music": ["I love a slow song.", "The fiddle at the inn is lovely from outside.", "I hum, sometimes, when no one's listening.", "Music helps, on hard days."],
  "smalltalk topic:tiredness": ["You look tired. Do rest.", "I'm a bit weary, but it's a good weary.", "Sleep's the best medicine, they say.", "I could close my eyes right here."],
  "smalltalk topic:tomorrow": ["Tomorrow will be kinder, I expect.", "I'll see what tomorrow brings.", "I've a few visits to make tomorrow.", "Let's not worry about tomorrow yet."],

  "gossip harm": ["I hate to say it, but {claim}.", "I heard {claim}. Poor soul, if it's true.", "{source} said {claim}. I hope it's not so.", "I don't like passing this on. {claim}."],
  "gossip harm hedged": ["I might have it wrong, but I heard {claim}.", "I heard, maybe, that {claim}. I do hope not.", "It's only what I heard. {claim}.", "{source} thought {claim}. I don't know."],
  "gossip fav": ["Oh, I heard {claim}. Isn't that kind?", "Here's something lovely. {claim}.", "{claim}. It made me smile.", "{source} told me {claim}. How kind."],
  "gossip fav hedged": ["I heard, maybe, that {claim}. I hope it's true.", "Someone said {claim}. That would be lovely.", "I'm not sure, but {claim}."],
  "gossip neutral": ["I heard {claim}, if you hadn't.", "{claim}, I think.", "Someone mentioned {claim} to me.", "{source} said {claim}."],
  "gossip harm to-subject": [
    "I'm so sorry. People are saying {claim}.",
    "I thought you'd want to know, gently. They say {claim}.",
    "There's unkind talk about you. I don't believe it.",
  ],

  "warn harm": ["Do be careful around {subject}. {claim}.", "I'd hate for you to be hurt. {claim}.", "Perhaps keep a little distance from {subject}.", "I'm only saying it out of care. {claim}."],
  "warn harm hedged": ["It may be nothing, but do be careful.", "I heard, maybe, that {claim}. Just take care.", "I'm not sure of it. Still, mind yourself.", "Perhaps it's only talk. {claim}. Take care, though."],
  "warn harm to-subject": ["Please take care. People are saying {claim}.", "I'm worried for you. There's talk.", "Mind yourself, dear one. They say {claim}."],

  "confide harm": ["I've not told anyone. {claim}. It worries me.", "Can I tell you? {claim}. I don't know what to do.", "It's weighing on me. {claim}.", "I'd only tell you. {claim}."],
  "confide fav": ["Don't tell, but {claim}. It's so kind.", "I found out {claim}. It warmed my heart.", "Between you and me, {claim}. Isn't it dear?", "Keep it quiet. {claim}. Let them have their secret."],
  "confide neutral": ["Just between us, {claim}.", "I thought you should know, quietly. {claim}.", "Don't mention I said. {claim}.", "I'll tell you, softly. {claim}."],
  "confide harm self": ["I've done something I regret. {claim}.", "Please don't think badly of me. {claim}."],
  "confide fav self": ["Please keep it quiet. {claim}.", "I'd rather it wasn't known. {claim}."],

  "accuse harm to-subject": ["I'm sorry to ask. Did you?", "I heard {claim}. Please tell me it isn't true.", "I don't want to believe it of you.", "Be honest with me, please. Was it you?"],
  "accuse fav to-subject": ["It was you, wasn't it? {claim}. Bless you.", "I know {claim}. You're too modest.", "You kept it so quiet. {claim}.", "Oh, it was you. {claim}."],
  "accuse harm": ["I think it may have been {subject}. I'm sorry.", "I'm afraid it was {subject}."],

  "deny harm self": ["I'd never do that. Truly.", "That isn't true. I promise you.", "Oh, no. I didn't. I couldn't.", "Please believe me. It wasn't me."],
  "deny fav self": ["Oh, it was nothing at all.", "Please, don't thank me.", "I only did what anyone would.", "It wasn't much, honestly."],
  "deny harm": ["I don't think {subject} would.", "That doesn't sound true.", "No, I'm sure that's wrong."],

  "explain fav self": ["I didn't mean anyone to know. {claim}.", "It's only that {claim}.", "I hope you'll understand. {claim}.", "{claim}. I didn't want to make a fuss."],
  "explain harm self": ["Please, let me explain.", "It isn't what it seems. I promise.", "I know how it looks. There's a gentler reason.", "Give me a moment to tell it properly."],
  "explain neutral self": ["There's nothing to it, really. {claim}.", "It's simply that {claim}.", "Nothing secret. {claim}.", "I can tell you. {claim}."],
  "explain fav": ["I think there's a kinder answer. {claim}.", "Perhaps you've not heard. {claim}."],

  "defend harm": ["I don't believe that of {subject}.", "Please, be kind. It's only talk.", "{subject} has always been gentle with me.", "Let's not judge before we know."],
  "defend fav": ["It's true. {claim}. Isn't it lovely?", "Yes, {claim}. I'm glad it's known.", "{claim}. That's a kind heart.", "{subject} deserves the credit."],
  "defend neutral": ["There's nothing wrong in that. {claim}.", "{claim}. Let them be.", "It's innocent. {claim}.", "Be fair. {claim}, that's all."],
  "defend harm to-subject": ["I don't believe it of you. Truly.", "Don't be frightened. I'm with you.", "People will see the truth about you, in time."],

  "doubt harm": ["I don't think that's right.", "That doesn't sound like {subject} to me.", "I'd want to be sure before believing it.", "Perhaps there's another reason."],
  "doubt harm hedged": ["I don't know. I hope not.", "Perhaps. I really don't know.", "It might be. I'd rather not think so."],
  "doubt fav": ["Oh, I'm not sure.", "Do you think so?", "I'd love it to be true.", "Perhaps. I haven't heard."],
  "doubt neutral": ["Are you sure?", "I'm not certain that's so.", "Is it? I didn't know.", "I don't think that's quite right."],
  "doubt any-subject": ["Are you quite sure?", "I'd want to be certain, wouldn't you?"],

  "agree harm": ["I'm afraid it does seem so.", "I'd heard the same. It's sad.", "Yes. I'm sorry to say.", "I think you're right, sadly."],
  "agree fav": ["Oh yes, that's lovely.", "I'd heard that too. How kind.", "That sounds right. Bless {subjectObj}.", "Yes. {subject} is like that."],
  "agree neutral": ["Yes, I think so.", "I believe that's right.", "That's what I heard.", "Yes, that's so."],
  "agree any-subject": ["I think you're right.", "Yes, you're quite right."],

  "apologize harm to-subject": ["I'm so sorry. I believed {claim}.", "Please forgive me. I thought badly of you.", "I should have come to you. I'm sorry.", "I'm sorry for doubting you. Truly."],
  "apologize fav to-subject": ["I'm sorry I didn't believe it was you.", "Forgive me. I didn't think you had.", "I'm sorry. You deserved more credit.", "I should have known you better. Sorry."],
  "apologize harm": ["I'm so sorry I told you that.", "Please forget what I said. It wasn't true."],

  "forgive harm self": ["Of course I forgive you.", "It's all right. Truly.", "There's nothing to forgive, not really.", "I understand. It's forgotten."],
  "forgive fav self": ["Please don't worry.", "It's quite all right.", "You weren't to know, dear.", "No harm at all."],

  "refuse harm self": ["I'd rather not, if you don't mind.", "Please, not here.", "I can't. Not now."],
  "refuse harm": ["I'd prefer not to hear that.", "Let's not talk unkindly.", "I won't pass that on, I'm sorry."],
  "refuse fav": ["Let's leave them their secret.", "It isn't mine to tell.", "Some kindnesses are best kept quiet.", "I'd rather not say."],

  "reactToWhisper harm stance:sceptical": ["I don't think that's kind to say.", "I don't know you. I'd rather not believe it.", "Are you sure? It sounds unkind."],
  "reactToWhisper harm stance:neutral": ["Oh. I see.", "I'll keep it in mind, gently.", "I hadn't heard that."],
  "reactToWhisper harm stance:receptive": ["Oh dear. Poor soul.", "That's so sad to hear.", "I feared something was wrong."],
  "reactToWhisper fav stance:sceptical": ["That's kind. Why tell me?", "I don't know you, but thank you."],
  "reactToWhisper fav stance:neutral": ["How nice.", "That's good to know."],
  "reactToWhisper fav stance:receptive": ["Oh, how lovely.", "That's made me glad."],
  "reactToWhisper neutral": ["Thank you for telling me.", "I'll think on it, gently.", "Oh. Is that so?", "I see. Well."],
  "reactToWhisper harm self": ["About me? Oh. That isn't true.", "Who would say that about me?"],
});
