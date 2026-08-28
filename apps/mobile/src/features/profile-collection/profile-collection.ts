import { strFromU8, strToU8 } from 'fflate';
import type { BirthdayCalendar, Gender, ProfileCollectionField, ProfileCollectionRequest } from '@still-alive/types';
import { MBTI_TYPES, validateBirthday } from '../people/person-profile';

export const PROFILE_COLLECTION_PROTOCOL_VERSION = 1;
export const PROFILE_COLLECTION_PORTAL_URL = 'https://still-alive.me';
export const PROFILE_COLLECTION_RESPONSE_PREFIX = 'sa1.';
export const PROFILE_COLLECTION_REQUEST_MAX_BYTES = 8 * 1024;
export const PROFILE_COLLECTION_RESPONSE_MAX_BYTES = 8 * 1024;
export const PROFILE_COLLECTION_PLAINTEXT_MAX_BYTES = 4 * 1024;
export const PROFILE_COLLECTION_INVITATION_DAYS = 7;

export interface ProfileCollectionTagOption {
  id: string;
  label: string;
  group: string | null;
}

export interface ProfileCollectionInvitationV1 {
  v: 1;
  id: string;
  exp: string;
  pk: string;
  f: ProfileCollectionField[];
  tags: ProfileCollectionTagOption[];
}

export interface ProfileCollectionBirthdayAnswer {
  calendar: BirthdayCalendar;
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
}

export interface ProfileCollectionAnswers {
  name?: string;
  nickname?: string;
  bio?: string;
  gender?: Gender;
  birthday?: ProfileCollectionBirthdayAnswer;
  mbti?: string;
  customTags?: string[];
  newCustomTags?: string[];
}

export interface ProfileCollectionResponsePayloadV1 {
  v: 1;
  id: string;
  submittedAt: string;
  answers: ProfileCollectionAnswers;
}

export interface ProfileCollectionResponseEnvelopeV1 {
  v: 1;
  id: string;
  epk: string;
  salt: string;
  iv: string;
  data: string;
}

export function encodeProfileCollectionInvitation(invitation: ProfileCollectionInvitationV1): string {
  validateInvitation(invitation);
  const encoded = encodeBase64Url(strToU8(JSON.stringify(invitation)));
  if (encoded.length > PROFILE_COLLECTION_REQUEST_MAX_BYTES) throw new Error('邀请内容过长');
  return encoded;
}

export function profileCollectionInvitationUrl(encodedInvitation: string): string {
  return `${PROFILE_COLLECTION_PORTAL_URL}/collect/#request=${encodedInvitation}`;
}

export function profileCollectionResponseUrl(responseCode: string): string {
  return `${PROFILE_COLLECTION_PORTAL_URL}/receive/#response=${responseCode}`;
}

export function profileCollectionDeepLink(responseCode: string): string {
  return `stillalive:///profile-collection/import?response=${encodeURIComponent(responseCode)}`;
}

export function encodeProfileCollectionResponseEnvelope(envelope: ProfileCollectionResponseEnvelopeV1): string {
  validateResponseEnvelope(envelope);
  const code = `${PROFILE_COLLECTION_RESPONSE_PREFIX}${encodeBase64Url(strToU8(JSON.stringify(envelope)))}`;
  if (code.length > PROFILE_COLLECTION_RESPONSE_MAX_BYTES) throw new Error('响应内容过长');
  return code;
}

export function decodeProfileCollectionResponseCode(responseCode: string): ProfileCollectionResponseEnvelopeV1 {
  const normalized = responseCode.trim();
  if (!normalized.startsWith(PROFILE_COLLECTION_RESPONSE_PREFIX) || normalized.length > PROFILE_COLLECTION_RESPONSE_MAX_BYTES) throw new Error('响应码格式无效');
  const raw = decodeBase64Url(normalized.slice(PROFILE_COLLECTION_RESPONSE_PREFIX.length), PROFILE_COLLECTION_RESPONSE_MAX_BYTES);
  let parsed: unknown;
  try { parsed = JSON.parse(strFromU8(raw)); } catch { throw new Error('响应码格式无效'); }
  validateResponseEnvelope(parsed);
  return parsed;
}

export function parseProfileCollectionResponseInput(input: string): string {
  const normalized = input.trim();
  if (normalized.startsWith(PROFILE_COLLECTION_RESPONSE_PREFIX)) {
    decodeProfileCollectionResponseCode(normalized);
    return normalized;
  }
  let url: URL;
  try { url = new URL(normalized); } catch { throw new Error('请粘贴有效的响应链接或响应码'); }
  if (url.protocol === 'stillalive:') {
    const response = url.searchParams.get('response');
    if (!response) throw new Error('App 链接中没有响应码');
    decodeProfileCollectionResponseCode(response);
    return response;
  }
  const portal = new URL(PROFILE_COLLECTION_PORTAL_URL);
  const expectedPath = `${portal.pathname.replace(/\/$/, '')}/receive/`;
  if (url.protocol !== 'https:' || url.origin !== portal.origin || normalizePath(url.pathname) !== normalizePath(expectedPath)) throw new Error('只支持来自“仍在”资料收集页面的链接');
  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  const response = params.get('response');
  if (!response) throw new Error('响应链接中没有加密资料');
  decodeProfileCollectionResponseCode(response);
  return response;
}

