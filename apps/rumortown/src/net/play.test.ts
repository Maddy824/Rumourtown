import { expect, it } from 'vitest';
import { readPlayReply } from './play.js';
it('rejects unrecognized model actions and destinations before the UI offers them', () => {
  const reply = { reply: 'Shall we walk to the square?', action: 'move', target: 'square' };
  expect(readPlayReply(reply, ['square'], ['mira'])).toEqual(reply);
  for (const changed of [{ action: 'kill', target: 'mira' }, { target: 'river' }, { action: 'approach', target: 'outsider' }, { action: 'none' }, { reply: '' }, { extra: 'execute' }]) {
    expect(readPlayReply({ ...reply, ...changed }, ['square'], ['mira'])).toBeNull();
  }
});
