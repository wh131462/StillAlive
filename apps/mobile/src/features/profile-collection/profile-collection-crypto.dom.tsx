'use dom';

import { useEffect } from 'react';
import type { DOMProps } from 'expo/dom';
import type { ProfileCollectionCryptoCommand, ProfileCollectionCryptoResult } from './profile-collection-crypto.types';

interface ProfileCollectionCryptoProps {
  command: ProfileCollectionCryptoCommand | null;
  onResult(result: ProfileCollectionCryptoResult): void;
  dom?: DOMProps;
}

export default function ProfileCollectionCrypto({ command, onResult }: ProfileCollectionCryptoProps) {
  useEffect(() => {
    if (!command) return;
    void execute(command).then(onResult, () => onResult({ id: command.id, ok: false, error: '本机加密组件执行失败' }));
  }, [command, onResult]);
  return <span aria-hidden="true" hidden />;
}

async function execute(command: ProfileCollectionCryptoCommand): Promise<ProfileCollectionCryptoResult> {
  try {
    if (!globalThis.crypto?.subtle) throw new Error('当前设备不支持所需的加密能力');
    if (command.type === 'generate-key-pair') {
      const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
      const publicKey = encodeBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
      const privateKeyJwk = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey));
      return { id: command.id, ok: true, type: command.type, publicKey, privateKeyJwk };
    }
    const privateJwk = parsePrivateJwk(command.privateKeyJwk);
    const privateKey = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const publicKey = await crypto.subtle.importKey('raw', asArrayBuffer(decodeBase64Url(command.envelope.epk)), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
    const aesKey = await deriveAesKey(shared, decodeBase64Url(command.envelope.salt), command.envelope.id, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asArrayBuffer(decodeBase64Url(command.envelope.iv)), additionalData: asArrayBuffer(aad(command.envelope.id)), tagLength: 128 },
      aesKey,
      asArrayBuffer(decodeBase64Url(command.envelope.data)),
    );
    return { id: command.id, ok: true, type: command.type, plaintext: new TextDecoder('utf-8', { fatal: true }).decode(plaintext) };
  } catch {
    return { id: command.id, ok: false, error: command.type === 'generate-key-pair' ? '无法生成加密邀请' : '无法验证或解密这份资料' };
  }
}

async function deriveAesKey(shared: ArrayBuffer, salt: Uint8Array, requestId: string, usages: KeyUsage[]): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: asArrayBuffer(salt), info: asArrayBuffer(aad(requestId)) },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
}

function parsePrivateJwk(value: string): JsonWebKey {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid private key');
  const key = parsed as JsonWebKey;
  if (key.kty !== 'EC' || key.crv !== 'P-256' || typeof key.d !== 'string' || typeof key.x !== 'string' || typeof key.y !== 'string') throw new Error('Invalid private key');
  return key;
}

function aad(requestId: string): Uint8Array { return new TextEncoder().encode(`stillalive-profile-response:v1:${requestId}`); }

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url');
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
