/* Still Alive · Web Prototype Bindings
 * Reuses the same data-* contract as app-prototype.js plus:
 *   - .nav-rail .nav-item[data-go] (highlights active nav)
 *   - syncs <header> .addr text per screen via [data-addr="..."] attribute on the screen
 */
(function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function safe(fn) {
    return function (e) {
      try { fn(e); } catch (err) { console.warn('[web-prototype]', err); }
    };
  }

  function gotoScreen(stack, screenId) {
    if (!stack || !screenId) return;
    $$('[data-screen]', stack).forEach(function (s) {
      s.style.display = (s.getAttribute('data-screen') === screenId) ? 'block' : 'none';
    });
    stack.setAttribute('data-active-screen', screenId);

    var stackId = stack.getAttribute('data-stack');
    var switcher = document.querySelector('[data-switcher-for="' + stackId + '"]');
    if (switcher) {
      $$('.screen-chip', switcher).forEach(function (chip) {
        chip.classList.toggle('is-active', chip.getAttribute('data-go') === screenId);
      });
      $$('.screen-tab', switcher).forEach(function (tab) {
        tab.classList.toggle('is-active', tab.getAttribute('data-go') === screenId);
      });
    }

    var rail = $('.nav-rail', stack.parentNode) || $('.nav-rail');
    if (rail) {
      $$('.nav-item', rail).forEach(function (it) {
        it.classList.toggle('is-active', it.getAttribute('data-go') === screenId);
      });
    }

    // address bar update
    var addrEl = document.querySelector('[data-addr-display]');
    var target = $('[data-screen="' + screenId + '"]', stack);
    if (addrEl && target) {
      var addr = target.getAttribute('data-addr');
      if (addr) addrEl.textContent = addr;
    }
  }

  function bindAllStacks() {
    $$('[data-stack]').forEach(function (stack) {
      var initial = stack.getAttribute('data-initial-screen') || (stack.querySelector('[data-screen]') && stack.querySelector('[data-screen]').getAttribute('data-screen'));
      if (initial) gotoScreen(stack, initial);
    });
  }

  function openModal(id) {
    var m = document.getElementById(id);
    if (m) m.classList.add('is-open');
  }
  function closeAllModals() {
    $$('.modal-scrim.is-open').forEach(function (m) { m.classList.remove('is-open'); });
  }

  function exclusivePick(el, groupSelector) {
    var group = el.closest(groupSelector);
    if (!group) return;
    $$('.is-active', group).forEach(function (a) { a.classList.remove('is-active'); });
    el.classList.add('is-active');
  }

  function renderHeatmap(target, weeks) {
    weeks = weeks || 53;
    var levels = ['', 'l1', 'l2', 'l3', 'l4'];
    var frag = document.createDocumentFragment();
    for (var i = 0; i < weeks * 7; i++) {
      var d = document.createElement('div');
      d.className = 'heatmap-cell';
      var ratio = i / (weeks * 7);
      var r = Math.random();
      var l = 0;
      if (ratio < 0.85) {
        if (r > 0.85) l = 4;
        else if (r > 0.7) l = 3;
        else if (r > 0.5) l = 2;
        else if (r > 0.25) l = 1;
      } else if (r > 0.6) {
        l = 1;
      }
      if (l) d.classList.add(levels[l]);
      frag.appendChild(d);
    }
    target.innerHTML = '';
    target.appendChild(frag);
  }

  function renderIntersection(target, data) {
    if (!target || !data) return;
    try {
      var persons = data.persons || [];
      var posts = (data.posts || []).slice().sort(function (a, b) {
        return (a.dayKey || '').localeCompare(b.dayKey || '');
      });
      var hideIsolated = target.getAttribute('data-hide-isolated') === 'true';
      var mentioned = {};
      posts.forEach(function (p) { (p.mentions || []).forEach(function (id) { mentioned[id] = true; }); });
      var visiblePersons = hideIsolated ? persons.filter(function (p) { return mentioned[p.id]; }) : persons;

      var dayKeys = posts.map(function (p) { return p.dayKey; }).filter(Boolean);
      var minDay = dayKeys[0] || '2026-01-01';
      var maxDay = dayKeys[dayKeys.length - 1] || '2026-12-31';
      function toDate(k) { return new Date(k + 'T00:00:00'); }
      var minT = toDate(minDay).getTime();
      var maxT = toDate(maxDay).getTime();
      var span = Math.max(1, maxT - minT);

      var rulerHtml = '<div class="intersection__ruler">' +
        '<span>' + minDay.slice(0, 7) + '</span>' +
        '<span style="text-align:center">中段</span>' +
        '<span style="text-align:right">' + maxDay.slice(0, 7) + '</span>' +
        '</div>';

      var branchHtml = visiblePersons.map(function (p) {
        var dots = posts.filter(function (post) {
          return (post.mentions || []).indexOf(p.id) >= 0;
        }).map(function (post) {
          var t = toDate(post.dayKey).getTime();
          var pct = ((t - minT) / span) * 100;
          return '<span class="intersection-dot is-' + (p.color || 'green') + '"' +
            ' style="left:' + pct.toFixed(2) + '%;"' +
            ' data-post-id="' + post.id + '"' +
            ' data-day="' + post.dayKey + '"' +
            ' title="' + (post.dayKey + ' · ' + (post.excerpt || '')) + '"></span>';
        }).join('');
        var hasDots = dots.length > 0;
        var trackContent = hasDots
          ? '<div class="intersection-branch__track">' + dots + '</div>'
          : '<div class="intersection-branch__empty">尚无共现</div>';
        return '<div class="intersection-branch">' +
          '<div class="intersection-branch__label">' +
            '<div class="row-lead" style="background:var(--' + (p.color || 'vital-green') + '-soft);">' +
              (p.avatar || p.name.charAt(0)) + '</div>' +
            '<div class="name">' + p.name + '</div>' +
          '</div>' +
          trackContent +
          '</div>';
      }).join('');

      target.classList.add('intersection');
      target.innerHTML = rulerHtml + branchHtml;

      var multiPosts = posts.filter(function (p) { return (p.mentions || []).length > 1; });
      if (multiPosts.length) {
        var branches = $$('.intersection-branch', target);
        if (!branches.length) return;
        var svgNs = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(svgNs, 'svg');
        svg.setAttribute('class', 'intersection__layer');
        svg.style.position = 'absolute';
        svg.style.left = '0';
        svg.style.top = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        requestAnimationFrame(function () {
          var targetRect = target.getBoundingClientRect();
          svg.setAttribute('viewBox', '0 0 ' + targetRect.width + ' ' + targetRect.height);
          svg.setAttribute('width', targetRect.width);
          svg.setAttribute('height', targetRect.height);
          multiPosts.forEach(function (post) {
            var ys = [];
            branches.forEach(function (branch) {
              var dot = branch.querySelector('.intersection-dot[data-post-id="' + post.id + '"]');
              if (dot) {
                var r = dot.getBoundingClientRect();
                ys.push({
                  x: r.left + r.width / 2 - targetRect.left,
                  y: r.top + r.height / 2 - targetRect.top
                });
              }
            });
            if (ys.length < 2) return;
            var xs = ys[0].x;
            var yMin = Math.min.apply(null, ys.map(function (p) { return p.y; }));
            var yMax = Math.max.apply(null, ys.map(function (p) { return p.y; }));
            var line = document.createElementNS(svgNs, 'line');
            line.setAttribute('x1', xs);
            line.setAttribute('x2', xs);
            line.setAttribute('y1', yMin);
            line.setAttribute('y2', yMax);
            line.setAttribute('stroke', '#8A9099');
            line.setAttribute('stroke-width', '1.5');
            line.setAttribute('opacity', '0.5');
            svg.appendChild(line);
          });
          target.style.position = 'relative';
          target.appendChild(svg);
        });
      }
    } catch (err) { console.warn('[renderIntersection]', err); }
  }
  window.__SA_renderIntersection = renderIntersection;

  // -------- person graph (web) --------
  function renderPersonGraph(target, data) {
    if (!target || !data) return;
    try {
      var self = data.self || { name: '我', avatar: '我' };
      var persons = data.persons || [];
      var relations = data.relations || [];
      target.classList.add('graph-canvas');
      target.innerHTML = '';
      var svgNs = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(svgNs, 'svg');
      svg.setAttribute('class', 'graph-edges-layer');
      target.appendChild(svg);
      var rect = target.getBoundingClientRect();
      var cx = rect.width / 2;
      var cy = rect.height / 2;
      var selfEl = document.createElement('div');
      selfEl.className = 'graph-node is-self';
      selfEl.setAttribute('data-id', 'self');
      selfEl.style.left = cx + 'px';
      selfEl.style.top = cy + 'px';
      selfEl.innerHTML = '<div class="node-avatar">' + (self.avatar || '我') + '</div>' +
                         '<div class="node-name">' + (self.name || '我') + '</div>';
      target.appendChild(selfEl);
      var n = persons.length;
      var radius = Math.min(rect.width, rect.height) * 0.32;
      var nodeMap = { self: selfEl };
      persons.forEach(function (p, idx) {
        var angle = (idx / n) * Math.PI * 2 - Math.PI / 2;
        var x = (p.layoutHint && p.layoutHint.x !== undefined) ? p.layoutHint.x : cx + Math.cos(angle) * radius;
        var y = (p.layoutHint && p.layoutHint.y !== undefined) ? p.layoutHint.y : cy + Math.sin(angle) * radius;
        var nodeEl = document.createElement('div');
        nodeEl.className = 'graph-node color-' + (p.color || 'green');
        nodeEl.setAttribute('data-id', p.id);
        nodeEl.style.left = x + 'px';
        nodeEl.style.top = y + 'px';
        nodeEl.innerHTML = '<div class="node-avatar">' + (p.avatar || p.name.charAt(0)) + '</div>' +
                           '<div class="node-name">' + p.name + '</div>';
        target.appendChild(nodeEl);
        nodeMap[p.id] = nodeEl;
      });
      relations.forEach(function (r) {
        var fromEl = nodeMap[r.from];
        var toEl = nodeMap[r.to];
        if (!fromEl || !toEl) return;
        var x1 = parseFloat(fromEl.style.left);
        var y1 = parseFloat(fromEl.style.top);
        var x2 = parseFloat(toEl.style.left);
        var y2 = parseFloat(toEl.style.top);
        var line = document.createElementNS(svgNs, 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', '#8A9099');
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('opacity', '0.4');
        svg.appendChild(line);
        if (r.type) {
          var label = document.createElement('div');
          label.className = 'graph-edge-label';
          label.textContent = r.type;
          label.style.left = ((x1 + x2) / 2) + 'px';
          label.style.top = ((y1 + y2) / 2) + 'px';
          target.appendChild(label);
        }
      });
    } catch (err) { console.warn('[renderPersonGraph]', err); }
  }
  window.__SA_renderPersonGraph = renderPersonGraph;

  function openSheet(s) {
    if (!s) return;
    var scrim = document.querySelector('[data-sheet-scrim-for="' + s.id + '"]');
    if (scrim) scrim.classList.add('is-open');
    s.classList.add('is-open');
  }
  function closeSheet(s) {
    if (!s) return;
    var scrim = document.querySelector('[data-sheet-scrim-for="' + s.id + '"]');
    if (scrim) scrim.classList.remove('is-open');
    s.classList.remove('is-open');
  }

  function setCheckinState(card, state) {
    if (!card) return;
    card.classList.remove('is-pending', 'is-done', 'is-collapsed');
    card.classList.add('is-' + state);
  }
  window.__SA_setCheckinState = setCheckinState;

  function init() {
    bindAllStacks();
    $$('[data-heatmap]').forEach(function (el) {
      renderHeatmap(el, parseInt(el.getAttribute('data-weeks'), 10) || 53);
    });
    $$('[data-intersection]').forEach(function (el) {
      var src = el.getAttribute('data-intersection');
      try {
        var data = src && window[src];
        if (data) renderIntersection(el, data);
      } catch (err) { console.warn('[intersection init]', err); }
    });
    $$('[data-graph]').forEach(function (el) {
      var src = el.getAttribute('data-graph');
      try {
        var data = src && window[src];
        if (data) renderPersonGraph(el, data);
      } catch (err) { console.warn('[graph init]', err); }
    });

    document.addEventListener('click', safe(function (e) {
      var openTrigger = e.target.closest('[data-sheet-open]');
      if (openTrigger) {
        var s = document.getElementById(openTrigger.getAttribute('data-sheet-open'));
        if (s) openSheet(s);
        e.preventDefault();
        return;
      }
      var closeTrigger = e.target.closest('[data-sheet-close]');
      if (closeTrigger) {
        var sh = closeTrigger.closest('.sheet');
        if (sh) closeSheet(sh);
        e.preventDefault();
        return;
      }
      if (e.target.classList && e.target.classList.contains('sheet-scrim')) {
        var sid = e.target.getAttribute('data-sheet-scrim-for');
        var s2 = sid && document.getElementById(sid);
        if (s2) closeSheet(s2);
        return;
      }
      var ckBtn = e.target.closest('[data-checkin-action]');
      if (ckBtn) {
        var act = ckBtn.getAttribute('data-checkin-action');
        var card = ckBtn.closest('.checkin-card');
        if (card && act === 'checkin') setCheckinState(card, 'done');
        if (card && act === 'collapse') setCheckinState(card, 'collapsed');
        e.preventDefault();
        return;
      }
      if (e.target.classList && e.target.classList.contains('modal-scrim')) {
        e.target.classList.remove('is-open');
        return;
      }
      var goEl = e.target.closest('[data-go]');
      if (goEl) {
        var stack = goEl.closest('[data-stack]') || $('[data-stack]');
        var target = goEl.getAttribute('data-go');
        if (stack && target) {
          gotoScreen(stack, target);
          e.preventDefault();
          return;
        }
      }
      var openEl = e.target.closest('[data-modal-open]');
      if (openEl) { openModal(openEl.getAttribute('data-modal-open')); e.preventDefault(); return; }
      var closeEl = e.target.closest('[data-modal-close]');
      if (closeEl) { closeAllModals(); e.preventDefault(); return; }
      var toggleEl = e.target.closest('.toggle');
      if (toggleEl) { toggleEl.classList.toggle('is-on'); e.preventDefault(); return; }
      var chip = e.target.closest('[data-pick-group]');
      if (chip) {
        var group = chip.getAttribute('data-pick-group');
        exclusivePick(chip, '[data-pick="' + group + '"]');
        e.preventDefault();
        return;
      }
    }));

    document.addEventListener('keydown', safe(function (e) {
      if (e.key === 'Escape') closeAllModals();
    }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
