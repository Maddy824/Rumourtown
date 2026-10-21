/** Individual everyday voices for the residents of the expanded village. */
import { newcomers } from '../cast/newcomers.js';
import { defineSets } from './define.js';

const observations: Record<string, [string, string]> = {
  suri: ['A bowl should feel right before it looks right.', 'The new clay holds its shape beautifully.'],
  oren: ['I found a loose board before anyone put a foot through it.', 'Borrowed tools ought to go back sharper than they came.'],
  leela: ['There is a book waiting for someone who thinks they dislike reading.', 'You can sit in the reading room without buying anything.'],
  tavi: ['I made a handle that stayed on this time!', 'The kiln is warm enough to make the whole lane smell of rain.'],
  edda: ['The landing is slippery after the evening mist.', 'I would rather arrive late than frighten a passenger.'],
  arun: ['Both bridges in one morning. My boots know this town.', 'The nicest letter is the one somebody has stopped expecting.'],
  bram: ['The garden gate is open. That is the point of a shared garden.', 'A weed does not care whose name is on the plot.'],
  nia: ['Keep the little paper label. It matters when the shoots appear.', 'Two packets can look alike and need entirely different weather.'],
  vesa: ['There is still a warm pot at the teahouse.', 'I put two tables together and three old arguments disappeared.'],
  cora: ['The person at the edge of the room usually knows another ending.', 'A good pause lets someone else into the story.'],
  dara: ['The woodland loop is clear as far as the orchard.', 'Leave the smallest plants. We will need them next year.'],
  silas: ['The commons path is public on both sides of the bridge.', 'I asked the people who walk it before drawing the route.'],
};
export const newcomerSets = newcomers.flatMap(d => defineSets({ speaker: d.id }, {
  greet: ['Hello, {listener}. Have you been across the river today?', 'Good to see you. How is your day going?'],
  smalltalk: [d.catchphrase!, ...observations[d.id]!],
  farewell: ['I should get back to {place}. Walk with me a little?', 'Take care, {listener}. We will catch up again.'],
}));
