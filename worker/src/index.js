const DEFAULT_CONFIG = [
  { key: 'firstName', label: 'שם פרטי', airtableField: 'שם פרטי', inputType: 'text', required: true, visible: true, order: 10, options: [], appliesTo: ['single', 'bulk'], system: true, placeholder: 'ישראל' },
  { key: 'lastName', label: 'שם משפחה', airtableField: 'שם משפחה', inputType: 'text', required: true, visible: true, order: 20, options: [], appliesTo: ['single', 'bulk'], system: true, placeholder: 'ישראלי' },
  { key: 'email', label: 'אימייל', airtableField: 'username', inputType: 'email', required: true, visible: true, order: 30, options: [], appliesTo: ['single', 'bulk'], system: true, placeholder: 'name@school.edu' },
  { key: 'phone', label: 'טלפון', airtableField: 'טלפון', inputType: 'tel', required: true, visible: true, order: 40, options: [], appliesTo: ['single', 'bulk'], system: true, placeholder: '0501234567' },
  { key: 'grade', label: 'כיתה / תפקיד', airtableField: 'grade', inputType: 'grade', required: true, visible: true, order: 80, options: ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ז׳','ח׳','ט׳','י׳','י״א','י״ב','אחר'], appliesTo: ['single', 'bulk'], system: true },
];

const SYSTEM_KEYS = new Set(['firstName', 'lastName', 'email', 'phone', 'grade']);
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return corsResponse(null, env, 204);

    try {
      if (url.pathname === '/admin/login' && request.method === 'POST') return handleLogin(request, env);
      if (url.pathname === '/airtable/tables' && request.method === 'GET') return requireAdmin(request, env, () => handleTables(env));
      if (url.pathname === '/airtable/schema' && request.method === 'GET') return requireAdmin(request, env, () => handleSchema(env));
      if (url.pathname === '/admin/form-config' && request.method === 'PUT') return requireAdmin(request, env, () => handleSaveConfig(request, env));
      if (url.pathname === '/admin/entities' && request.method === 'GET') return requireAdmin(request, env, () => handleAdminEntities(url, env));
      if (url.pathname === '/admin/entities' && request.method === 'POST') return requireAdmin(request, env, () => handleCreateEntity(request, env));
      if (url.pathname === '/form-config' && request.method === 'GET') return json(await readFormConfig(env), env);
      if (url.pathname === '/entities' && request.method === 'GET') return handleEntities(url, env);
      if (url.pathname === '/registrations' && request.method === 'POST') return handleRegistration(request, env);
      if (url.pathname === '/bulk-registrations' && request.method === 'POST') return handleBulkRegistration(request, env);
      return json({ error: 'Not found' }, env, 404);
    } catch (err) {
      console.error(err);
      return json({ error: err.message || 'Server error' }, env, err.status || 500);
    }
  },
};

async function handleLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  const password = String(body.password || '');
  if (!password) return json({ error: 'Password is required' }, env, 400);
  const expected = env.ADMIN_PASSWORD_HASH || '';
  const ok = expected.startsWith('sha256:')
    ? await sha256Hex(password) === expected.slice(7)
    : password === expected;
  if (!ok) return json({ error: 'Invalid password' }, env, 401);

  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 12;
  const payload = b64url(JSON.stringify({ exp }));
  const sig = await hmac(payload, env.SESSION_SECRET);
  return json({ ok: true }, env, 200, {
    'Set-Cookie': `admin_session=${payload}.${sig}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=43200`,
  });
}

async function requireAdmin(request, env, handler) {
  if (!(await isAdmin(request, env))) return json({ error: 'Unauthorized' }, env, 401);
  return handler();
}

async function isAdmin(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!match) return false;
  const [payload, sig] = match[1].split('.');
  if (!payload || !sig) return false;
  const expected = await hmac(payload, env.SESSION_SECRET);
  if (sig !== expected) return false;
  const data = JSON.parse(fromB64url(payload));
  return data.exp && data.exp > Math.floor(Date.now() / 1000);
}

