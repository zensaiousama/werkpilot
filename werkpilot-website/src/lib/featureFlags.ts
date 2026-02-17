// Feature flags system for gradual rollouts

interface FeatureFlags {
  enableChatWidget: boolean;
  enableSocialProof: boolean;
  enableExitIntent: boolean;
  enableLeadMagnet: boolean;
  enableBottomSheet: boolean;
  enableParticles: boolean;
  enableCursorGlow: boolean;
  enableAnimatedBackground: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  enableChatWidget: true,
  enableSocialProof: true,
  enableExitIntent: true,
  enableLeadMagnet: true,
  enableBottomSheet: true,
  enableParticles: true,
  enableCursorGlow: true,
  enableAnimatedBackground: false, // Disabled by default - resource intensive
};

const FLAG_KEY = 'wp-feature-flags';

export function getFeatureFlags(): FeatureFlags {
  if (typeof window === 'undefined') return DEFAULT_FLAGS;

  try {
    const stored = localStorage.getItem(FLAG_KEY);
    if (stored) {
      return { ...DEFAULT_FLAGS, ...JSON.parse(stored) };
    }
  } catch {}

  return DEFAULT_FLAGS;
}

export function setFeatureFlag<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]): void {
  const flags = getFeatureFlags();
  flags[key] = value;
  try {
    localStorage.setItem(FLAG_KEY, JSON.stringify(flags));
  } catch {}
}

export function isFeatureEnabled(key: keyof FeatureFlags): boolean {
  return getFeatureFlags()[key];
}
