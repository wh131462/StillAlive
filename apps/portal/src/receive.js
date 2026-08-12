const statusPanel = document.querySelector('[data-status]');
const actions = document.querySelector('[data-actions]');
const feedback = document.querySelector('[data-feedback]');
let responseCode = '';
let responseLink = window.location.href;

initialize();

function initialize() {
  try {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    responseCode = params.get('response') || '';
    if (!/^sa1\.[A-Za-z0-9_-]+$/.test(responseCode) || responseCode.length > 8192) throw new Error('Invalid response');
    history.replaceState(null, '', window.location.pathname + window.location.search);
    statusPanel.hidden = true;
    actions.hidden = false;
  } catch {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    statusPanel.classList.add('is-error');
    statusPanel.querySelector('strong').textContent = '回信链接不完整';
    statusPanel.querySelector('p').textContent = '请让对方重新发送填写完成后生成的完整链接。';
  }
}

document.querySelector('[data-open]').addEventListener('click', () => {
  window.location.href = `stillalive:///profile-collection/import?response=${encodeURIComponent(responseCode)}`;
});
document.querySelector('[data-copy-link]').addEventListener('click', async () => { await copyText(responseLink); feedback.textContent = '回信链接已复制，可以粘贴到“仍在”中查看。'; });
document.querySelector('[data-copy-code]').addEventListener('click', async () => { await copyText(responseCode); feedback.textContent = '备用码已复制，可以粘贴到“仍在”中查看。'; });

async function copyText(value) { if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value); const area = document.createElement('textarea'); area.value = value; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); }
