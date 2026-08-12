const MAX_REQUEST_CHARS = 8192;
const MAX_PLAINTEXT_BYTES = 4096;
const MBTI_TYPES = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
const ALLOWED_FIELDS = new Set(['name', 'gender', 'birthday', 'mbti', 'customTags']);
const statusPanel = document.querySelector('[data-status]');
const form = document.querySelector('[data-form]');
const fieldsRoot = document.querySelector('[data-fields]');
const resultPanel = document.querySelector('[data-result]');
const submitButton = document.querySelector('[data-submit]');
const feedback = document.querySelector('[data-feedback]');
let invitation;
let responseUrl = '';

initialize().catch(() => showError('无法读取邀请', '邀请内容可能已经损坏，请联系邀请你的人重新生成。'));

async function initialize() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const encoded = params.get('request') || '';
  history.replaceState(null, '', window.location.pathname + window.location.search);
  if (!encoded || encoded.length > MAX_REQUEST_CHARS) throw new Error('Invalid request');
  invitation = parseInvitation(encoded);
  if (new Date(invitation.exp).getTime() <= Date.now()) return showError('邀请已经过期', '请联系邀请你的人重新生成一次性链接。');
  if (!globalThis.crypto?.subtle) return showError('浏览器不支持安全填写', '请使用较新的系统浏览器打开这个链接。');
  renderForm(invitation);
  statusPanel.hidden = true;
  form.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFieldError();
  try {
    submitButton.disabled = true;
    submitButton.textContent = '正在生成加密回信…';
    const answers = collectAnswers(invitation);
    if (!Object.keys(answers).length) throw new Error('请至少填写一项内容');
    const payload = { v: 1, id: invitation.id, submittedAt: new Date().toISOString(), answers };
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) throw new Error('填写内容超过允许大小');
    const code = await encryptResponse(invitation, plaintext);
    const base = document.body.dataset.base || '/';
    const url = new URL(`${base}receive/`, window.location.origin);
    url.hash = `response=${code}`;
    responseUrl = url.toString();
    form.hidden = true;
    resultPanel.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (cause) {
    showFieldError(cause instanceof Error ? cause.message : '暂时无法生成回信');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = '完成并生成回信';
  }
});

document.querySelector('[data-share]').addEventListener('click', async () => {
  if (!responseUrl) return;
  if (navigator.share) {
    try {
      await navigator.share({ title: '我回答好了', text: '我回答好了。这封回信需要用“仍在”打开。', url: responseUrl });
      feedback.textContent = '请选择邀请你的人并发送。';
      return;
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
    }
  }
  await copyText(responseUrl);
  feedback.textContent = '回信链接已复制，请粘贴发送给邀请你的人。';
});

document.querySelector('[data-copy]').addEventListener('click', async () => {
  await copyText(responseUrl);
  feedback.textContent = '回信链接已复制，请发送给邀请你的人。';
});

function renderForm(request) {
  const sections = [];
  if (request.f.includes('name')) sections.push(section('姓名', '填写你平时最常使用的名字。', '<input class="text-input" name="name" maxlength="40" autocomplete="name" placeholder="姓名" />'));
  if (request.f.includes('gender')) sections.push(section('性别', '选择你认同的选项，也可以留空。', optionGrid('gender', [['female', '女'], ['male', '男'], ['other', '其他']])));
  if (request.f.includes('birthday')) sections.push(section('生日', '年份、月份和日期需要一起填写。', '<div class="birthday-grid"><select class="select-input" name="calendar"><option value="solar">公历</option><option value="lunar">农历</option></select><input class="number-input" name="year" type="number" inputmode="numeric" min="1900" max="2200" placeholder="年" /><input class="number-input" name="month" type="number" inputmode="numeric" min="1" max="12" placeholder="月" /><input class="number-input" name="day" type="number" inputmode="numeric" min="1" max="31" placeholder="日" /></div><label class="leap-row" data-leap-row hidden><input name="isLeapMonth" type="checkbox" />这是农历闰月</label>'));
  if (request.f.includes('mbti')) sections.push(section('MBTI', '从标准类型中选择，也可以留空。', `<select class="select-input" name="mbti"><option value="">暂不填写</option>${MBTI_TYPES.map((value) => `<option value="${value}">${value}</option>`).join('')}</select>`));
  if (request.f.includes('customTags') && request.tags.length) sections.push(section('关于你的描述', '这些选项由邀请你的人准备，请选择你觉得合适的。', renderTags(request.tags)));
  fieldsRoot.innerHTML = sections.join('');
  const calendar = form.elements.calendar;
  if (calendar) calendar.addEventListener('change', () => { document.querySelector('[data-leap-row]').hidden = calendar.value !== 'lunar'; });
}

function section(label, hint, content) { return `<section class="form-section"><label class="form-label">${escapeHtml(label)}</label><p class="form-hint">${escapeHtml(hint)}</p>${content}</section>`; }
function optionGrid(name, options) { return `<div class="option-grid">${options.map(([value, label]) => `<label class="option-chip"><input type="radio" name="${name}" value="${value}" /><span>${label}</span></label>`).join('')}</div>`; }