async function handleSchema(env) {
  const tables = await airtableMeta(env, `/meta/bases/${env.AIRTABLE_BASE}/tables`);
  const table = tables.tables.find((t) => t.id === env.AIRTABLE_TEACHERS_TABLE_ID || t.name === env.AIRTABLE_TEACHERS_TABLE_ID);
  if (!table) throw httpError(404, 'Teachers table was not found in Airtable metadata');
  return json({
    table: { id: table.id, name: table.name },
    fields: table.fields.map((field) => ({
      id: field.id,
      name: field.name,
      type: field.type,
      options: airtableFieldOptions(field),
    })),
  }, env);
}

async function handleSaveConfig(request, env) {
  const body = await request.json().catch(() => ({}));
  const fields = normalizeConfig(body.fields || []);
  await upsertConfig(env, fields);
  return json(fields, env);
}

async function handleEntities(url, env) {
  const type = url.searchParams.get('type');
  if (type !== 'school' && type !== 'course') return json({ error: 'type must be school or course' }, env, 400);
  const entity = entityDefinition(env, type);
  const records = await fetchAllRecords(env, entity.tableId);
  return json(records.map((r) => ({
    id: r.id,
    name: String(firstFieldValue(r.fields, entity.nameFields) || '').trim(),
    remaining: Number(firstFieldValue(r.fields, ['נותרו']) || 0),
    occupied: Number(firstFieldValue(r.fields, ['אוישו']) || 0),
  })).filter((r) => r.name), env);
}

async function handleTables(env) {
  const tables = await airtableMeta(env, `/meta/bases/${env.AIRTABLE_BASE}/tables`);
  return json({
    tables: tables.tables.map((table) => ({
      id: table.id,
      name: table.name,
      fields: table.fields.map((field) => ({ id: field.id, name: field.name, type: field.type })),
    })),
  }, env);
}

async function handleAdminEntities(url, env) {
  const type = url.searchParams.get('type');
  const types = type === 'school' || type === 'course' ? [type] : ['school', 'course'];
  const rows = [];
  for (const currentType of types) {
    const entity = entityDefinition(env, currentType);
    const records = await fetchAllRecords(env, entity.tableId);
    rows.push(...records.map((record) => ({
      id: record.id,
      type: currentType,
      name: String(firstFieldValue(record.fields, entity.nameFields) || '').trim(),
      licenses: Number(firstFieldValue(record.fields, ["מס' הקצאות", 'מספר הקצאות']) || 0),
      occupied: Number(firstFieldValue(record.fields, ['אוישו']) || 0),
      remaining: Number(firstFieldValue(record.fields, ['נותרו']) || 0),
    })).filter((row) => row.name));
  }
  rows.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, 'he'));
  return json(rows, env);
}

async function handleCreateEntity(request, env) {
  const body = await request.json().catch(() => ({}));
  const type = body.type;
  const name = String(body.name || '').trim();
  const licenses = Number(body.licenses);
  if (type !== 'school' && type !== 'course') throw httpError(400, 'Entity type must be school or course');
  if (name.length < 2) throw httpError(400, 'Name is required');
  if (!Number.isInteger(licenses) || licenses <= 0) throw httpError(400, 'Licenses must be a positive integer');

  const entity = entityDefinition(env, type);
  const fields = {
    [entity.writeNameField]: name,
    "מס' הקצאות": licenses,
    'אוישו': 0,
  };
  const created = await airtable(env, `/${entity.tableId}`, {
    method: 'POST',
    body: { fields },
  });
  return json({
    id: created.id,
    type,
    name,
    licenses,
    occupied: 0,
    remaining: licenses,
  }, env, 201);
}

async function handleRegistration(request, env) {
  const body = await request.json();
  const config = await readFormConfig(env);
  const result = await createRegistration(env, body, config, 'single');
  return json(result, env, result.ok ? 200 : 400);
}

