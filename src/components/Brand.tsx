export const FLAME_PATH =
  'M12 2c1 3.6 5 6.1 5 11.2A5 5 0 0 1 7 13.4c0-2.6 1.3-4.4 2.6-5.6.2 1.9 1 3.1 2.3 3.6C11.2 8.6 11 5.2 12 2z';

export function Brand() {
  return (
    <span className="brand">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path d={FLAME_PATH} fill="var(--coral)" />
      </svg>
      ember
    </span>
  );
}
