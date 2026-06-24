import { safeHttpUrl } from './safe-url';

export interface LogoConfig {
  logoUrl: string;
  logoUrlLight?: string;
  logoUrlDark?: string;
  logoUrlCyberpunk?: string;
}

export function getActiveLogoUrl(config: LogoConfig, theme: 'dark' | 'light' | 'cyberpunk'): string {
  const rawLogoUrl = theme === 'light'
    ? config.logoUrlLight || config.logoUrl
    : theme === 'cyberpunk'
    ? config.logoUrlCyberpunk || config.logoUrl
    : config.logoUrlDark || config.logoUrl;

  return safeHttpUrl(rawLogoUrl);
}
