import type { ProfileCollectionResponseEnvelopeV1 } from './profile-collection';

export type ProfileCollectionCryptoCommand =
  | { id: number; type: 'generate-key-pair' }
  | { id: number; type: 'decrypt'; envelope: ProfileCollectionResponseEnvelopeV1; privateKeyJwk: string };

export type ProfileCollectionCryptoResult =
  | { id: number; ok: true; type: 'generate-key-pair'; publicKey: string; privateKeyJwk: string }
  | { id: number; ok: true; type: 'decrypt'; plaintext: string }
  | { id: number; ok: false; error: string };

