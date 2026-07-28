import { Stack } from 'expo-router';
import { PasswordVaultStateProvider } from '../../src/state/password-vault-state';

export default function PasswordVaultLayout() {
  return <PasswordVaultStateProvider><Stack screenOptions={{ headerShown: false }} /></PasswordVaultStateProvider>;
}
