const videos = {
  music: { file: '音乐播放.mp4', title: '音乐播放' },
  resident: { file: '前台常驻.mp4', title: '前台常驻' },
};

const base = document.documentElement.dataset.base || '/';
const params = new URLSearchParams(window.location.search);
const key = params.get('video') || params.get('type');
const selected = videos[key];
const player = document.querySelector('[data-video-player]');

if (selected && player instanceof HTMLVideoElement) {
  player.src = `${base}assets/google-check/${encodeURIComponent(selected.file)}`;
  player.setAttribute('aria-label', `${selected.title}视频`);
  document.title = `${selected.title} — 仍在`;
}
