import { expect, it } from 'vitest';
import { publicKey, sign, verify } from '../src/sign';
import { good, keys, now } from './helpers';

it('signs and verifies, with canonical ordering and tamper detection', async () => {
  const k = await keys();
  const payload = { claim: good, castVersion: 'v1', issuedAt: now };
  const signed = await sign(payload, k.secret);
  expect(await verify(payload, signed.sig, k.publicJwk)).toBe(true);
  expect(signed.sig).toMatch(/^[\w-]{86}$/u);
  expect(await verify({ issuedAt: now, castVersion: 'v1', claim: { ...good } }, signed.sig, publicKey(k.secret))).toBe(true);
  expect(await verify({ ...payload, castVersion: 'v2' }, signed.sig, k.publicJwk)).toBe(false);
  expect(await verify({ ...payload, issuedAt: now + 1 }, signed.sig, k.publicJwk)).toBe(false);
  expect(await verify({ ...payload, claim: { ...good, about: 'ben' } }, signed.sig, k.publicJwk)).toBe(false);
  expect(await verify(payload, 'invalid', k.publicJwk)).toBe(false);
  expect(await verify(payload, signed.sig, (await keys()).publicJwk)).toBe(false);
  expect(publicKey(k.secret)).not.toHaveProperty('d');
});
