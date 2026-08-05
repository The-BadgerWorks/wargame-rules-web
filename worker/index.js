// AI-Assisted: Claude Code (model: claude-fable-5) - Members gate for the rules-reference site.
//
// The site remains a static build; this Worker only fronts it. Every request
// must carry a valid members session cookie or it is redirected to the login
// page on the main site (battlebadgerstudio.com/login/), which redirects back
// here after a successful login. There are no auth endpoints in this Worker —
// login/logout live in core-website's gate; this side only verifies.
//
// The cookie is an HMAC-signed expiry timestamp minted by core-website with a
// key derived from the shared MEMBERS_PASSWORD secret. This Worker must carry
// the SAME secret (same value) or every session verification fails. The
// cookie itself arrives because core-website sets it domain-wide
// (Domain=battlebadgerstudio.com). Constants below must stay in lockstep with
// core-website/worker/index.js.
//
// Fail-closed: no secret configured -> everything redirects to login (which
// itself refuses with 503 until its secret is set).
//
// Local dev: `wrangler dev` on localhost can't receive the production
// cookie; put GATE_DISABLED = "true" in .dev.vars (gitignored) to bypass the
// gate locally. `npm run dev` / `astro dev` never runs this Worker at all.

const COOKIE_NAME = 'bbs_session';
const KEY_CONTEXT = 'bbs-members-gate-v1';
const LOGIN_URL = 'https://battlebadgerstudio.com/login/';
const CANONICAL_HOST = 'wgrules.battlebadgerstudio.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === `www.${CANONICAL_HOST}`) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }

    if (env.GATE_DISABLED === 'true') {
      return env.ASSETS.fetch(request);
    }

    if (await hasValidSession(request, env)) {
      return env.ASSETS.fetch(request);
    }

    const login = new URL(LOGIN_URL);
    login.searchParams.set('next', url.toString());
    return Response.redirect(login.toString(), 302);
  },
};

async function hasValidSession(request, env) {
  if (!env.MEMBERS_PASSWORD) return false;
  const raw = getCookie(request, COOKIE_NAME);
  if (!raw) return false;
  const [expiryStr, sigHex] = raw.split('.');
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry < Date.now() || !sigHex) return false;
  const key = await signingKey(env);
  const sig = hexToBytes(sigHex);
  if (!sig) return false;
  return crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(expiryStr));
}

async function signingKey(env) {
  const material = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${env.MEMBERS_PASSWORD}:${KEY_CONTEXT}`)
  );
  return crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'verify',
  ]);
}

function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

function hexToBytes(hex) {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
