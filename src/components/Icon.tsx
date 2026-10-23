const PATHS = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6L6 18',
  body: 'M12 2.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM7 9l5-1 5 1M12 8v6m0 0l-3 6m3-6l3 6M7 9l-1 5m11-5l1 5',
  calendar: 'M4 6h16v14H4zM4 10h16M9 3v4m6-4v4',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 3m8-3h3a3 3 0 0 1-3 3m-4 4v4m-4 3h8',
  plus: 'M12 5v14M5 12h14',
  chevron: 'M9 6l6 6-6 6',
  chevronLeft: 'M15 6l-6 6 6 6',
  trash: 'M5 7h14M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
  sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  flip: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14',
  timer: 'M12 9v4l2.5 2M9.5 2.5h5M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  stop: 'M8 8h8v8H8z',
  pulse: 'M3 12h4l2-5 4 10 2-5h6',
  ball: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4.5l3 2.2-1.1 3.5h-3.8L9 9.7zM12 7.5V3.5m3 6.2l4-1.3m-5.1 4.8l2.5 3.4m-6.3-3.4l-2.5 3.4M9 9.7L5 8.4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