export function validateProfileCollectionPayload(payload: unknown, request: ProfileCollectionRequest): ProfileCollectionResponsePayloadV1 {
  if (!isRecord(payload) || !hasOnlyKeys(payload, ['v', 'id', 'submittedAt', 'answers']) || payload.v !== 1 || payload.id !== request.id || !validIsoDate(payload.submittedAt) || !isRecord(payload.answers)) throw new Error('填写结果格式无效');
  const answers = payload.answers;
  const allowedAnswerKeys = new Set(['name', 'nickname', 'bio', 'gender', 'birthday', 'mbti', 'customTags', 'newCustomTags']);
  if (Object.keys(answers).some((key) => !allowedAnswerKeys.has(key))) throw new Error('填写结果包含不支持的字段');
  const result: ProfileCollectionAnswers = {};
  if (answers.name !== undefined) {
    assertRequested(request, 'name');
    if (typeof answers.name !== 'string' || !answers.name.trim() || answers.name.trim().length > 40) throw new Error('姓名内容无效');
    result.name = answers.name.trim();
  }
  if (answers.nickname !== undefined) {
    assertRequested(request, 'nickname');
    if (typeof answers.nickname !== 'string' || answers.nickname.trim().length > 30) throw new Error('昵称内容无效');
    if (answers.nickname.trim()) result.nickname = answers.nickname.trim();
  }
  if (answers.bio !== undefined) {
    assertRequested(request, 'bio');
    if (typeof answers.bio !== 'string' || answers.bio.trim().length > 500) throw new Error('个人简介内容无效');
    if (answers.bio.trim()) result.bio = answers.bio.trim();
  }
  if (answers.gender !== undefined) {
    assertRequested(request, 'gender');
    if (answers.gender !== 'female' && answers.gender !== 'male' && answers.gender !== 'other') throw new Error('性别内容无效');
    result.gender = answers.gender;
  }
  if (answers.birthday !== undefined) {
    assertRequested(request, 'birthday');
    if (!isRecord(answers.birthday) || !hasOnlyKeys(answers.birthday, ['calendar', 'year', 'month', 'day', 'isLeapMonth'])) throw new Error('生日内容无效');
    const birthday = answers.birthday;
    if ((birthday.calendar !== 'solar' && birthday.calendar !== 'lunar') || typeof birthday.year !== 'number' || !Number.isInteger(birthday.year) || typeof birthday.month !== 'number' || !Number.isInteger(birthday.month) || typeof birthday.day !== 'number' || !Number.isInteger(birthday.day) || typeof birthday.isLeapMonth !== 'boolean') throw new Error('生日内容无效');
    validateBirthday({ calendar: birthday.calendar, year: birthday.year, month: birthday.month, day: birthday.day, isLeapMonth: birthday.isLeapMonth, reminderEnabled: true, reminderHour: null, reminderMinute: null, reminderMode: birthday.calendar });
    result.birthday = { calendar: birthday.calendar, year: birthday.year, month: birthday.month, day: birthday.day, isLeapMonth: birthday.isLeapMonth };
  }
  if (answers.mbti !== undefined) {
    assertRequested(request, 'mbti');
    if (typeof answers.mbti !== 'string' || !MBTI_TYPES.includes(answers.mbti as typeof MBTI_TYPES[number])) throw new Error('MBTI 内容无效');
    result.mbti = answers.mbti;
  }
  if (answers.customTags !== undefined) {
    assertRequested(request, 'customTags');
    if (!Array.isArray(answers.customTags) || !answers.customTags.length || answers.customTags.length > Object.keys(request.tagMap).length) throw new Error('标签内容无效');
    const ids = answers.customTags;
    if (ids.some((item) => typeof item !== 'string' || !request.tagMap[item]) || new Set(ids).size !== ids.length) throw new Error('标签内容无效');
    result.customTags = ids;
  }
  if (answers.newCustomTags !== undefined) {
    assertRequested(request, 'customTags');
    if (!Array.isArray(answers.newCustomTags) || !answers.newCustomTags.length || answers.newCustomTags.length > 20) throw new Error('新标签内容无效');
    const names = answers.newCustomTags.map((item) => typeof item === 'string' ? item.trim() : '');
    if (names.some((item) => !item || item.length > 24) || new Set(names.map((item) => item.toLocaleLowerCase())).size !== names.length) throw new Error('新标签内容无效');
    result.newCustomTags = names;
  }
  if (!Object.keys(result).length) throw new Error('填写结果中没有可导入的内容');
  return { v: 1, id: request.id, submittedAt: payload.submittedAt, answers: result };
}

