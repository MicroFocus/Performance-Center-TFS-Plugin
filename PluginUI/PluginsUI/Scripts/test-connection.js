#!/usr/bin/env node
'use strict';
/**
 * test-connection.js
 * ──────────────────
 * Tests connectivity and authentication against an LRE server.
 * Deliberately uses ONLY Node.js built-in modules (http / https / url).
 * No npm packages are required.
 *
 * Input  : environment variables (same INPUT_* vars as the main task)
 * Exit 0 : authenticated successfully
 * Exit 1 : authentication failed or network/config error
 *
 * Token auth  → POST /authentication-point/authenticateclient/?tenant=<guid>
 *               Body: <AuthenticationClient><ClientIdKey>…<ClientSecretKey>…
 *               (NO namespace on the root element — matches what LreClient.ts sends)
 *
 * Password auth → GET /authentication-point/authenticate/?tenant=<guid>
 *                 with Authorization: Basic <base64(user:pass)>
 */

const http  = require('http');
const https = require('https');

// ── Read environment variables ───────────────────────────────────────────────
const rawServer = (process.env.INPUT_VARPCSERVER || '').trim().replace(/\/+$/, '');
const useToken  = (process.env.INPUT_VARUSETOKENFORAUTHENTICATION || 'false').toLowerCase() === 'true';
const userName  = (process.env.INPUT_VARUSERNAME  || '').trim();
const password  = (process.env.INPUT_VARPASSWORD  || '').trim();

if (!rawServer) {
  console.error('[ERROR] Server URL (INPUT_VARPCSERVER) is not set.');
  process.exit(1);
}

// ── Parse tenant out of the server URL ──────────────────────────────────────
// Input example: http://host:80/?tenant=fa128c06-5436-413d-9cfa-9f04bb738df3
// After parsing:  cleanServer = "http://host:80"
//                 tenantSuffix = "/?tenant=fa128c06-5436-413d-9cfa-9f04bb738df3"
let cleanServer  = rawServer;
let tenantSuffix = '';                       // mirrors LreClient.ts this.tenantSuffix

const tIdx = rawServer.indexOf('?tenant=');
if (tIdx >= 0) {
  // Strip the query string from the server URL
  const base    = rawServer.slice(0, tIdx).replace(/\/?$/, '');
  const tenant  = rawServer.slice(tIdx + 8);     // everything after "?tenant="
  cleanServer   = base;
  tenantSuffix  = `/?tenant=${tenant}`;           // e.g. /?tenant=fa128c06-…
}

// ── Build the authentication URL ─────────────────────────────────────────────
// Mirrors LreClient.ts:
//   baseUrl = `${config.serverUrl}/LoadTest/rest`
//   POST `${baseUrl}/authentication-point/authenticateclient${tenantSuffix}`
//   GET  `${baseUrl}/authentication-point/authenticate${tenantSuffix}`
const authRelPath = useToken
  ? `/LoadTest/rest/authentication-point/authenticateclient${tenantSuffix}`
  : `/LoadTest/rest/authentication-point/authenticate${tenantSuffix}`;

let parsedUrl;
try {
  parsedUrl = new URL(cleanServer + authRelPath);
} catch (e) {
  console.error(`[ERROR] Invalid server URL: ${cleanServer}`);
  process.exit(1);
}

// ── Build request options ────────────────────────────────────────────────────
const isHttps  = parsedUrl.protocol === 'https:';
const transport = isHttps ? https : http;

const commonHeaders = {
  'Accept':                  'application/xml',
  'Content-Type':            'application/xml',   // NO charset — matches axios default
  'X-QC-HIDDEN-SECURITY-ID': '12'
};

let method  = 'GET';
let reqBody = null;

if (useToken) {
  // ── Token (API key) authentication ────────────────────────────────────────
  // POST with XML body.
  // Element names and root format MUST match LreAuthenticationClientXml.toXml()
  // in src/models/index.ts  →  <AuthenticationClient> (no xmlns),
  //   <ClientIdKey> / <ClientSecretKey>
  method  = 'POST';
  reqBody = `<?xml version="1.0" encoding="utf-8"?>
<AuthenticationClient>
    <ClientIdKey>${escapeXml(userName)}</ClientIdKey>
    <ClientSecretKey>${escapeXml(password)}</ClientSecretKey>
</AuthenticationClient>`;
  commonHeaders['Content-Length'] = Buffer.byteLength(reqBody, 'utf8').toString();
} else {
  // ── Password (Basic) authentication ──────────────────────────────────────
  const creds = Buffer.from(`${userName}:${password}`, 'utf8').toString('base64');
  commonHeaders['Authorization'] = `Basic ${creds}`;
}

const requestOptions = {
  protocol: parsedUrl.protocol,
  hostname: parsedUrl.hostname,
  port:     parsedUrl.port || (isHttps ? 443 : 80),
  path:     parsedUrl.pathname + parsedUrl.search,
  method,
  headers:  commonHeaders,
  // Certificate validation is enabled by default.
  // Set INPUT_VARTLSSKIPVERIFICATION=true only when connecting to a server
  // with a self-signed certificate that cannot be added to the system trust store.
  rejectUnauthorized: (process.env.INPUT_VARTLSSKIPVERIFICATION || 'false').toLowerCase() !== 'true'
};

// ── Execute ───────────────────────────────────────────────────────────────────
console.log(`[INFO] Testing connection to: ${cleanServer}`);
console.log(`[INFO] Auth method: ${useToken ? 'API token' : 'Username / Password'}`);
console.log(`[INFO] Endpoint: ${requestOptions.method} ${parsedUrl.href}`);

const req = transport.request(requestOptions, (res) => {
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const body   = Buffer.concat(chunks).toString('utf8');
    const status = res.statusCode;

    if (status >= 200 && status <= 204) {
      console.log(`[INFO] Authentication succeeded (HTTP ${status}).`);
      process.exit(0);
    } else {
      console.error(`[ERROR] Authentication failed (HTTP ${status}).`);
      // Print the error message from the response body if available
      const match = body.match(/<ExceptionMessage>([\s\S]*?)<\/ExceptionMessage>/);
      if (match) console.error(`[ERROR] Server message: ${match[1].trim()}`);
      process.exit(1);
    }
  });
});

req.setTimeout(30000, () => {
  req.destroy();
  console.error('[ERROR] Connection timed out (30 s).');
  process.exit(1);
});

req.on('error', (err) => {
  console.error(`[ERROR] Network error: ${err.message}`);
  process.exit(1);
});

if (reqBody) req.write(reqBody, 'utf8');
req.end();

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

