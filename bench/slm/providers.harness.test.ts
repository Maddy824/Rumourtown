import { expect, test, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fixtures from './fixtures/providers.json';
import { ACCOUNT, mock, ollama, readWranglerToken, workersAI, type Request } from './providers.ts';

const request: Request = { model: 'qwen3:0.6b', messages: [{ role: 'user', content: 'Hello' }],
  seed: 42, temperature: .7, maxTokens: 64, format: { type: 'object', properties: { reply: { type: 'string' } } } };
const transport = (body: unknown, status = 200) => vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));

test('Ollama recorded response, seeded schema request and nanosecond throughput', async () => {
  const fetch = transport(fixtures.ollama);
  const result = await ollama({ fetch }).generate(request);
  expect(fetch.mock.calls[0]![0]).toBe('http://127.0.0.1:11434/api/chat');
  expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({ model: request.model, messages: request.messages,
    stream: false, think: false, format: request.format, options: { seed: 42, temperature: .7, num_predict: 64 } });
  expect(result).toMatchObject({ provider: 'ollama', inputTokens: 40, outputTokens: 12, tokensPerSecond: 12, costUsd: 0, memoryBytes: null });
  expect(result.latencyMs).toBeGreaterThanOrEqual(0);
});
test('Workers recorded response, REST path, OAuth header and JSON schema', async () => {
  const fetch = transport(fixtures.workers), secret = 'test-only-never-a-live-token';
  const result = await workersAI({ fetch, token: async () => secret }).generate({ ...request, model: '@cf/meta/llama-3.2-3b-instruct' });
  expect(fetch.mock.calls[0]![0]).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/%40cf/meta/llama-3.2-3b-instruct`);
  expect(fetch.mock.calls[0]![1]!.headers).toMatchObject({ Authorization: `Bearer ${secret}` });
  expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toMatchObject({ response_format: { type: 'json_schema', json_schema: request.format } });
  expect(result).toMatchObject({ provider: 'workers-ai', inputTokens: 40, outputTokens: 12, costUsd: null });
  expect(JSON.stringify(result)).not.toContain(secret);
});
test('unreported usage is null and errors never echo provider secrets', async () => {
  const absent = await workersAI({ fetch: transport({ success: true, result: { response: 'Hello' } }), token: async () => 'secret' }).generate(request);
  expect(absent.outputTokens).toBeNull(); expect(absent.tokensPerSecond).toBeNull();
  for (const fetch of [transport({ error: 'secret' }, 401), transport(fixtures.workersFailure),
    vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('Authorization: secret')),
    vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('secret', { status: 200 }))]) {
    await expect(workersAI({ fetch, token: async () => 'secret' }).generate(request)).rejects.not.toThrow('secret');
  }
  await expect(ollama({ fetch: transport({ ...fixtures.ollama, done: false }) }).generate(request)).rejects.toThrow('Invalid Ollama');
});
test('Wrangler parser reads quoted OAuth config and gives sanitised failures', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'slm-token-'));
  try {
    const path = join(directory, 'default.toml');
    await writeFile(path, 'oauth_token = "fixture-secret"\nrefresh_token = "not-used"\n');
    expect(await readWranglerToken(path)).toBe('fixture-secret');
    await writeFile(path, 'oauth_token = ""\n');
    await expect(readWranglerToken(path)).rejects.toThrow('token is missing');
    await expect(readWranglerToken(join(directory, 'absent'))).rejects.toThrow('configuration is unavailable');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('mock fixtures have finite sequences and schema-aware defaults', async () => {
  const provider = mock(['one']); expect((await provider.generate(request)).text).toBe('one');
  await expect(provider.generate(request)).rejects.toThrow('exhausted');
  expect(JSON.parse((await mock().generate(request)).text)).toEqual({ uses: [], reply: 'I have not heard about that.' });
});
