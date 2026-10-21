/** Blunt: few words, no softening, plain as a plank. Ben, Sol, Ivo, Yan. */
import { defineSets } from '../define.js';

export const bluntSets = defineSets({ voice: 'blunt' }, {
  greet: ["Right, {listener}.", "Hello.", "What's new?", "All well?", "Busy?", "Aye, {listener}."],
  "greet daypart:morning": ["Morning. Cold.", "Morning. Up and about, then."],
  "greet daypart:evening": ["Evening. Done for the day?", "Evening, then."],
  "greet mood:low": ["Not now. Bad day.", "Hm. Leave it, whatever it is."],
  farewell: ["Right. Work.", "That's that, then.", "Off I go.", "Back to {place}. Bye.", "See you, {listener}.", "Enough talk."],
  "farewell daypart:evening": ["Bed. Night.", "Good night. Early start."],

  news: ["Fair's Sunday now.", "River's up.", "Stranger about. Watch them.", "Roof on the chapel's leaking.", "Hal's cart's broke again."],
  "news neutral": ["News is {claim}.", "Heard today: {claim}.", "{claim}. Plain fact.", "{claim}. Thought you should know."],

  smalltalk: ["Quiet.", "Same as ever."],
  "smalltalk topic:bread": ["Bread's dear now.", "Need bread. Always need bread.", "Fresh bread. Best smell there is.", "Crust's the best bit."],
  "smalltalk topic:weather": ["Cold.", "Rain coming.", "Fog this morning. Thick.", "Wind's turned."],
  "smalltalk topic:chores": ["Lot to do.", "Mending. Always mending.", "Hands are full today.", "Wood to chop. Water to fetch."],
  "smalltalk topic:the-fair": ["Sunday, the fair. I'll go.", "Fairs. Noise and pies.", "I'll go for an hour. Maybe.", "Good for trade, the fair."],
  "smalltalk topic:prices": ["Everything's up.", "Too dear.", "Can't pay that.", "Prices. Don't start me."],
  "smalltalk topic:the-river": ["River's full.", "Bank's soft. Mind it.", "Fast water today.", "Brown water. Rain upstream."],
  "smalltalk topic:music": ["Not one for music.", "Fiddle at the inn tonight.", "I'll listen. Won't sing.", "Good tune, that."],
  "smalltalk topic:tiredness": ["Tired.", "Long day, this.", "Bed soon.", "Back aches."],
  "smalltalk topic:tomorrow": ["Tomorrow? Work.", "Same again tomorrow.", "Early start tomorrow.", "Tomorrow's another day."],

  "gossip harm": ["Heard something. {claim}.", "{claim}. Plain as that.", "Word is {claim}. Don't like it.", "{source} says {claim}. Believe it."],
  "gossip harm hedged": ["Might be wrong. {claim}.", "Heard, maybe, that {claim}. Not sure.", "Could be talk. {claim}, they say.", "{source} says {claim}. Don't know."],
  "gossip fav": ["{claim}. Good.", "Heard {claim}. Decent of {subjectObj}.", "Good news. {claim}.", "{source} says {claim}. Good."],
  "gossip fav hedged": ["Might be talk. {claim}. Hope so.", "Not sure, but {claim}.", "Someone said {claim}. Could be."],
  "gossip neutral": ["Something new. {claim}.", "{claim}. Just so you know.", "Heard {claim} today.", "{source} says {claim}. That's all."],
  "gossip harm to-subject": ["They're saying {claim}. You should know.", "Talk about you. {claim}.", "Straight out: folk say {claim}."],

  "warn harm": ["Watch {subject}.", "Careful. {claim}.", "Stay clear of {subject}.", "{claim}. Keep your distance."],
  "warn harm hedged": ["Not sure. Watch {subject} anyway.", "Might be nothing. {claim}. Careful.", "Heard, maybe, that {claim}. Mind yourself.", "Can't swear to it. Be careful."],
  "warn harm to-subject": ["Watch yourself. {claim}, they say.", "People are talking about you. Careful.", "Keep your head down. Folk say {claim}."],

  "confide harm": ["Not a word. {claim}.", "Told nobody. {claim}.", "Keep it quiet. {claim}.", "Bothering me. {claim}."],
  "confide fav": ["Between us. {claim}. Good.", "Quiet, now. {claim}.", "Keep it to yourself. {claim}. Good, that.", "Found out {claim}. Keep it close."],
  "confide neutral": ["Just between us: {claim}.", "Quietly: {claim}.", "Not for spreading. {claim}.", "Thought you'd want to know. {claim}."],
  "confide harm self": ["Did a stupid thing. {claim}.", "Not proud. {claim}."],
  "confide fav self": ["Keep quiet about it. {claim}.", "No fuss. {claim}."],

  "accuse harm to-subject": ["You did it.", "{claim}. Admit it.", "Was it you? Straight answer.", "Don't lie. Did you?"],
  "accuse fav to-subject": ["It was you. {claim}.", "You did that. {claim}. Good.", "{claim}. Don't deny it.", "Caught you. Doing good. {claim}."],
  "accuse harm": ["{subject} did it.", "It was {subject}. Simple."],

  "deny harm self": ["No. Didn't.", "That's not true. Simple.", "Never did.", "Lies."],
  "deny fav self": ["Not me.", "Wasn't anything.", "Don't know about that.", "Leave it. Wasn't me."],
  "deny harm": ["Not {subject}. No.", "Wrong.", "Didn't happen."],

  "explain fav self": ["Fine. {claim}.", "Truth is, {claim}.", "{claim}. Nothing more.", "Simple. {claim}. Done."],
  "explain harm self": ["Not how it looks.", "Listen first.", "There's a reason.", "Let me say it."],
  "explain neutral self": ["Plain answer. {claim}.", "{claim}. That's all it is.", "No secret. {claim}.", "Nothing to it: {claim}."],
  "explain fav": ["Wrong. {claim}.", "No. Truth is {claim}."],

  "defend harm": ["Leave {subjectObj} be.", "Not {subject}.", "Proof? None.", "Wrong. Leave it."],
  "defend fav": ["True. {claim}.", "{claim}. Give credit.", "Right. {claim}. Good.", "{subject} did right."],
  "defend neutral": ["No harm. {claim}.", "{claim}. Nothing wrong with that.", "Leave it. {claim}. That's all.", "{claim}. So what?"],
  "defend harm to-subject": ["I'm with you.", "Don't listen. I don't believe it of you.", "They're wrong about you."],

  "doubt harm": ["Don't believe it.", "Doubt it.", "Who says?", "Not {subject}. Doubt it."],
  "doubt harm hedged": ["Not sure.", "Maybe. Don't know.", "Could be. Can't say."],
  "doubt fav": ["{subject}? Doubt it.", "Hm. Don't think so.", "Not likely.", "I'll see it first."],
  "doubt neutral": ["That right?", "Don't think so.", "Sure about that?", "Hm. Maybe not."],
  "doubt any-subject": ["You sure about that?", "You'll have to show me."],

  "agree harm": ["Aye. True.", "Figured as much.", "That's right.", "Knew it was something."],
  "agree fav": ["Good.", "Aye, that's right.", "Good for {subjectObj}.", "That's fair."],
  "agree neutral": ["Aye, so it is.", "True.", "That's so, aye.", "Right."],
  "agree any-subject": ["You're right.", "As you say."],

  "apologize harm to-subject": ["Wrong about you. Sorry.", "Sorry. Shouldn't have believed it of you.", "My mistake about you. Sorry.", "I owe you. Sorry."],
  "apologize fav to-subject": ["Sorry I doubted you.", "Should've believed it of you. Sorry.", "I was wrong. You did good.", "Sorry. You earned better."],
  "apologize harm": ["Said the wrong thing. Sorry.", "Wrong, what I told you. Sorry."],

  "forgive harm self": ["Done. Forget it.", "All right. Over.", "We're fine.", "Forgiven. Don't do it again."],
  "forgive fav self": ["No matter.", "It's nothing.", "Fine.", "Forget it, I said."],

  "refuse harm self": ["Won't answer that.", "Not here. Not now.", "Nothing to say."],
  "refuse harm": ["Won't hear it.", "Keep that to yourself.", "Not repeating that."],
  "refuse fav": ["None of mine.", "Let it be.", "Their affair.", "Not for me to say."],

  "reactToWhisper harm stance:sceptical": ["Who are you?", "Don't know you.", "Prove it, stranger."],
  "reactToWhisper harm stance:neutral": ["Hm.", "Maybe.", "Heard you."],
  "reactToWhisper harm stance:receptive": ["Thought as much.", "That fits.", "Right. Noted."],
  "reactToWhisper fav stance:sceptical": ["Why tell me?", "What's your game?"],
  "reactToWhisper fav stance:neutral": ["Good, then.", "All right, then."],
  "reactToWhisper fav stance:receptive": ["Good. Glad of it.", "That's good news."],
  "reactToWhisper neutral": ["Hm. All right.", "Noted.", "If you say so.", "Right, then."],
  "reactToWhisper harm self": ["About me? Wrong.", "Who's saying it? Name them."],
});
