import { expect, it } from 'vitest';
import { askVillage, readPlayReply, type PlayContext } from './play.js';
it('rejects unrecognized model actions and destinations before the UI offers them', () => {
  const reply = { reply: 'Shall we walk to the square?', action: 'move', target: 'square' };
  expect(readPlayReply(reply, ['square'], ['mira'])).toEqual(reply);
  for (const changed of [{ action: 'kill', target: 'mira' }, { target: 'river' }, { action: 'approach', target: 'outsider' }, { action: 'none' }, { reply: '' }, { extra: 'execute' }]) {
    expect(readPlayReply({ ...reply, ...changed }, ['square'], ['mira'])).toBeNull();
  }
});

it.each(['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', 'hidden\ncommand', 'porn,visitor'])(
  'rejects markup, controls and blocked model prose: %s', reply => {
    expect(readPlayReply({ reply, action: 'none', target: '' }, ['square'], ['mira'])).toBeNull();
  });

const context: PlayContext = { speaker: null, nearby: [], places: [], voice: '', history: [] };
const ask = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  askVillage('Hello', context, { baseUrl: 'https://test.invalid', token: 't', signal: new AbortController().signal, people: [],
    fetch: async () => Response.json(body, { status, headers }) });

it('tells a short burst apart from the hourly allowance', async () => {
  await expect(ask(429, { reason: 'limit-visitor' }, { 'Retry-After': '60' })).rejects.toThrow('Wait a minute');
  await expect(ask(429, { reason: 'limit-visitor' }, { 'Retry-After': '3600' })).rejects.toThrow('hourly AI limit');
  await expect(ask(429, { reason: 'limit-visitor' })).rejects.toThrow('hourly AI limit');
});
it('explains a resting shared allowance', async () => {
  await expect(ask(503, { reason: 'budget' })).rejects.toThrow('shared AI allowance is resting');
});
