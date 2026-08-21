import { Stack } from 'expo-router';
import { PasswordVaultStateProvider } from '../../src/features/vault/password-vault-state';

export default function PasswordVaultLayout() {
  return <PasswordVaultStateProvider><Stack screenOptions={{ headerShown: false }} /></PasswordVaultStateProvider>;
}
