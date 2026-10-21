/** Twelve authored residents connect Eastbank and the commons to the old village. */
import type { ClaimKind, GameClaim, SecretKind } from '../../sim/types.js';
import { day, he, she, they, type DossierDraft } from './kit.js';

type Resident = Omit<DossierDraft, 'pronouns' | 'tier' | 'schedule' | 'secrets' | 'knows'> & {
  pronouns: 'he' | 'she' | 'they';
  story: { kind: ClaimKind; rumor: string; fact: string; secretKind: SecretKind };
};
const residents: Resident[] = [
  {
    "id": "suri",
    "name": "Suri",
    "age": 32,
    "pronouns": "she",
    "role": "potter",
    "home": "home-suri",
    "workplace": "pottery",
    "closeTo": [
      "tavi",
      "mab"
    ],
    "communities": [
      "market",
      "farm"
    ],
    "traits": {
      "honesty": 0.8,
      "emotionality": 0.5,
      "extraversion": 0.6,
      "agreeableness": 0.7,
      "conscientiousness": 0.85,
      "openness": 0.8
    },
    "look": {
      "body": "round",
      "skin": "#C68B60",
      "hair": {
        "style": "bun",
        "color": "#3B2A20"
      },
      "hat": "none",
      "top": "#A65A2E",
      "bottom": "#46505E",
      "prop": "basket"
    },
    "character": {
      "aspiration": "Make affordable pottery that every household can use.",
      "worry": "A broken batch will make people doubt her careful work.",
      "habit": "Keeps a shelf of imperfect bowls for anyone who needs one.",
      "motives": {
        "protect": 0.8,
        "bond": 0.6,
        "status": 0.45,
        "verify": 0.75
      }
    },
    "voice": "Patient and tactile, she compares promises to clay that needs time to set. She asks what a story will do to the person it concerns.",
    "catchphrase": "Let it settle before you shape it.",
    "story": {
      "kind": "hoarding",
      "rumor": "Suri hides good clay so nobody else can use it",
      "fact": "Suri saves clay for a free pottery lesson at the school",
      "secretKind": "gift"
    },
    "rival": "oren"
  },
  {
    "id": "oren",
    "name": "Oren",
    "age": 45,
    "pronouns": "he",
    "role": "boatwright",
    "home": "home-oren",
    "workplace": "boathouse",
    "closeTo": [
      "edda",
      "ivo"
    ],
    "communities": [
      "market",
      "inn"
    ],
    "traits": {
      "honesty": 0.7,
      "emotionality": 0.35,
      "extraversion": 0.55,
      "agreeableness": 0.4,
      "conscientiousness": 0.9,
      "openness": 0.6
    },
    "look": {
      "body": "stout",
      "skin": "#97603A",
      "hair": {
        "style": "cropped",
        "color": "#8F8A84"
      },
      "hat": "cap",
      "top": "#355E3B",
      "bottom": "#46505E",
      "prop": "tool"
    },
    "character": {
      "aspiration": "Build a boat that outlives the person who commissioned it.",
      "worry": "Being rushed will leave someone stranded on the river.",
      "habit": "Checks every borrowed tool against a list before sunset.",
      "motives": {
        "protect": 0.85,
        "bond": 0.4,
        "status": 0.7,
        "verify": 0.85
      }
    },
    "voice": "Blunt about work and shy about praise, he tests a story as he would test a plank. He trusts visible repairs more than confident talk.",
    "catchphrase": "Show me where it leaks.",
    "story": {
      "kind": "theft",
      "rumor": "Oren stole tools from the smithy",
      "fact": "Oren borrowed tools with permission to repair the public landing",
      "secretKind": "borrow"
    },
    "rival": "suri"
  },
  {
    "id": "leela",
    "name": "Leela",
    "age": 37,
    "pronouns": "she",
    "role": "bookseller",
    "home": "home-leela",
    "workplace": "reading-room",
    "closeTo": [
      "arun",
      "elin"
    ],
    "communities": [
      "chapel",
      "market"
    ],
    "traits": {
      "honesty": 0.9,
      "emotionality": 0.45,
      "extraversion": 0.6,
      "agreeableness": 0.8,
      "conscientiousness": 0.8,
      "openness": 0.95
    },
    "look": {
      "body": "slight",
      "skin": "#7E4E30",
      "hair": {
        "style": "braid",
        "color": "#1F1A17"
      },
      "hat": "none",
      "top": "#4B3550",
      "bottom": "#46505E",
      "prop": "book"
    },
    "character": {
      "aspiration": "Give the town a reading room where nobody feels out of place.",
      "worry": "A person who cannot read will be too embarrassed to come inside.",
      "habit": "Writes a recommendation on a scrap of paper with every loan.",
      "motives": {
        "protect": 0.8,
        "bond": 0.7,
        "status": 0.2,
        "verify": 1
      }
    },
    "voice": "Warm and exact, she separates what was said from what someone assumed. She leaves a pause so quieter people can answer.",
    "catchphrase": "Which part did you see yourself?",
    "story": {
      "kind": "hoarding",
      "rumor": "Leela keeps donated books for her own collection",
      "fact": "Leela labels donated books for free loans to the whole village",
      "secretKind": "gift"
    }
  },
  {
    "id": "tavi",
    "name": "Tavi",
    "age": 20,
    "pronouns": "they",
    "role": "kiln apprentice",
    "home": "home-suri",
    "workplace": "pottery",
    "closeTo": [
      "suri",
      "wren"
    ],
    "communities": [
      "market",
      "inn"
    ],
    "traits": {
      "honesty": 0.65,
      "emotionality": 0.8,
      "extraversion": 0.85,
      "agreeableness": 0.7,
      "conscientiousness": 0.45,
      "openness": 0.9
    },
    "look": {
      "body": "slight",
      "skin": "#E3B48F",
      "hair": {
        "style": "curly",
        "color": "#3B2A20"
      },
      "hat": "headscarf",
      "top": "#6D8CC0",
      "bottom": "#46505E",
      "prop": "basket"
    },
    "character": {
      "aspiration": "Make a set of bowls good enough to sign with their own name.",
      "worry": "Every small mistake seems to prove they are not ready.",
      "habit": "Practises handles after work and gives the best attempts away.",
      "motives": {
        "protect": 0.6,
        "bond": 0.95,
        "status": 0.8,
        "verify": 0.35
      }
    },
    "voice": "Quick and eager, they repeat exciting news before remembering to ask where it began. They soften immediately when someone sounds hurt.",
    "catchphrase": "Wait, tell me that bit again.",
    "story": {
      "kind": "shirking",
      "rumor": "Tavi leaves the kiln to sleep through the afternoon",
      "fact": "Tavi leaves the kiln to shape free bowls for the school meals",
      "secretKind": "practice"
    }
  },
  {
    "id": "edda",
    "name": "Edda",
    "age": 52,
    "pronouns": "she",
    "role": "river guide",
    "home": "home-oren",
    "workplace": "boathouse",
    "closeTo": [
      "oren",
      "ben"
    ],
    "communities": [
      "farm",
      "inn"
    ],
    "traits": {
      "honesty": 0.85,
      "emotionality": 0.35,
      "extraversion": 0.65,
      "agreeableness": 0.8,
      "conscientiousness": 0.9,
      "openness": 0.6
    },
    "look": {
      "body": "tall",
      "skin": "#663D26",
      "hair": {
        "style": "short",
        "color": "#8F8A84"
      },
      "hat": "wide",
      "top": "#2F6F6D",
      "bottom": "#46505E",
      "prop": "tool"
    },
    "character": {
      "aspiration": "Keep every crossing calm enough that nervous travellers return.",
      "worry": "One careless boast about the river could put someone in danger.",
      "habit": "Checks the landing ropes even when it is someone else’s turn.",
      "motives": {
        "protect": 1,
        "bond": 0.65,
        "status": 0.15,
        "verify": 0.9
      }
    },
    "voice": "Unhurried and practical, she answers alarm with a question about the current. She will interrupt a cruel story but seldom a shy speaker.",
    "catchphrase": "A calm voice gets us across.",
    "story": {
      "kind": "cheating",
      "rumor": "Edda charges frail neighbours twice the usual fare",
      "fact": "Edda records free crossings for neighbours who cannot manage the bridge",
      "secretKind": "gift"
    }
  },
  {
    "id": "arun",
    "name": "Arun",
    "age": 26,
    "pronouns": "he",
    "role": "courier",
    "home": "home-leela",
    "workplace": "posthouse",
    "closeTo": [
      "leela",
      "hal"
    ],
    "communities": [
      "market",
      "inn"
    ],
    "traits": {
      "honesty": 0.85,
      "emotionality": 0.65,
      "extraversion": 0.9,
      "agreeableness": 0.7,
      "conscientiousness": 0.75,
      "openness": 0.8
    },
    "look": {
      "body": "tall",
      "skin": "#B07547",
      "hair": {
        "style": "cropped",
        "color": "#1F1A17"
      },
      "hat": "cap",
      "top": "#C28E2C",
      "bottom": "#46505E",
      "prop": "sack"
    },
    "character": {
      "aspiration": "Carry letters far enough that this town feels less cut off.",
      "worry": "A delayed message will be mistaken for a broken promise.",
      "habit": "Checks the seals before stopping for tea at either end of a route.",
      "motives": {
        "protect": 0.7,
        "bond": 0.95,
        "status": 0.55,
        "verify": 0.65
      }
    },
    "voice": "Breathless but considerate, he tells stories in the order he reached each doorstep. He becomes very precise when someone questions a letter’s seal.",
    "catchphrase": "It was sealed when it reached me.",
    "story": {
      "kind": "theft",
      "rumor": "Arun keeps neighbours’ letters instead of delivering them",
      "fact": "Arun sorts delayed letters into a free evening delivery round",
      "secretKind": "delivery"
    }
  },
  {
    "id": "bram",
    "name": "Bram",
    "age": 63,
    "pronouns": "he",
    "role": "community gardener",
    "home": "home-bram",
    "workplace": "gardens",
    "closeTo": [
      "nia",
      "sol"
    ],
    "communities": [
      "farm",
      "chapel"
    ],
    "traits": {
      "honesty": 0.85,
      "emotionality": 0.3,
      "extraversion": 0.35,
      "agreeableness": 0.8,
      "conscientiousness": 0.9,
      "openness": 0.5
    },
    "look": {
      "body": "stout",
      "skin": "#D6A07A",
      "hair": {
        "style": "bald",
        "color": "#3B2A20"
      },
      "hat": "straw",
      "top": "#5A6772",
      "bottom": "#46505E",
      "prop": "tool"
    },
    "character": {
      "aspiration": "Leave a garden that younger neighbours know how to tend.",
      "worry": "A shared plot will quietly become somebody’s private property.",
      "habit": "Leaves the first basket of ripe vegetables by the public gate.",
      "motives": {
        "protect": 0.9,
        "bond": 0.4,
        "status": 0.3,
        "verify": 0.85
      }
    },
    "voice": "Slow and dry, he lets a silence grow before answering. He measures fairness in who gets the first harvest.",
    "catchphrase": "Who gets a share of it?",
    "story": {
      "kind": "hoarding",
      "rumor": "Bram keeps the community harvest for himself",
      "fact": "Bram sets the first harvest aside for neighbours with empty cupboards",
      "secretKind": "gift"
    },
    "rival": "silas"
  },
  {
    "id": "nia",
    "name": "Nia",
    "age": 31,
    "pronouns": "she",
    "role": "seed keeper",
    "home": "home-bram",
    "workplace": "seedshop",
    "closeTo": [
      "bram",
      "cass"
    ],
    "communities": [
      "farm",
      "market"
    ],
    "traits": {
      "honesty": 0.8,
      "emotionality": 0.55,
      "extraversion": 0.55,
      "agreeableness": 0.7,
      "conscientiousness": 0.85,
      "openness": 0.9
    },
    "look": {
      "body": "round",
      "skin": "#4E2E1D",
      "hair": {
        "style": "braid",
        "color": "#8F8A84"
      },
      "hat": "bonnet",
      "top": "#8C7AA8",
      "bottom": "#46505E",
      "prop": "basket"
    },
    "character": {
      "aspiration": "Preserve seeds that the town can still grow after a bad winter.",
      "worry": "A fashionable crop will crowd out varieties she cannot replace.",
      "habit": "Trades a growing tip with every packet and keeps careful labels.",
      "motives": {
        "protect": 0.75,
        "bond": 0.6,
        "status": 0.4,
        "verify": 0.95
      }
    },
    "voice": "Curious and methodical, she asks for dates and conditions before trusting a result. Her enthusiasm grows when someone admits they are still learning.",
    "catchphrase": "What grew from it last time?",
    "story": {
      "kind": "hoarding",
      "rumor": "Nia hides the best seed from the village",
      "fact": "Nia reserves donated seed for the community garden’s free planting day",
      "secretKind": "gift"
    }
  },
  {
    "id": "vesa",
    "name": "Vesa",
    "age": 40,
    "pronouns": "they",
    "role": "teahouse keeper",
    "home": "home-vesa",
    "workplace": "teahouse",
    "closeTo": [
      "cora",
      "tess"
    ],
    "communities": [
      "inn",
      "market"
    ],
    "traits": {
      "honesty": 0.7,
      "emotionality": 0.6,
      "extraversion": 0.9,
      "agreeableness": 0.85,
      "conscientiousness": 0.7,
      "openness": 0.7
    },
    "look": {
      "body": "round",
      "skin": "#EECBAE",
      "hair": {
        "style": "curly",
        "color": "#1F1A17"
      },
      "hat": "none",
      "top": "#8E3B2E",
      "bottom": "#46505E",
      "prop": "loaf"
    },
    "character": {
      "aspiration": "Make a teahouse where people from both riverbanks sit together.",
      "worry": "The room will become a place to take sides instead of listen.",
      "habit": "Places a spare cup beside anyone who has arrived alone.",
      "motives": {
        "protect": 0.85,
        "bond": 1,
        "status": 0.35,
        "verify": 0.55
      }
    },
    "voice": "Hospitable and gently persistent, they ask what happened after the dramatic part. They remember who left the table upset.",
    "catchphrase": "There is room for another cup.",
    "story": {
      "kind": "broken-promise",
      "rumor": "Vesa refuses to repay the teahouse suppliers",
      "fact": "Vesa settles the last supplier debt and files the paid receipt",
      "secretKind": "debt"
    }
  },
  {
    "id": "cora",
    "name": "Cora",
    "age": 57,
    "pronouns": "she",
    "role": "storyteller",
    "home": "home-vesa",
    "workplace": "reading-room",
    "closeTo": [
      "vesa",
      "lio"
    ],
    "communities": [
      "chapel",
      "inn"
    ],
    "traits": {
      "honesty": 0.65,
      "emotionality": 0.6,
      "extraversion": 0.85,
      "agreeableness": 0.8,
      "conscientiousness": 0.6,
      "openness": 0.95
    },
    "look": {
      "body": "round",
      "skin": "#B07547",
      "hair": {
        "style": "long",
        "color": "#3B2A20"
      },
      "hat": "headscarf",
      "top": "#6E3B5C",
      "bottom": "#46505E",
      "prop": "book"
    },
    "character": {
      "aspiration": "Collect ordinary lives before the town forgets who lived them.",
      "worry": "A vivid story may replace a quieter truth in everyone’s memory.",
      "habit": "Asks permission before turning somebody’s trouble into a tale.",
      "motives": {
        "protect": 0.8,
        "bond": 0.95,
        "status": 0.45,
        "verify": 0.7
      }
    },
    "voice": "Musical and attentive, she notices the difference between an audience and a witness. She enjoys a good story but asks whose version is missing.",
    "catchphrase": "Who has not had a turn to speak?",
    "story": {
      "kind": "shirking",
      "rumor": "Cora refuses to teach unless someone pays her",
      "fact": "Cora gives a free reading lesson after the paid storytelling hour",
      "secretKind": "practice"
    }
  },
  {
    "id": "dara",
    "name": "Dara",
    "age": 34,
    "pronouns": "they",
    "role": "woodland ranger",
    "home": "home-dara",
    "workplace": "woodland",
    "closeTo": [
      "silas",
      "nell"
    ],
    "communities": [
      "farm",
      "chapel"
    ],
    "traits": {
      "honesty": 0.9,
      "emotionality": 0.4,
      "extraversion": 0.3,
      "agreeableness": 0.7,
      "conscientiousness": 0.95,
      "openness": 0.75
    },
    "look": {
      "body": "tall",
      "skin": "#97603A",
      "hair": {
        "style": "short",
        "color": "#8F8A84"
      },
      "hat": "hood",
      "top": "#46505E",
      "bottom": "#46505E",
      "prop": "tool"
    },
    "character": {
      "aspiration": "Keep a woodland path open without stripping the trees around it.",
      "worry": "People will treat a temporary closure as a personal insult.",
      "habit": "Marks loose branches before taking a break in the clearing.",
      "motives": {
        "protect": 1,
        "bond": 0.35,
        "status": 0.2,
        "verify": 0.95
      }
    },
    "voice": "Quiet and observant, they describe tracks and distances instead of guessing motives. They raise their voice only when someone ignores a warning.",
    "catchphrase": "Look at what is underfoot.",
    "story": {
      "kind": "hoarding",
      "rumor": "Dara closes the woodland path to keep the herbs for themself",
      "fact": "Dara closes a short stretch to clear a dangerous fallen branch",
      "secretKind": "practice"
    }
  },
  {
    "id": "silas",
    "name": "Silas",
    "age": 48,
    "pronouns": "he",
    "role": "surveyor",
    "home": "home-dara",
    "workplace": "woodland",
    "closeTo": [
      "dara",
      "tom"
    ],
    "communities": [
      "farm",
      "market"
    ],
    "traits": {
      "honesty": 0.75,
      "emotionality": 0.5,
      "extraversion": 0.5,
      "agreeableness": 0.45,
      "conscientiousness": 0.95,
      "openness": 0.8
    },
    "look": {
      "body": "slight",
      "skin": "#F4D9C2",
      "hair": {
        "style": "short",
        "color": "#1F1A17"
      },
      "hat": "wide",
      "top": "#7A5638",
      "bottom": "#46505E",
      "prop": "ledger"
    },
    "character": {
      "aspiration": "Draw a map that gives every neighbour a fair route through town.",
      "worry": "A line he draws will be used to settle a dispute he did not intend.",
      "habit": "Checks a boundary twice and asks the people who walk it daily.",
      "motives": {
        "protect": 0.55,
        "bond": 0.45,
        "status": 0.85,
        "verify": 0.95
      }
    },
    "voice": "Careful and formal, he distinguishes a boundary from a barrier. He gets defensive when precision is mistaken for taking sides.",
    "catchphrase": "A line needs two agreed ends.",
    "story": {
      "kind": "lying",
      "rumor": "Silas hides the map so neighbours cannot cross the commons",
      "fact": "Silas pins free copies of the commons footpaths for everyone to use",
      "secretKind": "gift"
    },
    "rival": "bram"
  }
];

