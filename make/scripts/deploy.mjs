// Deploys this folder to the Make custom app named in makecomapp.json (origins[0]).
//
//   node scripts/deploy.mjs --dry-run                 compare with Make, change nothing
//   node scripts/deploy.mjs                           create what is missing, update the rest
//   node scripts/deploy.mjs --only module:uploadFile  one component (repeatable; connection|rpc|module:<id>)
//
// The API token (scopes sdk-apps:read and sdk-apps:write) is read from origins[0].apikeyFile,
// or from the file in MAKE_APIKEY_FILE. New components are written to origins[0].idMapping.

import { readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'makecomapp.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const origin = manifest.origins[0];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const only = args.flatMap((arg, i) => (arg === '--only' ? [args[i + 1]] : []));
const unknown = args.filter((arg, i) => !['--dry-run', '--only'].includes(arg) && args[i - 1] !== '--only');
if (unknown.length || only.some((item) => !/^(connection|rpc|module):\w+$/.test(item ?? ''))) {
	console.error('Usage: node scripts/deploy.mjs [--dry-run] [--only connection|rpc|module:<id>]...');
	process.exit(2);
}
const baseUrl = URL.canParse(origin.baseUrl) ? new URL(origin.baseUrl) : null;
if (
	!baseUrl ||
	baseUrl.protocol !== 'https:' ||
	!/^[a-z0-9-]+\.make\.com$/.test(baseUrl.hostname) ||
	baseUrl.username ||
	baseUrl.password ||
	baseUrl.port ||
	baseUrl.search ||
	baseUrl.hash ||
	baseUrl.pathname !== '/api' ||
	!/^[a-z][0-9a-z-]+[0-9a-z]$/.test(origin.appId)
) {
	console.error('Set origins[0].baseUrl (https://<zone>.make.com/api) and origins[0].appId in makecomapp.json first.');
	process.exit(2);
}
const missing = only.filter((item) => !manifest.components[item.split(':')[0]]?.[item.split(':')[1]]);
if (missing.length) {
	console.error(`Not in makecomapp.json: ${missing.join(', ')}`);
	process.exit(1);
}

function readToken() {
	if (process.env.MAKE_APIKEY_FILE) return readFileSync(process.env.MAKE_APIKEY_FILE, 'utf8').trim();
	const secrets = join(root, '.secrets');
	try {
		const file = realpathSync(resolve(root, origin.apikeyFile));
		if (file.startsWith(realpathSync(secrets) + sep)) return readFileSync(file, 'utf8').trim();
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
		console.error('The API token file is missing: save it in .secrets/ or name it in MAKE_APIKEY_FILE.');
		process.exit(2);
	}
	console.error('origins[0].apikeyFile must be a file inside .secrets/.');
	process.exit(2);
}

const token = readToken();
const api = `${baseUrl.origin}/api/v2/sdk/apps`;
const versioned = `${origin.appId}/${origin.appVersion}`;

const TYPES = ['connection', 'rpc', 'module'];
const MODULE_TYPE_IDS = { trigger: 1, action: 4, search: 9, instant_trigger: 10, responder: 11, universal: 12 };
const SECTIONS = {
	connection: { communication: 'api', params: 'parameters', common: 'common' },
	rpc: { communication: 'api', params: 'parameters' },
	module: {
		communication: 'api',
		epoch: 'epoch',
		staticParams: 'parameters',
		mappableParams: 'expect',
		interface: 'interface',
		samples: 'samples',
		scope: 'scope',
	},
};
const GENERAL = {
	base: { path: 'base', mime: 'application/jsonc' },
	common: { path: 'common', mime: 'application/json' },
	readme: { path: 'readme', mime: 'text/markdown' },
	groups: { path: 'groups', mime: 'application/json' },
};

const stats = { created: 0, adopted: 0, metadata: 0, sections: 0, unchanged: 0, pending: 0 };
const failures = [];

async function request(method, path, { body, mime } = {}) {
	for (let attempt = 1; ; attempt++) {
		const response = await fetch(`${api}/${path}`, {
			method,
			headers: {
				Authorization: `Token ${token}`,
				'imt-vsce-localmode': 'true',
				...(body === undefined ? {} : { 'Content-Type': mime ?? 'application/json' }),
			},
			body: body === undefined || mime ? body : JSON.stringify(body),
			redirect: 'error',
		});
		const text = await response.text();
		const retryable = response.status === 429 || (response.status >= 500 && method !== 'POST');
		if (retryable && attempt < 8) {
			const retryAfter = Number(response.headers.get('retry-after'));
			await wait(retryAfter > 0 ? retryAfter * 1000 : 5000 * attempt);
			continue;
		}
		if (!response.ok) {
			throw new Error(`${method} ${path} answered ${response.status}: ${text.slice(0, 500)}`);
		}
		return text;
	}
}

const getJson = async (path) => JSON.parse(await request('GET', path));

function sameCode(local, remote) {
	if (local === remote || local.trim() === remote.trim()) return true;
	try {
		return JSON.stringify(JSON.parse(local)) === JSON.stringify(JSON.parse(remote));
	} catch {
		return false;
	}
}

function mapping(type) {
	origin.idMapping ??= { connection: [], webhook: [], module: [], rpc: [], function: [] };
	return (origin.idMapping[type] ??= []);
}

const remoteNameOf = (type, localId) => mapping(type).find((item) => item.local === localId)?.remote ?? null;

function pair(type, local, remote) {
	mapping(type).push({ local, remote });
	writeFileSync(`${manifestPath}.tmp`, `${JSON.stringify(manifest, null, '\t')}\n`);
	renameSync(`${manifestPath}.tmp`, manifestPath);
}

function collectionPath(type) {
	return type === 'connection' ? `${origin.appId}/connections` : `${versioned}/${type}s`;
}

function componentPath(type, remoteName) {
	return type === 'connection' ? `connections/${remoteName}` : `${versioned}/${type}s/${remoteName}`;
}

function metadataOf(type, meta) {
	const body = { label: meta.label };
	if (type === 'connection') return body;
	if (type === 'module') {
		if (meta.description) body.description = meta.description;
		body.typeId = MODULE_TYPE_IDS[meta.moduleType];
		if (meta.moduleType === 'action' && meta.actionCrud !== undefined) body.crud = meta.actionCrud;
	}
	body.connection = meta.connection ? remoteNameOf('connection', meta.connection) : null;
	body.altConnection = meta.altConnection ? remoteNameOf('connection', meta.altConnection) : null;
	return body;
}

async function deployCode(label, path, mime, file) {
	const local = readFileSync(join(root, file), 'utf8');
	if (!dryRun) {
		await request('PUT', path, { body: local, mime });
		stats.sections++;
		return;
	}
	if (sameCode(local, await request('GET', path))) {
		stats.unchanged++;
	} else {
		stats.pending++;
		console.log(`  differs  ${label}`);
	}
}

async function deployComponent(type, localId, meta, remoteList) {
	let remoteName = remoteNameOf(type, localId);
	let remote = remoteList.find((item) => item.name === remoteName);

	if (!remoteName) {
		const candidates =
			type === 'connection'
				? remoteList.filter((item) => item.label === meta.label && item.type === meta.connectionType)
				: remoteList.filter((item) => item.name === localId);
		const taken = candidates.filter((item) => mapping(type).some((entry) => entry.remote === item.name));
		if (candidates.length > 1 || taken.length) {
			throw new Error(`cannot pair with Make: ${candidates.length} remote candidates, pair it by hand in idMapping`);
		}
		remote = candidates[0];
		if (remote) {
			remoteName = remote.name;
			console.log(`  adopt    ${type} ${localId} -> ${remoteName}`);
			if (!dryRun) pair(type, localId, remoteName);
			stats.adopted++;
		}
	} else if (!remote) {
		throw new Error(`paired with "${remoteName}", which is not in Make`);
	}

	const metadata = metadataOf(type, meta);
	if (type !== 'connection' && meta.connection && !metadata.connection && !dryRun) {
		throw new Error(`its connection "${meta.connection}" is not in Make yet`);
	}

	if (!remote) {
		console.log(`  create   ${type} ${localId}`);
		if (dryRun) {
			stats.pending += 1 + Object.values(meta.codeFiles).filter(Boolean).length;
			return;
		}
		const body = { ...metadata };
		if (type === 'connection') body.type = meta.connectionType;
		else body.name = localId;
		if (type === 'module') {
			body.moduleInitMode = 'blank';
			if (meta.moduleType === 'universal') body.subtype = 'Universal';
		}
		const created = JSON.parse(await request('POST', collectionPath(type), { body }));
		remoteName = type === 'connection' ? created.appConnection.name : localId;
		pair(type, localId, remoteName);
		stats.created++;
	} else {
		const current = Object.values(await getJson(componentPath(type, remoteName)))[0];
		const changed = Object.entries(metadata).filter(([key, value]) => (current[key] ?? null) !== (value ?? null));
		if (!changed.length) {
			stats.unchanged++;
		} else if (dryRun) {
			stats.pending++;
			console.log(`  differs  ${type} ${localId} metadata (${changed.map(([key]) => key).join(', ')})`);
		} else {
			await request('PATCH', componentPath(type, remoteName), { body: metadata });
			stats.metadata++;
		}
	}

	for (const [codeType, file] of Object.entries(meta.codeFiles)) {
		if (file === null) continue;
		const section = SECTIONS[type][codeType];
		if (!section) throw new Error(`unknown code file "${codeType}"`);
		await deployCode(`${type} ${localId} ${codeType}`, `${componentPath(type, remoteName)}/${section}`, 'application/jsonc', file);
	}
}

console.log(`${dryRun ? 'Dry run against' : 'Deploying to'} ${origin.baseUrl} app ${origin.appId} v${origin.appVersion}`);

for (const type of TYPES) {
	const wanted = Object.entries(manifest.components[type] ?? {}).filter(
		([localId, meta]) => meta && (!only.length || only.includes(`${type}:${localId}`)),
	);
	if (!wanted.length) continue;
	const remoteList = Object.values(await getJson(collectionPath(type)))[0];
	console.log(`${type}s: ${wanted.length} local, ${remoteList.length} in Make`);
	for (const [localId, meta] of wanted) {
		try {
			await deployComponent(type, localId, meta, remoteList);
		} catch (error) {
			failures.push(`${type} ${localId}: ${error.message}`);
			console.error(`  FAILED   ${type} ${localId}: ${error.message}`);
		}
	}
}

if (!only.length) {
	console.log('general files');
	for (const [codeType, file] of Object.entries(manifest.generalCodeFiles)) {
		if (file === null) continue;
		try {
			await deployCode(`general ${codeType}`, `${versioned}/${GENERAL[codeType].path}`, GENERAL[codeType].mime, file);
		} catch (error) {
			failures.push(`general ${codeType}: ${error.message}`);
			console.error(`  FAILED   general ${codeType}: ${error.message}`);
		}
	}
}

console.log(
	dryRun
		? `Dry run: ${stats.pending} to deploy, ${stats.unchanged} identical, ${stats.adopted} to pair.`
		: `Done: ${stats.created} created, ${stats.adopted} paired, ${stats.metadata} metadata updated, ${stats.sections} code sections sent.`,
);
if (failures.length) {
	console.error(`${failures.length} failed:\n${failures.map((line) => `  ${line}`).join('\n')}`);
	process.exit(1);
}
