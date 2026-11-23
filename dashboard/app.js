// Token Radar — dashboard/app.js
//
// A static page with no framework and no network. main.ts writes the dataset to ../data.js as
// window.RADAR; this script renders it: the ranked board with sortable columns, a category
// filter and a search box, a Live view that sets the already-trading protocols apart, a model
// panel that states the formula and the category multiples, and a detail drawer per protocol
// that recomputes the row's implied value from the snapshot figures and lays out its farm plan.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var root = document.getElementById('board');
  var state = { q: '', category: 'all', tab: 'pre', sort: 'implied', dir: -1, selected: null };

  // ---------- formatting ----------

  var usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usdFmt.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // ---------- the model, recomputed in the page ----------
  // Same arithmetic as lib/model.ts: the detail drawer shows this number beside board.json's,
  // so a stale or hand-edited board would be visible at a glance.
  function impliedOf(row) {
    var m = DATA.model;
    var raw = row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d;
    var growth = Math.min(m.growth_cap, Math.max(m.growth_floor, raw));
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? m.unknown_age_days : row.age_days;
    var maturity = m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    return Math.max(1, Math.round(row.tvl_usd * row.base_multiple * growthMult * maturity));
  }

  // ---------- farm plans ----------
  // The same derivation that writes board.json's farm_steps: category picks the action, TVL
  // picks the capital, age picks the hold. The strings must match the model's, word for word.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var steps = [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ];
    return steps.map(stepText);
  }

  // ---------- tiny DOM helper ----------
  function h(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // ---------- hash state ----------
  function readHash() {
    var params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.selected) params.set('p', state.selected);
    var s = params.toString();
    window.history.replaceState(null, '', s ? '#' + s : window.location.pathname + window.location.search);
  }

  // ---------- board data ----------
  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (!q) return true;
      return [r.name, r.slug, r.category || '', (r.chains || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function sorted(list) {
    var key = state.sort;
    var dir = state.dir;
    function value(r) {
      if (key === 'name') return r.name.toLowerCase();
      if (key === 'tvl') return r.tvl_usd;
      if (key === 'growth') return r.change_7d === null ? -Infinity : r.change_7d;
      if (key === 'age') return r.age_days === null ? Infinity : r.age_days;
      return r.implied_value_usd;
    }
    return list.slice().sort(function (a, b) {
      var av = value(a);
      var bv = value(b);
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  // ---------- page sections ----------
  function header() {
    return h('header', { class: 'top' },
      h('div', { class: 'brand' }, h('span', { class: 'mark' }), h('span', { class: 'brand-name', text: 'Token Radar' })),
      h('div', { class: 'top-meta' },
        h('span', { text: 'Snapshot ' + DATA.as_of }),
        h('span', { text: 'DefiLlama protocol index' }),
        h('span', { text: DATA.model_version + ' model' })));
  }

  function lede() {
    return h('section', { class: 'lede' },
      h('div', null,
        h('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        h('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor. Implied value is a model, not a promise.' })),
      h('div', { class: 'facts' },
        h('div', { class: 'fact' }, h('span', { text: 'Watchlist covered' }), h('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        h('div', { class: 'fact' }, h('span', { text: 'Pre-token rows scored' }), h('b', { text: String(DATA.board_size) })),
        h('div', { class: 'fact' }, h('span', { text: 'Early rows below the floor' }), h('b', { text: String(DATA.early_size) })),
        h('div', { class: 'fact' }, h('span', { text: 'Live-token protocols set aside' }), h('b', { text: String(DATA.live_size) }))));
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var search = h('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = h('select', { id: 'category', 'aria-label': 'Filter by category' },
      h('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return h('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); }));
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    function tabButton(tab, label) {
      return h('button', { type: 'button', 'aria-pressed': state.tab === tab ? 'true' : 'false', text: label, onclick: function () { state.tab = tab; render(); } });
    }
    return h('div', { class: 'controls' },
      h('div', { class: 'field' }, h('label', { for: 'q', text: 'Search' }), search),
      h('div', { class: 'field' }, h('label', { for: 'category', text: 'Category' }), select),
      h('div', { class: 'field' }, h('span', { class: 'sub', text: 'Token status' }), h('div', { class: 'tabs' }, tabButton('pre', 'Pre-token'), tabButton('live', 'Live token'))),
      h('span', { class: 'count', text: state.tab === 'pre' ? visibleRows().length + ' rows shown' : DATA.live.length + ' live-token protocols' }));
  }

  function sortHeader(key, label) {
    var arrow = state.sort === key ? (state.dir < 0 ? ' v' : ' ^') : '';
    return h('th', { scope: 'col' },
      h('button', { type: 'button', onclick: function () {
        if (state.sort === key) state.dir = -state.dir;
        else { state.sort = key; state.dir = -1; }
        render();
      } }, label, arrow ? h('span', { 'aria-hidden': 'true', text: arrow }) : null));
  }

  function boardTable() {
    var list = sorted(visibleRows());
    if (list.length === 0) {
      return h('div', { class: 'panel' }, h('div', { class: 'empty' },
        h('h2', { text: 'No protocol matches that filter' }),
        h('p', { text: 'Clear the search or pick another category to see the board again.' }),
        h('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; writeHash(); render(); } })));
    }
    var top = list[0].implied_value_usd || 1;
    var body = h('tbody');
    list.forEach(function (r) {
      var chains = r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain';
      var row = h('tr', { 'data-selected': state.selected === r.slug ? 'true' : 'false', tabindex: '0',
          onclick: function () { openDetail(r.slug); },
          onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } } },
        h('td', { class: 'num', text: String(r.rank) }),
        h('td', null, h('div', { class: 'name' }, h('b', { text: r.name }), h('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + chains }))),
        h('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        h('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        h('td', { class: 'num', text: fmtAge(r.age_days) }),
        h('td', null, h('div', { class: 'implied' },
          h('div', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / top) * 100)) + '%' })),
          h('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }))),
        h('td', null, h('span', { class: 'status', text: 'no token' })));
      body.appendChild(row);
    });
    return h('div', { class: 'panel' }, h('div', { class: 'table-wrap' },
      h('table', null,
        h('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
        h('thead', null, h('tr', null,
          sortHeader('implied', 'Rank'), sortHeader('name', 'Protocol'), sortHeader('tvl', 'TVL'),
          sortHeader('growth', '7d'), sortHeader('age', 'Age'), sortHeader('implied', 'Implied value'),
          h('th', { scope: 'col', text: 'Token' }))),
        body)));
  }

  function liveTable() {
    var body = h('tbody');
    DATA.live.forEach(function (r) {
      var chains = r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain';
      body.appendChild(h('tr', null,
        h('td', { class: 'num', text: 'live' }),
        h('td', null, h('div', { class: 'name' }, h('b', { text: r.name }), h('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + chains }))),
        h('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        h('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        h('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        h('td', null, h('span', { class: 'status', text: 'already trades' }))));
    });
    return h('div', { class: 'panel' }, h('div', { class: 'table-wrap' },
      h('table', null,
        h('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
        h('thead', null, h('tr', null,
          h('th', { scope: 'col', text: 'Status' }), h('th', { scope: 'col', text: 'Protocol' }),
          h('th', { scope: 'col', text: 'TVL' }), h('th', { scope: 'col', text: '7d' }),
          h('th', { scope: 'col', text: 'Market cap' }), h('th', { scope: 'col', text: 'Token' }))),
        body)));
  }

  function modelPanel() {
    var m = DATA.model;
    var multiples = (DATA.category_multiples || []).slice(0, 8);
    var children = [
      h('h2', { text: 'How implied value is computed' }),
      h('p', { class: 'sub', text: "Every row is scored by one function of the snapshot figures; no protocol name is special-cased and no row is hand-picked. The base multiple is the market's own: the market-cap / TVL ratio this snapshot records for the protocols that already trade." }),
      h('div', { class: 'formula', text: 'implied = round( tvl_usd x category_multiple x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') )' }),
      h('p', { class: 'sub', text: "A protocol's category multiple is the median market-cap / TVL of its category's live-token protocols in this snapshot, clamped between " + m.multiple_floor + ' and ' + m.multiple_cap + '; a category with fewer than ' + m.min_peers + ' live peers uses the all-category median, ' + DATA.global_multiple + '. Age is the time since the protocol was first listed — how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days.' })
    ];
    if (multiples.length > 0) {
      var body = h('tbody');
      multiples.forEach(function (c) {
        body.appendChild(h('tr', null,
          h('td', { text: c.category }),
          h('td', { class: 'num', text: String(c.multiple) }),
          h('td', { class: 'num', text: String(c.peers) })));
      });
      children.push(h('div', { class: 'table-wrap' },
        h('table', null,
          h('caption', { class: 'sub', text: 'Category multiples read off this snapshot, strongest first.' }),
          h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Category' }), h('th', { scope: 'col', text: 'Median cap / TVL' }), h('th', { scope: 'col', text: 'Live peers' }))),
          body)));
    }
    return h('section', { class: 'panel model' }, children);
  }

  // ---------- detail drawer ----------
  var dialog = h('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function fact(label, value) {
    return h('div', null, h('span', { text: label }), h('b', { class: 'num', text: value }));
  }

  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var recomputed = impliedOf(row);
    var note = 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) +
      (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') +
      ' This is an estimate, not a price.';
    dialog.appendChild(h('div', { class: 'detail-head' },
      h('div', null,
        h('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        h('h2', { id: 'detail-title', text: row.name }),
        h('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })),
      h('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })));
    dialog.appendChild(h('section', { class: 'detail-section' },
      h('h3', { text: 'Implied value' }),
      h('div', { class: 'equation' },
        fact('TVL', fmtUsd(row.tvl_usd)),
        fact('Category multiple', String(row.base_multiple)),
        fact('Seven-day growth', fmtPct(row.change_7d)),
        fact('Age with no token', fmtAge(row.age_days)),
        fact('Growth multiplier', String(row.growth_multiplier)),
        fact('Maturity multiplier', String(row.maturity_multiplier)),
        fact('Implied value', fmtUsd(row.implied_value_usd))),
      h('p', { class: 'sub', text: note })));
    var items = farmSteps(row).map(function (s) {
      var at = s.indexOf(' Cost: ');
      var action = at >= 0 ? s.slice(0, at) : s;
      var tail = at >= 0 ? s.slice(at + 1) : '';
      return h('li', null, h('b', { text: action }), h('span', { class: 'cost', text: tail }));
    });
    dialog.appendChild(h('section', { class: 'detail-section' },
      h('h3', { text: 'Farm plan' }),
      h('ol', { class: 'steps' }, items)));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  // ---------- render ----------
  function render() {
    root.textContent = '';
    var shell = h('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre' ? boardTable() : liveTable());
    if (state.tab === 'pre') shell.appendChild(modelPanel());
    root.appendChild(shell);
    root.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) root.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
