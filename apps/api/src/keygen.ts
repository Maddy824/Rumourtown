// Run locally with: node --experimental-strip-types apps/api/src/keygen.ts
// Store only the private JWK as SIGNING_KEY_JWK; never commit generated keys.
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
if (!('privateKey' in pair)) throw new Error('Expected a key pair');
console.log(JSON.stringify({
  privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
  publicJwk: await crypto.subtle.exportKey('jwk', pair.publicKey),
}, null, 2));
export {};
