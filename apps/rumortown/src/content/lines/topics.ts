/**
 * Small-talk topics and the words used for them. The village canon behind the lines, so that two
 * villagers never contradict each other: it is autumn; mornings are misty and cold and the afternoons
 * fair; rain is threatened and never quite comes; the river is up after rain in the hills; the autumn
 * fair has moved to Sunday; flour is dearer this year; Ada is poorly; Lio plays at the inn of an evening.
 */

export type TopicBand = 'morning' | 'midday' | 'evening';

export const TOPICS_BY_BAND: Readonly<Record<TopicBand, readonly string[]>> = {
  morning: ['bread', 'weather', 'chores'],
  midday: ['the-fair', 'prices', 'the-river'],
  evening: ['music', 'tiredness', 'tomorrow'],
};

export const ALL_TOPICS: readonly string[] = [...TOPICS_BY_BAND.morning, ...TOPICS_BY_BAND.midday, ...TOPICS_BY_BAND.evening];

/** How a topic reads inside a line, for {topic}. */
export const TOPIC_PHRASES: Readonly<Record<string, string>> = {
  bread: 'bread',
  weather: 'the weather',
  chores: 'chores',
  'the-fair': 'the fair',
  prices: 'prices',
  'the-river': 'the river',
  music: 'music',
  tiredness: 'sleep',
  tomorrow: 'tomorrow',
};

/** Minutes since midnight at which each band starts. The day runs 07:00 to 22:00. */
export const MIDDAY_STARTS = 11 * 60;
export const EVENING_STARTS = 16 * 60 + 30;

/** Roles lean their talk toward their trade: a baker brings up bread twice as often. */
export const ROLE_TOPICS: readonly { role: string; topics: readonly string[] }[] = [
  { role: 'baker', topics: ['bread'] },
  { role: 'miller', topics: ['prices', 'the-river'] },
  { role: 'fisher', topics: ['the-river', 'weather'] },
  { role: 'innkeeper', topics: ['music', 'the-fair'] },
  { role: 'weaver', topics: ['tiredness', 'chores'] },
  { role: 'carpenter', topics: ['chores', 'tomorrow'] },
  { role: 'teacher', topics: ['tomorrow', 'weather'] },
  { role: 'shopkeeper', topics: ['prices', 'the-fair'] },
  { role: 'farmer', topics: ['weather', 'prices'] },
  { role: 'blacksmith', topics: ['chores', 'prices'] },
  { role: 'herbalist', topics: ['weather', 'tiredness'] },
  { role: 'chaplain', topics: ['tomorrow', 'music'] },
  { role: 'carter', topics: ['the-fair', 'prices'] },
  { role: 'bridge keeper', topics: ['the-river', 'weather'] },
  { role: 'laundress', topics: ['the-river', 'chores'] },
  { role: 'beekeeper', topics: ['weather', 'the-fair'] },
  { role: 'shepherd', topics: ['weather', 'tiredness'] },
  { role: 'fiddler', topics: ['music', 'the-fair'] },
  { role: 'seamstress', topics: ['the-fair', 'prices'] },
  { role: 'gravedigger', topics: ['weather', 'tomorrow'] },
  { role: 'barmaid', topics: ['music', 'tiredness'] },
  { role: 'tinker', topics: ['the-fair', 'prices'] },
];
