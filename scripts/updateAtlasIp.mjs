import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import DigestClient from 'digest-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
['.env.local', '.env'].forEach((file) => {
  const p = path.join(__dirname, '..', file);
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: false });
    // console.log('[ENV] loaded', p); // descomenta para depurar
  }
});

const PUB   = process.env.ATLAS_PUBLIC_KEY;
const PRIV  = process.env.ATLAS_PRIVATE_KEY;
const GROUP = process.env.ATLAS_GROUP_ID;
const TAG   = process.env.ATLAS_ACCESSLIST_COMMENT || 'noizzy-local';

if (!PUB || !PRIV || !GROUP) {
  console.error('[ATLAS] Faltan ATLAS_PUBLIC_KEY / ATLAS_PRIVATE_KEY / ATLAS_GROUP_ID');
  process.exit(1);
}

const client = new DigestClient(PUB, PRIV, { algorithm: 'MD5' });
const BASE = 'https://cloud.mongodb.com/api/atlas/v1.0';

async function http(pathname, init = {}) {
  const res = await client.fetch(BASE + pathname, {
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} :: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function getPublicIP() {
  const urls = ['https://ifconfig.me/ip', 'https://api.ipify.org', 'https://ipinfo.io/ip'];
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (r.ok) return (await r.text()).trim();
    } catch {}
  }
  throw new Error('No pude obtener IP pública');
}

async function listAccess(pageNum = 1, acc = []) {
  // Pide muchas por página para evitar bucles
  const res = await http(`/groups/${GROUP}/accessList?pageNum=${pageNum}&itemsPerPage=500`);

  // Normaliza: a veces es array; a veces { results: [...] }
  const page = Array.isArray(res) ? res : (res?.results ?? []);
  const all = acc.concat(page);

  // Paginación (solo si la API usa { totalCount })
  const total = !Array.isArray(res) && typeof res?.totalCount === 'number' ? res.totalCount : all.length;
  if (all.length < total) {
    return listAccess(pageNum + 1, all);
  }
  return all;
}

async function addOrUpdate(ip) {
  try {
    await http(`/groups/${GROUP}/accessList`, {
      method: 'POST',
      body: JSON.stringify([{ ipAddress: ip, comment: TAG }]),
    });
    console.log(`[ATLAS] Añadida IP ${ip} (${TAG})`);
  } catch (e) {
    if (String(e.message).includes('409')) {
      console.log(`[ATLAS] IP ${ip} ya estaba permitida (${TAG})`);
    } else {
      throw e;
    }
  }
}

async function pruneOld(currentIp) {
  const entries = await listAccess();              
  const toDelete = entries
    .filter(e => e.comment === TAG && e.ipAddress !== currentIp)
    .map(e => e.ipAddress);

  for (const ip of toDelete) {
    await http(`/groups/${GROUP}/accessList/${ip}`, { method: 'DELETE' });
    console.log(`[ATLAS] Eliminada IP antigua ${ip} (${TAG})`);
  }
  if (!toDelete.length) console.log('[ATLAS] No había IPs antiguas que limpiar');
}

(async () => {
  const ip = await getPublicIP();
  console.log('[ATLAS] IP pública actual:', ip);
  await addOrUpdate(ip);
  await pruneOld(ip);
  console.log('[ATLAS] Access list OK');
})().catch(err => {
  console.error('[ATLAS] Error:', err.message);
  process.exit(1);
});