export function encodeBase64Url(bytes: Uint8Array): string {
  return encodeBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function decodeBase64Url(value: string, maxBytes: number): Uint8Array {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('编码格式无效');
  const padding = (4 - value.length % 4) % 4;
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat(padding);
  const bytes = decodeBase64(base64, maxBytes);
  if (encodeBase64Url(bytes) !== value) throw new Error('编码格式无效');
  return bytes;
}

function validateInvitation(value: unknown): asserts value is ProfileCollectionInvitationV1 {
  if (!isRecord(value) || !hasOnlyKeys(value, ['v', 'id', 'exp', 'pk', 'f', 'tags']) || value.v !== 1 || !validRequestId(value.id) || !validIsoDate(value.exp) || typeof value.pk !== 'string' || !Array.isArray(value.f) || !value.f.length || value.f.length > 7 || !Array.isArray(value.tags) || value.tags.length > 100) throw new Error('邀请内容无效');
  const fields = value.f;
  if (fields.some((field) => !['name', 'nickname', 'bio', 'gender', 'birthday', 'mbti', 'customTags'].includes(field)) || new Set(fields).size !== fields.length) throw new Error('邀请字段无效');
  decodeBase64Url(value.pk, 65);
  if (decodeBase64Url(value.pk, 65).byteLength !== 65) throw new Error('邀请公钥无效');
  for (const option of value.tags) {
    if (!isRecord(option) || !hasOnlyKeys(option, ['id', 'label', 'group']) || typeof option.id !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(option.id) || typeof option.label !== 'string' || !option.label.trim() || option.label.length > 24 || (option.group !== null && (typeof option.group !== 'string' || !option.group.trim() || option.group.length > 24))) throw new Error('邀请标签无效');
  }
}

function validateResponseEnvelope(value: unknown): asserts value is ProfileCollectionResponseEnvelopeV1 {
  if (!isRecord(value) || !hasOnlyKeys(value, ['v', 'id', 'epk', 'salt', 'iv', 'data']) || value.v !== 1 || !validRequestId(value.id)) throw new Error('响应信封无效');
  if (typeof value.epk !== 'string' || decodeBase64Url(value.epk, 65).byteLength !== 65) throw new Error('响应公钥无效');
  if (typeof value.salt !== 'string' || decodeBase64Url(value.salt, 16).byteLength !== 16) throw new Error('响应参数无效');
  if (typeof value.iv !== 'string' || decodeBase64Url(value.iv, 12).byteLength !== 12) throw new Error('响应参数无效');
  if (typeof value.data !== 'string') throw new Error('响应密文无效');
  const ciphertext = decodeBase64Url(value.data, PROFILE_COLLECTION_PLAINTEXT_MAX_BYTES + 16);
  if (ciphertext.byteLength < 17) throw new Error('响应密文无效');
}

function assertRequested(request: ProfileCollectionRequest, field: ProfileCollectionField): void {
  if (!request.fields.includes(field)) throw new Error('填写结果包含未请求的字段');
}

function encodeBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const c = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const combined = (a << 16) | (b << 8) | c;
    result += alphabet[(combined >>> 18) & 63] + alphabet[(combined >>> 12) & 63] + (index + 1 < bytes.length ? alphabet[(combined >>> 6) & 63] : '=') + (index + 2 < bytes.length ? alphabet[combined & 63] : '=');
  }
  return result;
}

function decodeBase64(value: string, maxBytes: number): Uint8Array {
  if (!value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('编码格式无效');
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const byteLength = value.length / 4 * 3 - padding;
  if (byteLength > maxBytes) throw new Error('内容过长');
  const output = new Uint8Array(byteLength);
  let offset = 0;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let index = 0; index < value.length; index += 4) {
    const a = alphabet.indexOf(value[index]);
    const b = alphabet.indexOf(value[index + 1]);
    const c = value[index + 2] === '=' ? 0 : alphabet.indexOf(value[index + 2]);
    const d = value[index + 3] === '=' ? 0 : alphabet.indexOf(value[index + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error('编码格式无效');
    const combined = (a << 18) | (b << 12) | (c << 6) | d;
    if (offset < byteLength) output[offset++] = combined >>> 16 & 0xff;
    if (offset < byteLength) output[offset++] = combined >>> 8 & 0xff;
    if (offset < byteLength) output[offset++] = combined & 0xff;
  }
  return output;
}

function normalizePath(value: string): string { return value.endsWith('/') ? value : `${value}/`; }
function validRequestId(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function validIsoDate(value: unknown): value is string { return typeof value === 'string' && value.length >= 20 && value.length <= 40 && !Number.isNaN(Date.parse(value)); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean { const allowed = new Set(keys); return Object.keys(value).length === keys.length && Object.keys(value).every((key) => allowed.has(key)); }
