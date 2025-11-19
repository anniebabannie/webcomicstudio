// Theme system: type-safe tokens + registry

export type ThemeName = 'navy' | 'emerald' | 'brown' | 'stone';

export type ThemeTokens = {
  // Page chrome
  pageBg: string;
  text: string;
  link: string;
  linkHover: string;
  border: string;

  // Top nav
  navBg: string;
  navText: string;

  // Buttons
  buttonBg: string;
  buttonText: string;
};

export const THEMES: Record<ThemeName, ThemeTokens> = {
  // Navy theme based on current public site styles (dark gray + indigo accents)
  navy: {
    // Matches bg-gray-900
    pageBg: '#111827',
    // Matches text-gray-100
    text: '#f3f4f6',
    // Links similar to text-gray-300, hover to white
    link: '#d1d5db',
    linkHover: '#ffffff',
    // Matches border-gray-800/700 usage
    border: '#1f2937',

    // Header: bg-gray-950 + white text
    navBg: '#030712',
    navText: '#ffffff',

    // Buttons: indigo-600 on white text
    buttonBg: '#4f46e5',
    buttonText: '#ffffff',
  },
  // Emerald theme: dark emerald surfaces with emerald accents
  emerald: {
    // Deep, rich emerald background
    pageBg: '#022c22', // emerald-950
    // Slightly tinted light text
    text: '#ecfdf5',   // emerald-50
    // Soft mint links, hover to white
    link: '#a7f3d0',   // emerald-200
    linkHover: '#ffffff',
    // Dark emerald border
    border: '#064e3b', // emerald-700

    // Header: vertical gradient from emerald-700 to emerald-950
    navBg: 'linear-gradient(to bottom, #064e3b, #022c22)',
    navText: '#ffffff',

    // Buttons: emerald-600 with white text
    buttonBg: '#059669',
    buttonText: '#ffffff',
  },
  // Brown theme: dark brown surfaces with warm amber accents
  brown: {
    // Slightly lighter deep brown background
    pageBg: '#292524', // stone-800
    // Warm light text
    text: '#fffbeb',   // amber-50
    // Warm soft links, hover to white
    link: '#fde68a',   // amber-200
    linkHover: '#ffffff',
  // Lighter stone border for better contrast on lighter bg
  border: '#44403a', // stone-700

  // Header: lighter than before but still dark
  navBg: '#1c1917',  // stone-900
    navText: '#ffffff',

    // Buttons: amber-600 with white text
    buttonBg: '#d97706',
    buttonText: '#ffffff',
  },
  // Stone theme: neutral stone palette (Tailwind stone)
  stone: {
    // Dark stone background
    pageBg: '#1c1917', // stone-900
    // Light stone text
    text: '#f5f5f4',   // stone-100
    // Muted link, hover to white
    link: '#d6d3d1',   // stone-300
    linkHover: '#ffffff',
    // Subtle border
    border: '#292524', // stone-800

    // Header: near-black stone bar with white text
    navBg: '#0c0a09',  // stone-950
    navText: '#ffffff',

    // Buttons: stone-600 with white text
    buttonBg: '#57534e',
    buttonText: '#ffffff',
  },
};

export function resolveThemeName(raw?: string | null): ThemeName {
  // Map DB values to known themes; default to stone now
  if (raw === 'default' || !raw) return 'stone';
  // Back-compat: map old 'gray' name to 'stone', old 'green' to 'emerald'
  if (raw === 'gray' || raw === 'stone') return 'stone';
  if (raw === 'green' || raw === 'emerald') return 'emerald';
  if (raw === 'brown') return 'brown';
  if (raw === 'navy') return 'navy';
  // Fallback
  return 'stone';
}
