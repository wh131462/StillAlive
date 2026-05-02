(function () {
  var K = 'sa-theme';
  function apply(dark) {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(K, dark ? 'dark' : 'light');
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
  function init() {
    var s = localStorage.getItem(K);
    apply(s ? s === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches);
    document.addEventListener('click', function (e) {
      var t = e.target.closest('#theme-toggle');
      if (t) apply(!document.documentElement.classList.contains('dark'));
    });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
