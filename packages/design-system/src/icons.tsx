import React from 'react';

/**
 * Иконки DS: stroke = var(--icon-stroke), капы/углы по дизайну (DESIGNS.md).
 * Тонкий набор (tree-shake не нужен — ~20 путей).
 */
export type IconName =
  | 'home' | 'flag' | 'card' | 'chart' | 'users' | 'settings' | 'live' | 'sun' | 'moon'
  | 'left' | 'right' | 'plus' | 'check' | 'wifi-off' | 'share' | 'download' | 'trophy'
  | 'clock' | 'alert' | 'edit' | 'x' | 'target' | 'star' | 'search' | 'qr' | 'bell';

const PATHS: Record<IconName, string> = {
  home: 'M3 11.5 12 3l9 8.5M5 10v10h14V10',
  flag: 'M5 21V4m0 1h12l-2.5 3.5L17 12H5',
  card: 'M4 5h16v14H4zM8 9h8M8 13h5',
  chart: 'M4 20V4m0 16h16M8 16v-5m4 5V8m4 8v-3',
  users: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6m2-6c2.8 0 5 2.2 5 5',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 3a8 8 0 0 1-.2 1.6l2 1.5-2 3.5-2.3-1a8 8 0 0 1-2.8 1.6L14 21h-4l-.6-2.4a8 8 0 0 1-2.8-1.6l-2.3 1-2-3.5 2-1.5A8 8 0 0 1 4 12a8 8 0 0 1 .2-1.6l-2-1.5 2-3.5 2.3 1a8 8 0 0 1 2.8-1.6L10 3h4l.6 2.4a8 8 0 0 1 2.8 1.6l2.3-1 2 3.5-2 1.5a8 8 0 0 1 .2 1.6Z',
  live: 'M12 2 4 14h6l-2 8 8-12h-6l2-8Z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  check: 'M4 12.5 9.5 18 20 6',
  'wifi-off': 'M2 8c5.5-4.5 14.5-4.5 20 0M5 12c4-3 10-3 14 0M8.5 16c2-1.5 5-1.5 7 0M12 20h.01M3 3l18 18',
  share: 'M12 3v12m0-12L7.5 7.5M12 3l4.5 4.5M5 12v8h14v-8',
  download: 'M12 3v12m0 0 4.5-4.5M12 15 7.5 10.5M5 20h14',
  trophy: 'M8 21h8m-4-4v4M6 3h12v5a6 6 0 0 1-12 0V3Zm-3 2h3m12 0h3M4 5c0 3 1.5 5 3 5m13-5c0 3-1.5 5-3 5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 3',
  alert: 'M12 3 2 21h20L12 3Zm0 7v5m0 3h.01',
  edit: 'M4 20h4L20 8l-4-4L4 16v4Zm10-14 4 4',
  x: 'M6 6l12 12M18 6 6 18',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-3h.01',
  star: 'm12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8L12 3Z',
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM21 21l-4.8-4.8',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM20 14v.01M14 20h3m3 0h.01m0-3h.01',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 3H4l2-3Zm4 5h4',
};

export function Icon({ name, size = 24, title }: { name: IconName; size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="var(--icon-stroke, 2)" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} aria-label={title}>
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