function renderTags(tags) {
  const groups = new Map();
  for (const tag of tags) {
    const key = tag.group || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tag);
  }
  return [...groups.entries()].map(([group, options]) => {
    const type = group ? 'radio' : 'checkbox';
    const name = group ? `tag-${encodeURIComponent(group)}` : 'customTags';
    return `<div class="tag-group"><span class="tag-group-title">${escapeHtml(group || '可多选')}</span><div class="tag-options">${options.map((option) => `<label class="tag-option"><input type="${type}" name="${name}" value="${option.id}" data-custom-tag /><span>${escapeHtml(option.label)}</span></label>`).join('')}</div></div>`;
  }).join('');
}

function collectAnswers(request) {
  const data = new FormData(form);
  const answers = {};
  if (request.f.includes('name')) {
    const name = String(data.get('name') || '').trim();
    if (name) answers.name = name;
  }
  if (request.f.includes('gender')) {
    const gender = data.get('gender');
    if (gender === 'female' || gender === 'male' || gender === 'other') answers.gender = gender;
  }
  if (request.f.includes('birthday')) {
    const raw = [data.get('year'), data.get('month'), data.get('day')].map((value) => String(value || '').trim());
    if (raw.some(Boolean) && !raw.every(Boolean)) throw new Error('请完整填写生日的年、月、日');
    if (raw.every(Boolean)) {
      const calendar = data.get('calendar') === 'lunar' ? 'lunar' : 'solar';
      const [year, month, day] = raw.map(Number);
      validateBirthday(calendar, year, month, day);
      answers.birthday = { calendar, year, month, day, isLeapMonth: calendar === 'lunar' && Boolean(data.get('isLeapMonth')) };
    }
  }
  if (request.f.includes('mbti')) {
    const mbti = String(data.get('mbti') || '');
    if (mbti) answers.mbti = mbti;
  }
  if (request.f.includes('customTags')) {
    const selected = [...form.querySelectorAll('[data-custom-tag]:checked')].map((element) => element.value);
    if (selected.length) answers.customTags = selected;
  }
  return answers;
}

async function encryptResponse(request, plaintext) {
  const requesterPublicKey = await crypto.subtle.importKey('raw', asArrayBuffer(decodeBase64Url(request.pk)), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: requesterPublicKey }, ephemeral.privateKey, 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const info = aad(request.id);
  const material = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  const aesKey = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: info, tagLength: 128 }, aesKey, plaintext);
  const publicKey = await crypto.subtle.exportKey('raw', ephemeral.publicKey);
  const envelope = { v: 1, id: request.id, epk: encodeBase64Url(new Uint8Array(publicKey)), salt: encodeBase64Url(salt), iv: encodeBase64Url(iv), data: encodeBase64Url(new Uint8Array(ciphertext)) };
  const code = `sa1.${encodeBase64Url(new TextEncoder().encode(JSON.stringify(envelope)))}`;
  if (code.length > 8192) throw new Error('回信内容超过允许大小');
  return code;
}

function parseInvitation(encoded) {
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decodeBase64Url(encoded)));
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'exp,f,id,pk,tags,v' || value.v !== 1 || !validRequestId(value.id) || !validIsoDate(value.exp) || typeof value.pk !== 'string' || !Array.isArray(value.f) || !value.f.length || value.f.some((field) => !ALLOWED_FIELDS.has(field)) || new Set(value.f).size !== value.f.length || !Array.isArray(value.tags) || value.tags.length > 100) throw new Error('Invalid request');
  const publicKey = decodeBase64Url(value.pk);
  if (publicKey.byteLength !== 65 || publicKey[0] !== 4) throw new Error('Invalid public key');
  for (const tag of value.tags) if (!isRecord(tag) || Object.keys(tag).sort().join(',') !== 'group,id,label' || !/^[A-Za-z0-9_-]{8,64}$/.test(tag.id) || typeof tag.label !== 'string' || !tag.label.trim() || tag.label.length > 24 || (tag.group !== null && (typeof tag.group !== 'string' || !tag.group.trim() || tag.group.length > 24))) throw new Error('Invalid tags');
  return value;
}

function validateBirthday(calendar, year, month, day) {
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 1900 || year > currentYear || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > (calendar === 'lunar' ? 30 : 31)) throw new Error('生日日期无效');
  if (calendar === 'solar') {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('公历生日无效');
  }
}

function showError(title, message) { statusPanel.classList.add('is-error'); statusPanel.querySelector('strong').textContent = title; statusPanel.querySelector('p').textContent = message; }
function showFieldError(message) { let node = form.querySelector('[data-field-error]'); if (!node) { node = document.createElement('p'); node.className = 'field-error'; node.dataset.fieldError = ''; form.insertBefore(node, submitButton); } node.textContent = message; }
function clearFieldError() { form.querySelector('[data-field-error]')?.remove(); }
async function copyText(value) { if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value); const area = document.createElement('textarea'); area.value = value; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); }
function aad(requestId) { return new TextEncoder().encode(`stillalive-profile-response:v1:${requestId}`); }
function asArrayBuffer(bytes) { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); }
function encodeBase64Url(bytes) { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''); }
function decodeBase64Url(value) { if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid encoding'); const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)); return Uint8Array.from(binary, (character) => character.charCodeAt(0)); }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function validRequestId(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function validIsoDate(value) { return typeof value === 'string' && value.length >= 20 && value.length <= 40 && !Number.isNaN(Date.parse(value)); }
