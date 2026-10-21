import { expect, it } from 'vitest';
import { publicKey, serialise, sign, verify } from '../src/sign';
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

it('signs only explicit fields in fixed order and rejects additions at either level', async () => {
  const k = await keys();
  const payload = { issuedAt: now, castVersion: 'v1', claim: { ...good } };
  const signed = await sign(payload, k.secret);
  expect(Object.keys(signed)).toEqual(['claim', 'castVersion', 'issuedAt', 'sig']);
  expect(Object.keys(signed.claim)).toEqual(['kind', 'about', 'target', 'object', 'severity', 'valence', 'confidence']);
  expect(await verify(signed, signed.sig, k.publicJwk)).toBe(true);
  expect(await verify({ ...payload, unsupported: 'real-person' }, signed.sig, k.publicJwk)).toBe(false);
  expect(await verify({ ...signed, unsupported: 'real-person' }, signed.sig, k.publicJwk)).toBe(false);
  expect(await verify({ ...payload, claim: { ...good, extra: 'unsigned text' } }, signed.sig, k.publicJwk)).toBe(false);
  expect(await verify({ ...signed, sig: 'different' }, signed.sig, k.publicJwk)).toBe(false);
  await expect(sign({ ...payload, unsupported: 'real-person' }, k.secret)).rejects.toThrow('payload');
  await expect(sign({ ...payload, claim: { ...good, extra: 'unsigned text' } }, k.secret)).rejects.toThrow('payload');
  await expect(sign({ ...payload, claim: { ...good, object: 'arbitrary narrative' } }, k.secret)).rejects.toThrow('payload');
});

it('canonicalises reordered fields while detecting reordered fields with changed values', async () => {
  const k = await keys();
  const payload = { claim: good, castVersion: 'v1', issuedAt: now };
  const signed = await sign(payload, k.secret);
  const reordered = { issuedAt: now, castVersion: 'v1', claim: Object.fromEntries(Object.entries(good).reverse()) };
  expect(serialise(reordered)).toBe(serialise(payload));
  expect(await verify(reordered, signed.sig, k.publicJwk)).toBe(true);
  expect(await verify({ ...reordered, claim: { ...reordered.claim, about: good.target, target: good.about } }, signed.sig, k.publicJwk)).toBe(false);
});

it('authenticates every accepted claim field and optional-field presence', async () => {
  const k = await keys();
  const payload = { claim: good, castVersion: 'v1', issuedAt: now };
  const signed = await sign(payload, k.secret);
  for (const mutation of [
    { kind: 'cheating' }, { about: 'ben' }, { target: 'ben' }, { object: 'flour' },
    { severity: 3 }, { valence: 1 }, { confidence: 0.8 },
  ]) expect(await verify({ ...payload, claim: { ...good, ...mutation } }, signed.sig, k.publicJwk)).toBe(false);
  const { target: _target, object: _object, ...withoutOptional } = good;
  expect(await verify({ ...payload, claim: withoutOptional }, signed.sig, k.publicJwk)).toBe(false);
  const minimal = { ...payload, claim: withoutOptional };
  const minimalSigned = await sign(minimal, k.secret);
  expect(await verify({ ...minimal, claim: { ...withoutOptional, target: 'tom' } }, minimalSigned.sig, k.publicJwk)).toBe(false);
  expect(await verify({ ...minimal, claim: { ...withoutOptional, object: 'bread' } }, minimalSigned.sig, k.publicJwk)).toBe(false);
});
