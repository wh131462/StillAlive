import { requireOptionalNativeModule } from 'expo';

interface SystemFontsModule {
  getFontFamiliesAsync(): Promise<string[]>;
}

const systemFonts = requireOptionalNativeModule<SystemFontsModule>('StillAliveSystemFonts');

export async function getSystemFontFamilies(): Promise<string[]> {
  if (!systemFonts) return [];
  try {
    const families = await systemFonts.getFontFamiliesAsync();
    return [...new Set(families.map((name) => name.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}
