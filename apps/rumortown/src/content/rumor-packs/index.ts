import { cast } from '../cast/index.js';
import { readRumorLibrary } from './registry.js';

// A new reviewed JSON file becomes an add-on on the next build, for every visitor.
const sources = import.meta.glob('./packs/*.json', { eager: true, import: 'default' });
export const rumorLibrary = readRumorLibrary(sources, new Map(cast.map(person => [person.id, person])));