async function handleBulkRegistration(request, env) {
  const body = await request.json();
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return json({ error: 'No rows were provided' }, env, 400);

  const config = await readFormConfig(env);
  const license = await resolveLicense(env, body.regType, body.entityId);
  const licRecord = await airtable(env, `/${license.tableId}/${license.recordId}`);
  const remaining = Number(licRecord.fields['נותרו'] || 0);
  const occupied = Number(licRecord.fields['אוישו'] || 0);
  if (remaining < rows.length) {
    return json({ error: `אין מספיק הקצאות. נותרו ${remaining} הקצאות.` }, env, 400);
  }

  const results = [];
  let succeeded = 0;
  for (const row of rows) {
    const result = await createRegistration(env, {
      regType: body.regType,
      entityId: body.entityId,
      fields: row.fields || {},
      skipLicenseCheck: true,
      skipLicenseUpdate: true,
    }, config, 'bulk').catch((err) => ({ ok: false, error: err.message, email: row.fields && row.fields.username }));
    if (result.ok) succeeded++;
    results.push(result);
  }

  if (succeeded > 0) {
    await airtable(env, `/${license.tableId}/${license.recordId}`, {
      method: 'PATCH',
      body: { fields: { 'אוישו': occupied + succeeded } },
    });
  }

  return json({ ok: true, succeeded, failed: results.length - succeeded, remaining: remaining - succeeded, results }, env);
}

async function createRegistration(env, body, config, formType) {
  const fields = Array.isArray(body.fields) ? fieldsArrayToObject(body.fields) : (body.fields || {});
  const registrationFields = configToAirtableFields(config, fields, formType);
  const email = String(registrationFields.username || fields.username || '').trim().toLowerCase();
  const phone = String(registrationFields['טלפון'] || fields['טלפון'] || '').trim();
  if (!email) throw httpError(400, 'Email is required');
  if (!phone) throw httpError(400, 'Phone is required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Invalid email');

  const license = await resolveLicense(env, body.regType, body.entityId);
  const licRecord = await airtable(env, `/${license.tableId}/${license.recordId}`);
  const remaining = Number(licRecord.fields['נותרו'] || 0);
  const occupied = Number(licRecord.fields['אוישו'] || 0);
  if (!body.skipLicenseCheck && remaining <= 0) throw httpError(400, 'מספר ההקצאות נגמר.');

  const entityName = String(firstFieldValue(licRecord.fields, license.nameFields) || '').trim();
  registrationFields.username = email;
  registrationFields['טלפון'] = phone;
  registrationFields['בית ספר'] = entityName;

  const dupFormula = encodeURIComponent(`{username}='${email.replace(/'/g, "\\'")}'`);
  const dup = await airtable(env, `/${env.AIRTABLE_TEACHERS_TABLE_ID}?filterByFormula=${dupFormula}&maxRecords=1`);
  if (dup.records && dup.records.length) throw httpError(409, 'כתובת האימייל הזו כבר רשומה במערכת.');

  const created = await airtable(env, `/${env.AIRTABLE_TEACHERS_TABLE_ID}`, {
    method: 'POST',
    body: { fields: registrationFields },
  });

  if (!body.skipLicenseUpdate) {
    await airtable(env, `/${license.tableId}/${license.recordId}`, {
      method: 'PATCH',
      body: { fields: { 'אוישו': occupied + 1 } },
    });
  }

  await sendBubble(env, registrationFields, entityName, created.id);
  return { ok: true, id: created.id, email, remaining: remaining - 1 };
}

function configToAirtableFields(config, values, formType) {
  const out = {};
  normalizeConfig(config).forEach((field) => {
    if (!field.visible || !field.airtableField || !field.appliesTo.includes(formType)) return;
    const value = values[field.airtableField] ?? values[field.key];
    if (value !== undefined && value !== null && String(value).trim() !== '') out[field.airtableField] = String(value).trim();
  });
  return out;
}

function fieldsArrayToObject(fields) {
  return Object.fromEntries(fields.map((item) => [item.airtableField || item.key, item.value]));
}

