(function () {
  var cfg = window.MATZMIHIM_CONFIG || {};
  var apiBase = (cfg.API_BASE_URL || '').replace(/\/$/, '');

  function endpoint(path) {
    if (!apiBase) throw new Error('API_BASE_URL is missing in config.js');
    return apiBase + path;
  }

  async function request(path, options) {
    options = options || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    var res = await fetch(endpoint(path), Object.assign({}, options, {
      credentials: 'include',
      headers: headers,
    }));
    var text = await res.text();
    var body = text ? JSON.parse(text) : null;
    if (!res.ok) {
      var message = body && body.error ? body.error : ('HTTP ' + res.status);
      throw new Error(message);
    }
    return body;
  }

  window.MatzmihimApi = {
    getConfig: function () {
      return request('/form-config', { method: 'GET', headers: {} });
    },
    getEntities: function (type) {
      return request('/entities?type=' + encodeURIComponent(type), { method: 'GET', headers: {} });
    },
    submitRegistration: function (payload) {
      return request('/registrations', { method: 'POST', body: JSON.stringify(payload) });
    },
    submitBulkRegistrations: function (payload) {
      return request('/bulk-registrations', { method: 'POST', body: JSON.stringify(payload) });
    },
    login: function (password) {
      return request('/admin/login', { method: 'POST', body: JSON.stringify({ password: password }) });
    },
    getSchema: function () {
      return request('/airtable/schema', { method: 'GET', headers: {} });
    },
    saveConfig: function (fields) {
      return request('/admin/form-config', { method: 'PUT', body: JSON.stringify({ fields: fields }) });
    },
  };
})();
