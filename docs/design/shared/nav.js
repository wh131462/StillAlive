(function () {
  var tabs = [
    { name: '主页', id: 'home', href: '../home/index.html',
      svg: '<path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10"/>' },
    { name: '打卡', id: 'checkin', href: '../checkin/index.html',
      svg: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/>' },
    { name: '人物', id: 'person', href: '../person/list.html',
      svg: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>' },
    { name: '我的', id: 'profile', href: '../profile/index.html',
      svg: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6 19c1-3 3-4 6-4s5 1 6 4"/>' }
  ];

  function render(active) {
    var nav = document.createElement('nav');
    nav.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:50;display:flex;justify-content:space-around;align-items:center;height:72px;max-width:430px;margin:0 auto;background:var(--surface);border-top:1px solid var(--line);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);transition:background 0.6s,border-color 0.6s';
    tabs.forEach(function (t) {
      var a = document.createElement('a');
      a.href = t.href;
      var isActive = t.id === active;
      a.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;letter-spacing:0.02em;color:' + (isActive ? 'var(--life)' : 'var(--ink-faint)') + ';transition:color 0.3s';
      a.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (isActive ? '2.2' : '1.6') + '" stroke-linecap="round" stroke-linejoin="round">' + t.svg + '</svg><span>' + t.name + '</span>';
      nav.appendChild(a);
    });
    document.body.appendChild(nav);
  }

  function init() {
    var m = document.querySelector('meta[name="sa-tab"]');
    render(m ? m.content : '');
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