async function resolveLicense(env, regType, entityId) {
  if (regType !== 'school' && regType !== 'course') throw httpError(400, 'Registration type is required');
  if (!entityId) throw httpError(400, 'Entity is required');
  return { ...entityDefinition(env, regType), recordId: entityId };
}

function entityDefinition(env, type) {
  return type === 'school'
    ? { type, tableId: env.SCHOOLS_TABLE_ID, nameFields: ['שם בית הספר', 'בית ספר', 'שם ביה"ס', 'שם בית ספר'], writeNameField: 'שם בית הספר' }
    : { type, tableId: encodeURIComponent('הקצאות להשתלמויות'), nameFields: ['בי"ס/ מרכז פסג"ה', 'בי״ס מרכז פסג״ה', 'ביס מרכז פסגה', 'השתלמות', 'שם ההשתלמות', 'שם השתלמות'], writeNameField: 'בי"ס/ מרכז פסג"ה' };
}

function firstFieldValue(fields, candidates) {
  for (const name of candidates) {
    if (fields[name] !== undefined && fields[name] !== null && fields[name] !== '') return fields[name];
  }
  return '';
}

async function sendBubble(env, fields, entityName, airtableId) {
  if (!env.BUBBLE_URL || !env.BUBBLE_TOKEN) return;
  const base = env.BUBBLE_URL.replace(/\/$/, '');
  const url = base.endsWith('/obj/user') ? base : `${base}/obj/user`;
  const body = {
    email: fields.username,
    password: fields['טלפון'],
    phone: fields['טלפון'],
    'first name': fields['שם פרטי'] || '',
    'last name': fields['שם משפחה'] || '',
    school: entityName,
    classroom: fields.grade || '',
    role: 'Teacher',
    airtable_record_id: airtableId,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.BUBBLE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.warn('Bubble create failed', res.status, await res.text());
}

async function readFormConfig(env) {
  if (!env.FORM_CONFIG_TABLE_ID) return DEFAULT_CONFIG;
  const records = await fetchAllRecords(env, env.FORM_CONFIG_TABLE_ID).catch(() => []);
  const jsonRecord = records.find((record) => record.fields && record.fields.key === 'active' && record.fields.config);
  if (jsonRecord) {
    try {
      return normalizeConfig(JSON.parse(jsonRecord.fields.config));
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  const fields = records.map((record) => configRecordToField(record.fields || {})).filter(Boolean);
  return fields.length ? normalizeConfig(fields) : DEFAULT_CONFIG;
}

async function upsertConfig(env, fields) {
  if (!env.FORM_CONFIG_TABLE_ID) throw httpError(500, 'FORM_CONFIG_TABLE_ID is not configured');
  const normalized = normalizeConfig(fields);
  const existing = await fetchAllRecords(env, env.FORM_CONFIG_TABLE_ID).catch(() => []);
  const byKey = new Map(existing.filter((record) => record.fields && record.fields.key).map((record) => [record.fields.key, record]));
  const nextKeys = new Set(normalized.map((field) => field.key));

  for (const field of normalized) {
    const body = { fields: fieldToConfigRecord(field) };
    const current = byKey.get(field.key);
    if (current) {
      await airtable(env, `/${env.FORM_CONFIG_TABLE_ID}/${current.id}`, { method: 'PATCH', body });
    } else {
      await airtable(env, `/${env.FORM_CONFIG_TABLE_ID}`, { method: 'POST', body });
    }
  }

  for (const record of existing) {
    const key = record.fields && record.fields.key;
    if (!key || key === 'active' || nextKeys.has(key)) continue;
    await airtable(env, `/${env.FORM_CONFIG_TABLE_ID}/${record.id}`, { method: 'DELETE' });
  }

  return normalized;
}

function configRecordToField(fields) {
  if (!fields.key || fields.key === 'active') return null;
  return {
    key: fields.key,
    label: fields.label,
    airtableField: fields.airtableField,
    inputType: fields.inputType,
    required: Boolean(fields.required),
    visible: fields.visible !== false,
    order: fields.order,
    options: parseConfigArray(fields.options),
    appliesTo: parseConfigArray(fields.appliesTo),
    system: Boolean(fields.system),
    placeholder: fields.placeholder || '',
  };
}

function fieldToConfigRecord(field) {
  return {
    key: field.key,
    label: field.label,
    airtableField: field.airtableField,
    inputType: field.inputType,
    required: field.required,
    visible: field.visible,
    order: field.order,
    options: JSON.stringify(field.options || []),
    appliesTo: JSON.stringify(field.appliesTo || ['single', 'bulk']),
    system: Boolean(field.system),
    placeholder: field.placeholder || '',
  };
}

function parseConfigArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeConfig(fields) {
  const byKey = new Map();
  const source = Array.isArray(fields) && fields.length ? fields : DEFAULT_CONFIG;
  source.forEach((field, idx) => {
    const key = slug(field.key || field.airtableField || field.label || `field_${idx}`);
    byKey.set(key, {
      key,
      label: String(field.label || field.airtableField || key),
      airtableField: String(field.airtableField || field.label || key),
      inputType: ['text', 'email', 'tel', 'number', 'date', 'textarea', 'select', 'grade'].includes(field.inputType) ? field.inputType : 'text',
      required: Boolean(field.required),
      visible: field.visible !== false,
      order: Number.isFinite(Number(field.order)) ? Number(field.order) : (idx + 1) * 10,
      options: normalizeOptions(field.options),
      appliesTo: Array.isArray(field.appliesTo) && field.appliesTo.length ? field.appliesTo.filter((v) => v === 'single' || v === 'bulk') : ['single', 'bulk'],
      system: Boolean(field.system || SYSTEM_KEYS.has(key)),
      placeholder: String(field.placeholder || ''),
    });
  });
  DEFAULT_CONFIG.forEach((field) => {
    if (!byKey.has(field.key)) byKey.set(field.key, field);
  });
  return Array.from(byKey.values()).sort((a, b) => a.order - b.order);
}

function normalizeOptions(options) {
  if (Array.isArray(options)) return options.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof options === 'string') return options.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);
  return [];
}

function slug(value) {
  return String(value || '').trim().replace(/\s+/g, '_').replace(/[^\w\u0590-\u05FF-]/g, '').replace(/^_+|_+$/g, '') || `field_${Date.now()}`;
}

function airtableFieldOptions(field) {
  const choices = field.options && field.options.choices;
  return Array.isArray(choices) ? choices.map((choice) => choice.name) : [];
}

async function fetchAllRecords(env, tableId) {
  const records = [];
  let offset = null;
  do {
    const suffix = offset ? `?offset=${encodeURIComponent(offset)}` : '';
    const data = await airtable(env, `/${tableId}${suffix}`);
    records.push(...(data.records || []));
    offset = data.offset || null;
  } while (offset);
  return records;
}

async function airtable(env, path, options = {}) {
  const res = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE}${path}`, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw httpError(res.status, body && body.error && body.error.message ? body.error.message : text);
  return body;
}

async function airtableMeta(env, path) {
  const res = await fetch(`https://api.airtable.com/v0${path}`, {
    headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}` },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw httpError(res.status, body && body.error && body.error.message ? body.error.message : text);
  return body;
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function json(body, env, status = 200, extraHeaders = {}) {
  return corsResponse(JSON.stringify(body), env, status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });
}

function corsResponse(body, env, status = 200, headers = {}) {
  const allowedOrigin = env.ALLOWED_ORIGIN || '*';
  return new Response(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Cache-Control': 'no-store',
      'Vary': 'Origin',
      ...headers,
    },
  });
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret || 'dev-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return b64urlBytes(new Uint8Array(sig));
}

function b64url(value) {
  return b64urlBytes(new TextEncoder().encode(value));
}

function b64urlBytes(bytes) {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromB64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  return atob(padded);
}
