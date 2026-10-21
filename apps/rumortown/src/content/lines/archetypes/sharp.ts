/** Sharp: quick, exact, a little cutting; notices everything and says most of it. Mira, Pim, Mab, Tess. */
import { defineSets } from '../define.js';

export const sharpSets = defineSets({ voice: 'sharp' }, {
  greet: [
    "Well, well. Look who's out.",
    "Hello. You're looking almost respectable.",
    "{listener}. You've timed that well.",
    "Ah. I wondered when you'd appear.",
    "Hello. What have you heard? Out with it.",
    "Hello. You look like you've been up to something.",
  ],
  "greet daypart:morning": ["Morning. You look like you slept in a hedge.", "Up already? Wonders."],
  "greet daypart:evening": ["Evening. Escaped, have you?", "Evening. Still upright, I see."],
  "greet mood:low": ["Not now. I'm in no mood.", "Hello. Don't test me today."],
  farewell: [
    "Right. I've better things to do. Probably.",
    "Off you go. Don't trip.",
    "Well, that was something.",
    "Back to {place}. The world won't run itself.",
    "Goodbye. Try to behave.",
    "I'll leave you to your mischief.",
  ],
  "farewell daypart:evening": ["Night. Don't do anything I'd hear about.", "Good night. Mind the dark, it's full of fools."],

  news: [
    "Fair's on Sunday. Someone finally made a decision.",
    "There's a stranger about. Too quiet by half.",
    "Pim's raised his prices. Shocking. Not really.",
    "Hal lost a wheel on the north road. Again.",
    "Otto's passing the plate for the roof again.",
  ],
  "news neutral": ["Here's news. {claim}.", "You'll love this. {claim}.", "Did you know {claim}? Of course not.", "{claim}. Now you're informed."],

  smalltalk: ["Nothing happens here, and everyone talks about it.", "Another day of fools and weather."],
  "smalltalk topic:bread": [
    "Bread's gone up and the loaves have gone down. Funny, that.",
    "A good loaf and a sharp knife. That's all I ask.",
    "Mira's bread is good. Don't tell her, it'll go to her head.",
    "Stale bread and stale talk. Plenty of both.",
  ],
  "smalltalk topic:weather": ["Mist again. How original.", "Cold enough to freeze a smile. Not that I'd know.", "It'll rain on the fair. It always does.", "Fine afternoon. Enjoy it, it won't last."],
  "smalltalk topic:chores": ["Everything wants doing and nobody wants to do it.", "I've a list. It's longer than my patience.", "Mend it properly or don't bother.", "Half this village couldn't sweep a step."],
  "smalltalk topic:the-fair": [
    "The fair. Everyone in their best, behaving their worst.",
    "Sunday, now. Someone couldn't make up their mind.",
    "I'll go to the fair to watch people make fools of themselves.",
    "Fair prices at the fair? Don't make me laugh.",
  ],
  "smalltalk topic:prices": ["Prices up, quality down. Remarkable.", "Some folk charge like it's a privilege to pay them.", "I know what things cost. I always know.", "Haggle? I don't haggle. I correct."],
  "smalltalk topic:the-river": ["River's high. So are tempers.", "Someone will fall in this week. My money's on Hal.", "The bridge is held together by hope and Dag.", "The river's the only thing round here that keeps moving."],
  "smalltalk topic:music": ["The fiddle's fine. The singing is a crime.", "Music at the inn. Wool in my ears at home.", "Everyone thinks they can sing after cider.", "A good tune is rare. Like good sense."],
  "smalltalk topic:tiredness": ["Tired? Of the company, mostly.", "I'd sleep if people stopped talking.", "Exhausted. Fools are tiring.", "I'll rest when there's nothing left to fix."],
  "smalltalk topic:tomorrow": [
    "Tomorrow? More of the same, with worse weather.",
    "I'll deal with tomorrow when it's foolish enough to arrive.",
    "Tomorrow, I'll be right about something. I usually am.",
    "Plans for tomorrow? Avoiding nonsense.",
  ],

  "gossip harm": ["Oh, you'll enjoy this. {claim}.", "{claim}. I can't say I'm shocked.", "{source} told me {claim}, and I believed every word.", "Brace yourself. {claim}."],
  "gossip harm hedged": ["I heard, maybe, that {claim}. I'm reserving judgement. Barely.", "It's only talk. {claim}. Still.", "Unconfirmed, mind. {claim}.", "{source} says {claim}. I'd want proof."],
  "gossip fav": ["Credit where it's due, for once. {claim}.", "Don't faint. {claim}.", "{claim}. Who knew there was decency left?", "{source} says {claim}. I suppose that's nice."],
  "gossip fav hedged": ["I heard, maybe, that {claim}. We'll see.", "Allegedly, {claim}.", "{source} claims {claim}. Show me."],
  "gossip neutral": ["{claim}. In case you care.", "Did you know {claim}? Thrilling.", "{source} let it drop that {claim}.", "Small news: {claim}."],
  "gossip harm to-subject": ["You'd better hear it. They're saying {claim}.", "There's talk about you, and it's not flattering.", "I'll be blunt. Folk say {claim}."],

  "warn harm": ["Watch {subject}. Closely.", "{claim}. I'd keep my wits about me.", "I'd not trust {subject} as far as I could throw a cart.", "A friendly word, for once. {claim}."],
  "warn harm hedged": ["It may be nothing. It usually is. But {claim}.", "I heard, maybe, that {claim}. Act accordingly.", "Not proven. Still, watch {subject}.", "Probably talk. Probably. Mind yourself."],
  "warn harm to-subject": ["Watch yourself. Someone's telling tales about you.", "They say {claim}. I'd find out who.", "People are saying {claim}. You might want to do something about it."],

  "confide harm": ["Keep this under your hat. {claim}.", "I'll tell you because you can keep your mouth shut. {claim}.", "It's not for repeating. {claim}.", "I've said this to nobody. {claim}."],
  "confide fav": ["Don't tell anyone I said something nice. {claim}.", "Between us, {claim}. Rather decent.", "I found out {claim}. Don't make a fuss.", "Quietly, now. {claim}."],
  "confide neutral": ["Between ourselves, {claim}.", "For your ears only. {claim}.", "Not a word to anyone. {claim}.", "You'll want to know this. Quietly. {claim}."],
  "confide harm self": ["I'll admit it to you and nobody else. {claim}.", "Don't gloat. {claim}."],
  "confide fav self": ["Don't you dare spread it. {claim}.", "Keep it quiet. I have a reputation. {claim}."],

  "accuse harm to-subject": ["Don't insult me with a lie. Did you?", "I know {claim}. I always know.", "{claim}. Go on, explain yourself.", "You thought you were clever. You weren't."],
  "accuse fav to-subject": ["So it was you. {claim}. Sneaky.", "Don't look so innocent. {claim}.", "You've been doing good behind our backs. {claim}.", "Well. {claim}. You hid that well."],
  "accuse harm": ["It was {subject}. Anyone with eyes could see it.", "Ask {subject}. If you want a laugh."],

  "deny harm self": ["Oh, please. As if I would.", "That's a lie, and a lazy one.", "Me? I've more sense.", "Whoever said that wants their head examined."],
  "deny fav self": ["Kind? I'll thank you not to spread that.", "Nonsense. I've a reputation.", "That wasn't kindness. That was sense.", "Don't go telling people I'm nice."],
  "deny harm": ["Rubbish. {subject} hasn't the nerve.", "That's nonsense, and you know it.", "No. Wrong person entirely."],

  "explain fav self": ["If you insist on knowing. {claim}.", "{claim}. There. Satisfied?", "It's hardly a secret now. {claim}.", "Don't make it a story. {claim}."],
  "explain harm self": ["Before you decide I'm a villain, listen.", "It looks bad. It isn't. Pay attention.", "You've half the facts. Here are the rest.", "Let me spell it out, since nobody else will."],
  "explain neutral self": ["It's dull, I'm afraid. {claim}.", "No scandal, sorry. {claim}.", "Nothing wicked. {claim}.", "Use your sense. {claim}."],
  "explain fav": ["You're wrong, as it happens. {claim}.", "There's a better explanation. {claim}."],

  "defend harm": ["Oh, don't be ridiculous. Not {subject}.", "Where's your proof? I'll wait.", "That's spite, not sense.", "{subject}? Hardly. Try again."],
  "defend fav": ["It's true. {claim}. Shocking, I know.", "{claim}. Credit costs you nothing.", "Yes, {claim}. Try it yourself sometime.", "{subject} did well. Note it."],
  "defend neutral": ["So? {claim}. Hardly a crime.", "{claim}. Is that all?", "That's nothing. {claim}.", "Honestly. {claim}, and you're all aflutter."],
  "defend harm to-subject": ["Hold your head up. You've done nothing.", "Don't let them see you rattled.", "They're fools. You know what you are."],

  "doubt harm": ["I doubt that very much.", "Who told you that? Consider the source.", "Convenient story.", "Proof, please."],
  "doubt harm hedged": ["Possibly. I'm not convinced.", "Maybe. I'll reserve judgement.", "Hm. Unproven."],
  "doubt fav": ["{subject}? Generous? Please.", "Kindness? Really. I'll need convincing.", "Hm. Not likely.", "That's a nice story."],
  "doubt neutral": ["Is that so? I doubt it.", "Hm. Sounds wrong.", "I'd check that.", "Says who, precisely?"],
  "doubt any-subject": ["You don't believe that, surely?", "Really? You think so?"],

  "agree harm": ["Obviously.", "Well, of course.", "I said so weeks ago.", "Took you long enough."],
  "agree fav": ["Yes. Credit to {subjectObj}.", "That's right. Remarkable.", "Fine. {subject} did well.", "I'll grant that."],
  "agree neutral": ["Quite.", "Correct.", "As it happens, yes.", "Naturally."],
  "agree any-subject": ["You're right, for once.", "I'll give you that."],

  "apologize harm to-subject": [
    "I was wrong about you. Don't get used to hearing it.",
    "I believed {claim}. Foolish. I'm sorry.",
    "I owe you an apology. Here it is.",
    "I misjudged you. It won't happen again.",
  ],
  "apologize fav to-subject": ["I doubted it was you. I was wrong.", "Fine. You did it. I'm sorry I scoffed.", "I gave you no credit. I'm sorry.", "Sorry. You're better than I gave you credit for."],
  "apologize harm": ["I was wrong to repeat it. Sorry.", "Forget what I told you. It was rubbish."],

  "forgive harm self": ["Fine. Forgiven. Don't do it again.", "I'll let it go. This once.", "Forgiven. Not forgotten.", "All right. We're even. Just about."],
  "forgive fav self": ["No harm done. This time.", "Never mind. I've moved on.", "It's nothing. Don't fuss.", "Don't grovel. It's fine."],

  "refuse harm self": ["I won't dignify that.", "Not in front of this audience.", "Ask me privately, if you dare."],
  "refuse harm": ["I don't deal in rumours.", "Keep it. I'm not interested.", "Spare me the gossip."],
  "refuse fav": ["Not mine to tell.", "I'll not gossip, even pleasantly.", "Leave them be.", "No. Let it lie quietly."],

  "reactToWhisper harm stance:sceptical": ["And you are? A stranger with opinions.", "Convenient, a stranger knowing that.", "I'll check that, and then I'll check you."],
  "reactToWhisper harm stance:neutral": ["Interesting. If true.", "Hm. Noted.", "I'll consider it."],
  "reactToWhisper harm stance:receptive": ["I knew it. Obviously.", "That's no surprise to me.", "Well, well. There it is."],
  "reactToWhisper fav stance:sceptical": ["A kind word from a stranger. What's the catch?", "And why would you tell me that?"],
  "reactToWhisper fav stance:neutral": ["Well. That's pleasant.", "Fine. Good, then."],
  "reactToWhisper fav stance:receptive": ["Good. Someone deserves it.", "That's welcome news."],
  "reactToWhisper neutral": ["Is that so. Fascinating.", "If you say so.", "And?", "Noted, stranger."],
  "reactToWhisper harm self": ["About me? Bold. Wrong, but bold.", "Who's been telling you lies about me?"],
});
