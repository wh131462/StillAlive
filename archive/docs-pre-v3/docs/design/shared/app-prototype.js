/* Still Alive App Prototype Bindings
 * 极简原生 JS，承担屏切换 / tab 切换 / 模态 / toggle / mood / pin / heatmap
 * 通过 data-* 属性触发，事件委托。零依赖。
 */
(function () {
  'use strict';

  // -------- helpers --------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function safe(fn) {
    return function (e) {
      try { fn(e); } catch (err) { console.warn('[app-prototype]', err); }
    };
  }

  // -------- screen switcher --------
  function gotoScreen(stack, screenId) {
    if (!stack || !screenId) return;
    var screens = $$('[data-screen]', stack);
    screens.forEach(function (s) {
      s.style.display = (s.getAttribute('data-screen') === screenId) ? 'flex' : 'none';
    });
    stack.setAttribute('data-active-screen', screenId);

    // sync screen-switcher chips (for the stack's own switcher)
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

    // sync any tab-bars on the target screen so their is-active matches the screen
    var targetScreen = $('[data-screen="' + screenId + '"]', stack);
    if (targetScreen) {
      var tabBars = $$('.tab-bar', targetScreen);
      tabBars.forEach(function (bar) {
        $$('.tab-item', bar).forEach(function (it) {
          it.classList.toggle('is-active', it.getAttribute('data-go') === screenId);
        });
      });
    }
  }

  function bindAllStacks() {
    $$('[data-stack]').forEach(function (stack) {
      var initial = stack.getAttribute('data-initial-screen') || (stack.querySelector('[data-screen]') && stack.querySelector('[data-screen]').getAttribute('data-screen'));
      if (initial) gotoScreen(stack, initial);
    });
  }

  // -------- modal --------
  function openModal(id) {
    var m = document.getElementById(id);
    if (m) m.classList.add('is-open');
  }
  function closeModal(target) {
    var m = target.closest('.modal-scrim');
    if (m) m.classList.remove('is-open');
  }
  function closeAllModals() {
    $$('.modal-scrim.is-open').forEach(function (m) { m.classList.remove('is-open'); });
  }

  // -------- toggle --------
  function toggleSwitch(el) { el.classList.toggle('is-on'); }

  // -------- exclusive group (mood, chip-group) --------
  function exclusivePick(el, groupSelector) {
    var group = el.closest(groupSelector);
    if (!group) return;
    $$('.is-active', group).forEach(function (a) { a.classList.remove('is-active'); });
    el.classList.add('is-active');
  }

  // -------- heatmap render --------
  function renderHeatmap(target, weeks) {
    weeks = weeks || 53;
    var levels = ['', 'l1', 'l2', 'l3', 'l4'];
    var frag = document.createDocumentFragment();
    for (var i = 0; i < weeks * 7; i++) {
      var d = document.createElement('div');
      d.className = 'heatmap-cell';
      // pseudo-random to keep visual texture; older cells = filled, recent = sparser
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

  // -------- intersection render (Git branch style) --------
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

      // build min/max day for x-axis
      var dayKeys = posts.map(function (p) { return p.dayKey; }).filter(Boolean);
      var minDay = dayKeys[0] || '2026-01-01';
      var maxDay = dayKeys[dayKeys.length - 1] || '2026-12-31';
      function toDate(k) { return new Date(k + 'T00:00:00'); }
      var minT = toDate(minDay).getTime();
      var maxT = toDate(maxDay).getTime();
      var span = Math.max(1, maxT - minT);

      // ruler
      var rulerHtml = '<div class="intersection__ruler">' +
        '<span>' + minDay.slice(0, 7) + '</span>' +
        '<span style="text-align:center">中段</span>' +
        '<span style="text-align:right">' + maxDay.slice(0, 7) + '</span>' +
        '</div>';

      // build branches
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
            ' title="' + (post.dayKey + ' ' + (post.excerpt || '')) + '"></span>';
        }).join('');

        var hasDots = dots.length > 0;
        var trackContent = hasDots
          ? '<div class="intersection-branch__track">' + dots + '</div>'
          : '<div class="intersection-branch__empty">尚无���现</div>';

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

      // second pass: draw vertical connection lines for posts with multiple mentions
      var multiPosts = posts.filter(function (p) { return (p.mentions || []).length > 1; });
      if (multiPosts.length) {
        var branches = $$('.intersection-branch', target);
        if (!branches.length) return;
        var svgNs = 'http://www.w3.org/2000/svg';
        // remove old svg
        var old = target.querySelector('svg.intersection__layer');
        if (old) old.remove();
        var svg = document.createElementNS(svgNs, 'svg');
        svg.setAttribute('class', 'intersection__layer');
        svg.style.position = 'absolute';
        svg.style.left = '0';
        svg.style.top = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.setAttribute('preserveAspectRatio', 'none');

        // use requestAnimationFrame to wait for layout
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
    } catch (err) {
      console.warn('[renderIntersection]', err);
    }
  }

  // expose for debugging
  window.__SA_renderIntersection = renderIntersection;

  // -------- person graph render --------
  function renderPersonGraph(target, data) {
    if (!target || !data) return;
    try {
      var self = data.self || { name: '我', avatar: '我' };
      var persons = data.persons || [];
      var relations = data.relations || [];

      target.classList.add('graph-canvas');
      target.innerHTML = '';

      // SVG layer for edges
      var svgNs = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(svgNs, 'svg');
      svg.setAttribute('class', 'graph-edges-layer');
      target.appendChild(svg);

      // place nodes (concentric layout, self at center)
      var rect = target.getBoundingClientRect();
      var cx = rect.width / 2;
      var cy = rect.height / 2;

      // self node
      var selfEl = document.createElement('div');
      selfEl.className = 'graph-node is-self';
      selfEl.setAttribute('data-id', 'self');
      selfEl.style.left = cx + 'px';
      selfEl.style.top = cy + 'px';
      selfEl.innerHTML = '<div class="node-avatar">' + (self.avatar || '我') + '</div>' +
                         '<div class="node-name">' + (self.name || '我') + '</div>';
      target.appendChild(selfEl);

      // non-self nodes on a ring
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

      // draw edges
      function pos(el) {
        return {
          x: parseFloat(el.style.left),
          y: parseFloat(el.style.top)
        };
      }
      relations.forEach(function (r) {
        var fromEl = nodeMap[r.from];
        var toEl = nodeMap[r.to];
        if (!fromEl || !toEl) return;
        var p1 = pos(fromEl);
        var p2 = pos(toEl);
        var line = document.createElementNS(svgNs, 'line');
        line.setAttribute('x1', p1.x);
        line.setAttribute('y1', p1.y);
        line.setAttribute('x2', p2.x);
        line.setAttribute('y2', p2.y);
        line.setAttribute('stroke', '#8A9099');
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('opacity', '0.4');
        svg.appendChild(line);
        if (r.type) {
          var label = document.createElement('div');
          label.className = 'graph-edge-label';
          label.textContent = r.type;
          label.style.left = ((p1.x + p2.x) / 2) + 'px';
          label.style.top = ((p1.y + p2.y) / 2) + 'px';
          target.appendChild(label);
        }
      });

      // drag (long-press) for non-self nodes
      var draggingEl = null;
      var dragOffset = { x: 0, y: 0 };
      var pressTimer = null;
      function onPointerDown(e) {
        var nodeEl = e.target.closest('.graph-node');
        if (!nodeEl || nodeEl.classList.contains('is-self')) return;
        var startX = e.clientX || (e.touches && e.touches[0].clientX);
        var startY = e.clientY || (e.touches && e.touches[0].clientY);
        pressTimer = setTimeout(function () {
          draggingEl = nodeEl;
          var nodeRect = nodeEl.getBoundingClientRect();
          var canvasRect = target.getBoundingClientRect();
          dragOffset.x = startX - (nodeRect.left + nodeRect.width / 2);
          dragOffset.y = startY - (nodeRect.top + nodeRect.height / 2);
          nodeEl.style.transition = 'none';
          nodeEl.style.zIndex = '10';
        }, 400);
      }
      function onPointerMove(e) {
        if (!draggingEl) return;
        var canvasRect = target.getBoundingClientRect();
        var x = (e.clientX || (e.touches && e.touches[0].clientX)) - canvasRect.left - dragOffset.x;
        var y = (e.clientY || (e.touches && e.touches[0].clientY)) - canvasRect.top - dragOffset.y;
        draggingEl.style.left = x + 'px';
        draggingEl.style.top = y + 'px';
        // redraw edges
        var draggedId = draggingEl.getAttribute('data-id');
        var lines = svg.querySelectorAll('line');
        relations.forEach(function (r, i) {
          var line = lines[i];
          if (!line) return;
          if (r.from === draggedId) {
            line.setAttribute('x1', x);
            line.setAttribute('y1', y);
          }
          if (r.to === draggedId) {
            line.setAttribute('x2', x);
            line.setAttribute('y2', y);
          }
        });
        e.preventDefault();
      }
      function onPointerUp() {
        if (pressTimer) clearTimeout(pressTimer);
        if (draggingEl) {
          draggingEl.style.transition = '';
          draggingEl.style.zIndex = '';
          draggingEl = null;
        }
      }
      target.addEventListener('mousedown', onPointerDown);
      target.addEventListener('touchstart', onPointerDown, { passive: true });
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchend', onPointerUp);
    } catch (err) {
      console.warn('[renderPersonGraph]', err);
    }
  }
  window.__SA_renderPersonGraph = renderPersonGraph;

  // -------- bindSheet helper --------
  function openSheet(sheetEl) {
    if (!sheetEl) return;
    var scrim = document.querySelector('[data-sheet-scrim-for="' + sheetEl.id + '"]');
    if (scrim) scrim.classList.add('is-open');
    sheetEl.classList.add('is-open');
  }
  function closeSheet(sheetEl) {
    if (!sheetEl) return;
    var scrim = document.querySelector('[data-sheet-scrim-for="' + sheetEl.id + '"]');
    if (scrim) scrim.classList.remove('is-open');
    sheetEl.classList.remove('is-open');
  }
  function closeAllSheets() {
    $$('.sheet.is-open').forEach(function (s) { closeSheet(s); });
  }

  // -------- bindCheckinState helper --------
  function setCheckinState(card, state) {
    if (!card) return;
    card.classList.remove('is-pending', 'is-done', 'is-collapsed');
    card.classList.add('is-' + state);
  }
  window.__SA_setCheckinState = setCheckinState;

  // -------- init --------
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
      // sheet open / close
      var openTrigger = e.target.closest('[data-sheet-open]');
      if (openTrigger) {
        var id = openTrigger.getAttribute('data-sheet-open');
        var sheetEl = document.getElementById(id);
        if (sheetEl) openSheet(sheetEl);
        e.preventDefault();
        return;
      }
      var closeTrigger = e.target.closest('[data-sheet-close]');
      if (closeTrigger) {
        var sheet = closeTrigger.closest('.sheet');
        if (sheet) closeSheet(sheet);
        // also check if it has a checkin-action (e.g. "collapse" on the done button)
        var ckAct = closeTrigger.getAttribute('data-checkin-action');
        if (ckAct === 'collapse') {
          var done2 = document.getElementById('main-checkin-done');
          var collapsed = document.getElementById('main-checkin-collapsed');
          if (done2) done2.style.display = 'none';
          if (collapsed) collapsed.style.display = '';
        }
        e.preventDefault();
        return;
      }
      if (e.target.classList && e.target.classList.contains('sheet-scrim')) {
        var sheetId = e.target.getAttribute('data-sheet-scrim-for');
        var s = sheetId && document.getElementById(sheetId);
        if (s) closeSheet(s);
        return;
      }
      // checkin state machine
      var ckBtn = e.target.closest('[data-checkin-action]');
      if (ckBtn) {
        var act = ckBtn.getAttribute('data-checkin-action');
        if (act === 'checkin') {
          var pending = document.getElementById('main-checkin-card');
          var done = document.getElementById('main-checkin-done');
          if (pending) pending.style.display = 'none';
          if (done) done.style.display = '';
        }
        if (act === 'collapse') {
          var done2 = document.getElementById('main-checkin-done');
          var collapsed = document.getElementById('main-checkin-collapsed');
          if (done2) done2.style.display = 'none';
          if (collapsed) collapsed.style.display = '';
        }
        e.preventDefault();
        return;
      }

      var goEl = e.target.closest('[data-go]');
      if (goEl) {
        var target = goEl.getAttribute('data-go');
        // special: post-composer opens sheet instead of switching screen
        if (target === 'post-composer') {
          var sheet = document.getElementById('post-composer-sheet');
          if (sheet) openSheet(sheet);
          e.preventDefault();
          return;
        }
        var stack = goEl.closest('[data-stack]') || $('[data-stack]');
        if (stack && target) {
          gotoScreen(stack, target);
          e.preventDefault();
          return;
        }
      }
      var openEl = e.target.closest('[data-modal-open]');
      if (openEl) {
        openModal(openEl.getAttribute('data-modal-open'));
        e.preventDefault();
        return;
      }
      var closeEl = e.target.closest('[data-modal-close]');
      if (closeEl) {
        closeModal(closeEl);
        e.preventDefault();
        return;
      }
      var toggleEl = e.target.closest('.toggle');
      if (toggleEl) {
        toggleSwitch(toggleEl);
        e.preventDefault();
        return;
      }
      var mood = e.target.closest('.mood-chip');
      if (mood) {
        exclusivePick(mood, '.mood-grid');
        e.preventDefault();
        return;
      }
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
