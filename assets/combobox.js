(function () {
  var idSeq = 0;

  function normalize(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .replace(/[׳׳'`]/g, "'")
      .replace(/[״"]/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function matches(text, query) {
    if (!query) return true;
    var haystack = normalize(text);
    return normalize(query).split(' ').every(function (token) {
      return haystack.indexOf(token) !== -1;
    });
  }

  function readOptions(select) {
    return [].slice.call(select.options)
      .filter(function (opt) { return opt.value !== ''; })
      .map(function (opt) {
        return { value: opt.value, label: opt.textContent, disabled: opt.disabled };
      });
  }

  function placeholderText(select) {
    var first = select.options[0];
    return first && first.value === '' ? first.textContent : 'בחר';
  }

  function Combobox(select) {
    var self = this;
    this.select = select;
    this.options = [];
    this.filtered = [];
    this.activeIndex = -1;
    this.open = false;

    var uid = 'cmb-' + (++idSeq);
    var wrap = document.createElement('div');
    wrap.className = 'combobox';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'combobox-input';
    input.setAttribute('role', 'combobox');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', uid + '-list');
    if (select.id) {
      input.id = select.id + '-search';
      var label = document.querySelector('label[for="' + select.id + '"]');
      if (label) label.setAttribute('for', input.id);
    }

    var clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'combobox-clear';
    clear.setAttribute('aria-label', 'נקה בחירה');
    clear.innerHTML = '&times;';

    var list = document.createElement('ul');
    list.className = 'combobox-list';
    list.id = uid + '-list';
    list.setAttribute('role', 'listbox');

    this.wrap = wrap;
    this.input = input;
    this.clearBtn = clear;
    this.list = list;

    select.parentNode.insertBefore(wrap, select);
    select.classList.add('combobox-native');
    select.setAttribute('tabindex', '-1');
    select.setAttribute('aria-hidden', 'true');
    wrap.appendChild(select);
    wrap.appendChild(input);
    wrap.appendChild(clear);
    wrap.appendChild(list);

    input.addEventListener('input', function () {
      self.select.value = '';
      self.openList(input.value);
    });
    input.addEventListener('focus', function () { self.openList(''); });
    input.addEventListener('click', function () { self.openList(self.select.value ? '' : input.value); });
    input.addEventListener('keydown', function (event) { self.onKeyDown(event); });
    input.addEventListener('blur', function () {
      // allow a click on the list to register first
      setTimeout(function () { self.closeList(true); }, 120);
    });

    clear.addEventListener('mousedown', function (event) { event.preventDefault(); });
    clear.addEventListener('click', function () {
      self.setValue('');
      input.focus();
    });

    list.addEventListener('mousedown', function (event) { event.preventDefault(); });
    list.addEventListener('click', function (event) {
      var li = event.target.closest('li[data-value]');
      if (!li || li.getAttribute('aria-disabled') === 'true') return;
      self.setValue(li.getAttribute('data-value'));
      self.closeList();
      input.focus();
    });

    // mirror .error / disabled changes made on the native select by existing code
    this.observer = new MutationObserver(function () { self.syncState(); });
    this.observer.observe(select, { attributes: true, attributeFilter: ['class', 'disabled'] });

    this.refresh();
  }

  Combobox.prototype.refresh = function () {
    this.options = readOptions(this.select);
    this.input.placeholder = placeholderText(this.select);
    this.syncState();
    this.renderInputValue();
  };

  Combobox.prototype.syncState = function () {
    this.input.disabled = this.select.disabled;
    this.input.classList.toggle('error', this.select.classList.contains('error'));
    this.wrap.classList.toggle('is-disabled', this.select.disabled);
  };

  Combobox.prototype.selectedOption = function () {
    var value = this.select.value;
    if (!value) return null;
    for (var i = 0; i < this.options.length; i++) {
      if (this.options[i].value === value) return this.options[i];
    }
    return null;
  };

  Combobox.prototype.renderInputValue = function () {
    var selected = this.selectedOption();
    this.input.value = selected ? selected.label : '';
    this.clearBtn.classList.toggle('show', Boolean(selected));
  };

  Combobox.prototype.setValue = function (value) {
    this.select.value = value;
    this.renderInputValue();
    this.select.dispatchEvent(new Event('change', { bubbles: true }));
  };

  Combobox.prototype.openList = function (query) {
    if (this.select.disabled) return;
    this.filtered = this.options.filter(function (opt) { return matches(opt.label, query); });
    this.renderList();
    this.open = true;
    this.wrap.classList.add('is-open');
    this.input.setAttribute('aria-expanded', 'true');
    var selected = this.selectedOption();
    this.setActive(selected ? this.filtered.indexOf(selected) : this.firstEnabledIndex());
  };

  Combobox.prototype.firstEnabledIndex = function () {
    for (var i = 0; i < this.filtered.length; i++) {
      if (!this.filtered[i].disabled) return i;
    }
    return -1;
  };

  Combobox.prototype.closeList = function (restoreText) {
    this.open = false;
    this.activeIndex = -1;
    this.wrap.classList.remove('is-open');
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    if (restoreText) this.renderInputValue();
  };

  Combobox.prototype.renderList = function () {
    var html = '';
    if (!this.filtered.length) {
      html = '<li class="combobox-empty">לא נמצאו תוצאות</li>';
    } else {
      html = this.filtered.map(function (opt, idx) {
        return '<li role="option" id="' + this.list.id + '-opt' + idx + '"' +
          ' data-value="' + String(opt.value).replace(/"/g, '&quot;') + '"' +
          ' data-idx="' + idx + '"' +
          (opt.disabled ? ' aria-disabled="true" class="is-disabled"' : '') + '>' +
          String(opt.label).replace(/&/g, '&amp;').replace(/</g, '&lt;') +
          '</li>';
      }, this).join('');
    }
    this.list.innerHTML = html;
  };

  Combobox.prototype.setActive = function (index) {
    var items = this.list.querySelectorAll('li[data-value]');
    [].forEach.call(items, function (li) { li.classList.remove('is-active'); });
    this.activeIndex = index;
    if (index < 0 || index >= items.length) {
      this.input.removeAttribute('aria-activedescendant');
      return;
    }
    var active = items[index];
    active.classList.add('is-active');
    this.input.setAttribute('aria-activedescendant', active.id);
    var top = active.offsetTop;
    var bottom = top + active.offsetHeight;
    if (top < this.list.scrollTop) this.list.scrollTop = top;
    else if (bottom > this.list.scrollTop + this.list.clientHeight) this.list.scrollTop = bottom - this.list.clientHeight;
  };

  Combobox.prototype.move = function (step) {
    if (!this.open) return this.openList('');
    var count = this.filtered.length;
    if (!count) return;
    var idx = this.activeIndex;
    for (var i = 0; i < count; i++) {
      idx = (idx + step + count) % count;
      if (!this.filtered[idx].disabled) break;
    }
    this.setActive(idx);
  };

  Combobox.prototype.onKeyDown = function (event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.move(-1);
        break;
      case 'Enter':
        if (this.open && this.activeIndex >= 0 && this.filtered[this.activeIndex]) {
          event.preventDefault();
          this.setValue(this.filtered[this.activeIndex].value);
          this.closeList();
        }
        break;
      case 'Escape':
        if (this.open) {
          event.preventDefault();
          this.closeList(true);
        }
        break;
      case 'Tab':
        this.closeList(true);
        break;
    }
  };

  function attach(select) {
    if (!select) return null;
    if (select._combobox) {
      select._combobox.refresh();
      return select._combobox;
    }
    select._combobox = new Combobox(select);
    return select._combobox;
  }

  window.Combobox = { attach: attach };
})();