export const newcomers: DossierDraft[] = residents.map(({ story, pronouns, ...d }, i) => ({
  ...d, pronouns: { he, she, they }[pronouns], tier: 'regular',
  schedule: day([
    [0, d.home, 'rest'], [20 + i * 3, d.workplace, 'work'],
    [280 + i * 2, d.home, 'eat'], [350 + (i % 3) * 10, i % 2 ? 'shop' : 'bakery', 'errand'],
    [430, d.workplace, 'secret'], [570, d.workplace, 'work'],
    [650, i % 3 === 0 ? 'inn' : i % 3 === 1 ? 'square' : 'chapel', 'talk'], [780, d.home, 'rest'],
  ]),
  secrets: [{ id: `${d.id}-private-work`, kind: story.secretKind, description: story.fact,
    place: d.workplace, window: [540, 565], confirms: [story.secretKind === 'debt' ? 'paid-debt' : 'kindness'], contradicts: [story.kind] }],
  knows: [{ claimId: `${d.id}-quiet-kindness`, confidence: .98 }],
}));

export const newClaims: GameClaim[] = residents.flatMap(d => {
  const harmful = `${d.id}-village-rumor`, innocent = `${d.id}-quiet-kindness`;
  return [
    { id: harmful, about: d.id, kind: d.story.kind, valence: -1 as const, severity: 2 as const,
      text: d.story.rumor, contradicts: [innocent] },
    { id: innocent, about: d.id, kind: d.story.secretKind === 'debt' ? 'paid-debt' as const : 'kindness' as const,
      valence: 1 as const, severity: 1 as const, text: d.story.fact, contradicts: [harmful], alternativeOf: harmful },
  ];
});
