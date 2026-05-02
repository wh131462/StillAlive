(function () {
  var TABS = [
    { id: 'home', key: 'nav_home', href: '../home/index.html',
      svg: '<path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10"/>' },
    { id: 'checkin', key: 'nav_checkin', href: '../checkin/index.html',
      svg: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/>' },
    { id: 'person', key: 'nav_person', href: '../person/list.html',
      svg: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>' },
    { id: 'profile', key: 'nav_mine', href: '../profile/index.html',
      svg: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6 19c1-3 3-4 6-4s5 1 6 4"/>' }
  ];

  function t(k) {
    return (window.SA && window.SA.t) ? window.SA.t(k) : k;
  }

  function buildIcon(svg, isActive) {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (isActive ? '2.2' : '1.6') + '" stroke-linecap="round" stroke-linejoin="round">' + svg + '</svg>';
  }

  function renderBottom(active) {
    var nav = document.createElement('nav');
    nav.className = 'sa-bottom-nav sa-nav-bottom';
    TABS.forEach(function (tab) {
      var a = document.createElement('a');
      a.href = tab.href;
      a.dataset.id = tab.id;
      var isActive = tab.id === active;
      a.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;letter-spacing:0.02em;color:' + (isActive ? 'var(--life)' : 'var(--ink-faint)') + ';transition:color 0.3s';
      a.innerHTML = buildIcon(tab.svg, isActive) + '<span data-i18n="' + tab.key + '">' + t(tab.key) + '</span>';
      nav.appendChild(a);
    });
    document.body.appendChild(nav);
  }

  function renderSide(active) {
    var aside = document.createElement('aside');
    aside.className = 'sa-sidebar sa-nav-side';

    var brand = document.createElement('a');
    brand.href = '../index.html';
    brand.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:48px;text-decoration:none';
    brand.innerHTML = '<div style="width:28px;height:28px;background:var(--life);display:flex;align-items:center;justify-content:center;animation:breathe 3s var(--ease-breath) infinite"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" stroke-width="2" stroke-linecap="round"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg></div><span class="sa-sidebar-label" style="font-family:var(--font-display);font-style:italic;font-size:16px;color:var(--ink)" data-i18n="app_name_en">Still Alive</span>';
    aside.appendChild(brand);

    TABS.forEach(function (tab) {
      var a = document.createElement('a');
      a.href = tab.href;
      a.dataset.id = tab.id;
      var isActive = tab.id === active;
      a.style.cssText = 'display:flex;align-items:center;gap:14px;padding:12px 8px;margin-bottom:4px;border-radius:0;color:' + (isActive ? 'var(--life)' : 'var(--ink-faint)') + ';font-size:13px;letter-spacing:0.02em;transition:color 0.3s,padding 0.3s;text-decoration:none;border-left:2px solid ' + (isActive ? 'var(--life)' : 'transparent') + '';
      a.innerHTML = buildIcon(tab.svg, isActive) + '<span class="sa-sidebar-label" data-i18n="' + tab.key + '">' + t(tab.key) + '</span>';
      a.addEventListener('mouseenter', function () { if (!isActive) this.style.color = 'var(--ink)'; });
      a.addEventListener('mouseleave', function () { if (!isActive) this.style.color = 'var(--ink-faint)'; });
      aside.appendChild(a);
    });
    document.body.appendChild(aside);
    document.body.classList.add('sa-has-sidebar');
  }

  function init() {
    var m = document.querySelector('meta[name="sa-tab"]');
    var active = m ? m.content : '';
    renderBottom(active);
    renderSide(active);
    document.addEventListener('sa:lang', function () {
      // i18n.js applyAll handles data-i18n nodes, no extra work needed
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
