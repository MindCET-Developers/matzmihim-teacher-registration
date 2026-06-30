(function () {
  var DEFAULT_FIELDS = [
    { key: 'firstName', label: 'שם פרטי', airtableField: 'שם פרטי', inputType: 'text', required: true, visible: true, order: 10, options: [], appliesTo: ['single', 'bulk'], system: true, placeholder: 'ישראל' },
    { key: 'lastName', label: 'שם משפחה', airtableField: 'שם משפחה', inputType: 'text', required: true, visible: true, order: 20, options: [], appliesTo: ['single', 'bulk'], system: true, placeholder: 'ישראלי' },
    { key: 'email', label: 'אימייל', airtableField: 'username', inputType: 'email', required: true, visible: true, order: 30, options: [], appliesTo: ['single', 'bulk'], system: true, placeholder: 'name@school.edu' },
    { key: 'phone', label: 'טלפון', airtableField: 'טלפון', inputType: 'tel', required: true, visible: true, order: 40, options: [], appliesTo: ['single', 'bulk'], system: true, placeholder: '0501234567' },
    { key: 'grade', label: 'כיתה / תפקיד', airtableField: 'grade', inputType: 'grade', required: true, visible: true, order: 80, options: ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ז׳','ח׳','ט׳','י׳','י״א','י״ב','אחר'], appliesTo: ['single', 'bulk'], system: true },
  ];

  var SYSTEM_KEYS = {
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
    grade: true,
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function normalizeOptions(options) {
    if (Array.isArray(options)) return options.map(String).map(function (s) { return s.trim(); }).filter(Boolean);
    if (typeof options === 'string') {
      return options.split(/\r?\n|,/).map(function (s) { return s.trim(); }).filter(Boolean);
    }
    return [];
  }

  function slug(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^\w\u0590-\u05FF-]/g, '')
      .replace(/^_+|_+$/g, '') || ('field_' + Date.now());
  }

  function normalizeField(field, idx) {
    var key = field.key || slug(field.airtableField || field.label || ('field_' + idx));
    return {
      key: key,
      label: field.label || field.airtableField || key,
      airtableField: field.airtableField || field.label || key,
      inputType: field.inputType || 'text',
      required: Boolean(field.required),
      visible: field.visible !== false,
      order: Number.isFinite(Number(field.order)) ? Number(field.order) : (idx + 1) * 10,
      options: normalizeOptions(field.options),
      appliesTo: Array.isArray(field.appliesTo) && field.appliesTo.length ? field.appliesTo : ['single', 'bulk'],
      system: Boolean(field.system || SYSTEM_KEYS[key]),
      placeholder: field.placeholder || '',
    };
  }

  function normalizeConfig(fields) {
    var source = Array.isArray(fields) && fields.length ? fields : DEFAULT_FIELDS;
    var byKey = {};
    source.forEach(function (field, idx) {
      var normalized = normalizeField(field, idx);
      byKey[normalized.key] = normalized;
    });
    DEFAULT_FIELDS.forEach(function (field) {
      if (!byKey[field.key]) byKey[field.key] = clone(field);
    });
    return Object.keys(byKey).map(function (key) { return byKey[key]; })
      .filter(function (field) { return field.visible; })
      .sort(function (a, b) { return a.order - b.order; });
  }

  function fieldsFor(config, formType) {
    return normalizeConfig(config).filter(function (field) {
      return field.appliesTo.indexOf(formType) !== -1;
    });
  }

  function toPayload(fields, values) {
    var out = {};
    fields.forEach(function (field) {
      if (!field.airtableField) return;
      var value = values[field.key];
      if (value === undefined || value === null || value === '') return;
      out[field.airtableField] = value;
    });
    return out;
  }

  window.MatzmihimConfig = {
    DEFAULT_FIELDS: clone(DEFAULT_FIELDS),
    SYSTEM_KEYS: SYSTEM_KEYS,
    normalizeConfig: normalizeConfig,
    normalizeField: normalizeField,
    normalizeOptions: normalizeOptions,
    fieldsFor: fieldsFor,
    toPayload: toPayload,
  };
})();
