(function () {
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fieldId(field) {
    return 'field-' + field.key;
  }

  function errorId(field) {
    return 'err-' + field.key;
  }

  function optionHtml(value, selected) {
    return '<option value="' + escapeHtml(value) + '"' + (selected ? ' selected' : '') + '>' + escapeHtml(value) + '</option>';
  }

  function renderInput(field, value) {
    value = value || '';
    var id = fieldId(field);
    if (field.inputType === 'textarea') {
      return '<textarea id="' + id + '" data-field-key="' + escapeHtml(field.key) + '" placeholder="' + escapeHtml(field.placeholder || '') + '">' + escapeHtml(value) + '</textarea>';
    }
    if (field.inputType === 'select' || field.inputType === 'grade') {
      var options = field.options && field.options.length ? field.options : [];
      var html = '<select id="' + id + '" data-field-key="' + escapeHtml(field.key) + '">';
      html += '<option value="">בחר</option>';
      options.forEach(function (opt) { html += optionHtml(opt, opt === value); });
      html += '</select>';
      if (field.inputType === 'grade') {
        html += '<input type="text" id="' + id + '-other" data-grade-other="' + escapeHtml(field.key) + '" placeholder="פרט/י" style="display:none;margin-top:0.55rem" />';
      }
      return html;
    }
    var type = ['email', 'tel', 'number', 'date'].indexOf(field.inputType) !== -1 ? field.inputType : 'text';
    return '<input type="' + type + '" id="' + id + '" data-field-key="' + escapeHtml(field.key) + '" placeholder="' + escapeHtml(field.placeholder || '') + '" value="' + escapeHtml(value) + '" />';
  }

  function renderField(field) {
    return '<div class="field" data-field-wrap="' + escapeHtml(field.key) + '">' +
      '<label for="' + fieldId(field) + '">' + escapeHtml(field.label) + (field.required ? ' *' : '') + '</label>' +
      renderInput(field) +
      '<span class="err-msg" id="' + errorId(field) + '">יש למלא שדה תקין</span>' +
      '</div>';
  }

  function mount(container, fields) {
    container.innerHTML = fields.map(renderField).join('');
    fields.forEach(function (field) {
      if (field.inputType !== 'grade') return;
      var select = document.getElementById(fieldId(field));
      var other = document.getElementById(fieldId(field) + '-other');
      if (!select || !other) return;
      select.addEventListener('change', function () {
        other.style.display = select.value === 'אחר' ? 'block' : 'none';
      });
    });
  }

  function valueForField(field) {
    var el = document.getElementById(fieldId(field));
    if (!el) return '';
    if (field.inputType === 'grade' && el.value === 'אחר') {
      var other = document.getElementById(fieldId(field) + '-other');
      return other ? other.value.trim() : '';
    }
    return String(el.value || '').trim();
  }

  function validateValue(field, value) {
    if (field.required && !value) return false;
    if (!value) return true;
    if (field.inputType === 'email' || field.key === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (field.inputType === 'tel' || field.key === 'phone') return /^0(5[0-9]|7[0-9])\d{7}$/.test(value);
    if (field.inputType === 'number') return !Number.isNaN(Number(value));
    return true;
  }

  function setError(field, hasError) {
    var el = document.getElementById(fieldId(field));
    var other = document.getElementById(fieldId(field) + '-other');
    var err = document.getElementById(errorId(field));
    if (el) el.classList.toggle('error', hasError);
    if (other && other.style.display !== 'none') other.classList.toggle('error', hasError);
    if (err) err.classList.toggle('show', hasError);
  }

  function collect(fields) {
    var ok = true;
    var values = {};
    fields.forEach(function (field) {
      var value = valueForField(field);
      values[field.key] = value;
      var valid = validateValue(field, value);
      setError(field, !valid);
      if (!valid) ok = false;
    });
    return { ok: ok, values: values };
  }

  function bulkInputHtml(field, value) {
    value = value || '';
    if (field.inputType === 'select' || field.inputType === 'grade') {
      var options = field.options || [];
      var html = '<select data-field-key="' + escapeHtml(field.key) + '"><option value=""></option>';
      options.forEach(function (opt) { html += optionHtml(opt, opt === value); });
      html += '</select>';
      return html;
    }
    var type = ['email', 'tel', 'number', 'date'].indexOf(field.inputType) !== -1 ? field.inputType : 'text';
    return '<input type="' + type + '" data-field-key="' + escapeHtml(field.key) + '" value="' + escapeHtml(value) + '" placeholder="' + escapeHtml(field.label) + '" />';
  }

  function collectBulkRow(tr, fields) {
    var values = {};
    var hasAny = false;
    var ok = true;
    fields.forEach(function (field) {
      var el = tr.querySelector('[data-field-key="' + CSS.escape(field.key) + '"]');
      var value = el ? String(el.value || '').trim() : '';
      values[field.key] = value;
      if (value) hasAny = true;
      var valid = validateValue(field, value);
      if (el) el.classList.toggle('row-error', hasAny && !valid);
      if (hasAny && !valid) ok = false;
    });
    return { ok: ok, hasAny: hasAny, values: values };
  }

  window.DynamicForm = {
    escapeHtml: escapeHtml,
    fieldId: fieldId,
    mount: mount,
    collect: collect,
    validateValue: validateValue,
    bulkInputHtml: bulkInputHtml,
    collectBulkRow: collectBulkRow,
  };
})();
