import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Every icon in the design, on a 24×24 grid, with the original path data.
 *
 * Icons are either `fill` (solid) or `stroke` (outline); the tab bar swaps
 * between a solid and an outline variant of the same glyph to mark the active
 * tab, so both are kept.
 */

type Draw = (color: string, sw: number) => React.ReactNode;

const S = {
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const SPARKLE_D =
  'M12 2.4l1.5 4.4a5 5 0 003.2 3.2l4.4 1.5-4.4 1.5a5 5 0 00-3.2 3.2L12 20.6l-1.5-4.4a5 5 0 00-3.2-3.2L2.9 11.5l4.4-1.5a5 5 0 003.2-3.2L12 2.4z';

const fill = (draw: (c: string) => React.ReactNode): Draw => (c) => draw(c);

const ICONS: Record<string, { draw: Draw; sw?: number }> = {
  /* ── brand & assistant ─────────────────────────────────────────── */
  sparkle: { draw: fill((c) => <Path d={SPARKLE_D} fill={c} />) },

  grid: {
    draw: fill((c) => (
      <>
        <Rect x={3} y={3} width={8} height={8} rx={1.4} fill={c} />
        <Rect x={13} y={3} width={8} height={8} rx={1.4} fill={c} />
        <Rect x={3} y={13} width={8} height={8} rx={1.4} fill={c} />
        <Rect x={13} y={13} width={8} height={8} rx={1.4} fill={c} />
      </>
    )),
  },

  mic: {
    sw: 1.9,
    draw: (c, sw) => (
      <>
        <Rect
          x={9}
          y={3}
          width={6}
          height={10}
          rx={3}
          fill="none"
          stroke={c}
          strokeWidth={sw}
        />
        <Path
          d="M6 11.5a6 6 0 0012 0M12 17.5V21"
          fill="none"
          stroke={c}
          strokeWidth={sw}
          {...S}
        />
      </>
    ),
  },

  send: {
    draw: fill((c) => <Path d="M3.6 11.2l16-7.4-7.4 16-2-6.4-6.6-2.2z" fill={c} />),
  },

  /* ── generic ───────────────────────────────────────────────────── */
  check: {
    sw: 2.4,
    draw: (c, sw) => (
      <Path d="M4 12.5l5 5L20 6.5" fill="none" stroke={c} strokeWidth={sw} {...S} />
    ),
  },

  clock: {
    sw: 1.9,
    draw: (c, sw) => (
      <>
        <Circle cx={12} cy={12} r={8.5} fill="none" stroke={c} strokeWidth={sw} />
        <Path d="M12 7.5V12l3.2 2" fill="none" stroke={c} strokeWidth={sw} {...S} />
      </>
    ),
  },

  arrowRight: {
    sw: 2,
    draw: (c, sw) => (
      <Path
        d="M4 12h15M13.5 6.5L20 12l-6.5 5.5"
        fill="none"
        stroke={c}
        strokeWidth={sw}
        {...S}
      />
    ),
  },

  chevronRight: {
    sw: 2,
    draw: (c, sw) => (
      <Path d="M9.5 5.5L16 12l-6.5 6.5" fill="none" stroke={c} strokeWidth={sw} {...S} />
    ),
  },

  close: {
    sw: 2.1,
    draw: (c, sw) => (
      <Path d="M6 6l12 12M18 6L6 18" fill="none" stroke={c} strokeWidth={sw} {...S} />
    ),
  },

  plus: {
    sw: 2.4,
    draw: (c, sw) => (
      <Path d="M12 6v12M6 12h12" fill="none" stroke={c} strokeWidth={sw} {...S} />
    ),
  },

  dotsVertical: {
    draw: fill((c) => (
      <>
        <Circle cx={12} cy={5.5} r={1.7} fill={c} />
        <Circle cx={12} cy={12} r={1.7} fill={c} />
        <Circle cx={12} cy={18.5} r={1.7} fill={c} />
      </>
    )),
  },

  doc: {
    sw: 1.8,
    draw: (c, sw) => (
      <>
        <Path
          d="M6.5 3.5h7L18 8v12.5H6.5z"
          fill="none"
          stroke={c}
          strokeWidth={sw}
          {...S}
        />
        <Path d="M13 3.5V8.5H18" fill="none" stroke={c} strokeWidth={sw} {...S} />
      </>
    ),
  },

  /* ── home tiles ────────────────────────────────────────────────── */
  calendar: {
    sw: 1.9,
    draw: (c, sw) => (
      <>
        <Rect
          x={3.5}
          y={5}
          width={17}
          height={15}
          rx={3}
          fill="none"
          stroke={c}
          strokeWidth={sw}
        />
        <Path
          d="M3.5 9.5h17M8 3.5V6M16 3.5V6"
          fill="none"
          stroke={c}
          strokeWidth={sw}
          {...S}
        />
      </>
    ),
  },

  listCheck: {
    sw: 1.9,
    draw: (c, sw) => (
      <Path
        d="M4 7.5l2 2 3.5-3.5M4 16.5l2 2 3.5-3.5M13 8h7M13 17h7"
        fill="none"
        stroke={c}
        strokeWidth={sw}
        {...S}
      />
    ),
  },

  alertCircle: {
    sw: 2,
    draw: (c, sw) => (
      <>
        <Path d="M12 7.5v6M12 17v.1" fill="none" stroke={c} strokeWidth={sw} {...S} />
        <Circle cx={12} cy={12} r={8.5} fill="none" stroke={c} strokeWidth={sw} />
      </>
    ),
  },

  mail: {
    sw: 1.9,
    draw: (c, sw) => (
      <>
        <Rect
          x={3}
          y={5.5}
          width={18}
          height={13}
          rx={3}
          fill="none"
          stroke={c}
          strokeWidth={sw}
        />
        <Path d="M3.6 7.2l8.4 6 8.4-6" fill="none" stroke={c} strokeWidth={sw} {...S} />
      </>
    ),
  },

  warnTriangle: {
    sw: 2,
    draw: (c, sw) => (
      <>
        <Path d="M12 4l8.5 15h-17L12 4z" fill="none" stroke={c} strokeWidth={sw} {...S} />
        <Path d="M12 9.5v4M12 16.4v.1" fill="none" stroke={c} strokeWidth={sw} {...S} />
      </>
    ),
  },

  /* ── profile preferences ───────────────────────────────────────── */
  bell: {
    sw: 1.9,
    draw: (c, sw) => (
      <>
        <Path
          d="M6 10a6 6 0 1112 0c0 4 1.4 5.5 1.4 5.5H4.6S6 14 6 10z"
          fill="none"
          stroke={c}
          strokeWidth={sw}
          {...S}
        />
        <Path d="M10 19a2 2 0 004 0" fill="none" stroke={c} strokeWidth={sw} {...S} />
      </>
    ),
  },

  moon: {
    sw: 1.9,
    draw: (c, sw) => (
      <Path
        d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"
        fill="none"
        stroke={c}
        strokeWidth={sw}
        {...S}
      />
    ),
  },

  shield: {
    sw: 1.9,
    draw: (c, sw) => (
      <Path
        d="M12 3.5l7 3v5.2c0 4.3-2.9 7.6-7 8.8-4.1-1.2-7-4.5-7-8.8V6.5l7-3z"
        fill="none"
        stroke={c}
        strokeWidth={sw}
        {...S}
      />
    ),
  },

  logout: {
    sw: 2,
    draw: (c, sw) => (
      <Path
        d="M14 5.5H7.5A2 2 0 005.5 7.5v9a2 2 0 002 2H14M12 12h8M17 9l3 3-3 3"
        fill="none"
        stroke={c}
        strokeWidth={sw}
        {...S}
      />
    ),
  },

  /* ── tab bar: solid (active) ───────────────────────────────────── */
  homeFill: {
    draw: fill((c) => (
      <Path
        d="M11.3 3.3a1 1 0 011.4 0l7 6.2a1 1 0 01.3.8V19a1.5 1.5 0 01-1.5 1.5H15V15a1 1 0 00-1-1h-4a1 1 0 00-1 1v5.5H5.5A1.5 1.5 0 014 19v-8.7a1 1 0 01.3-.8l7-6.2z"
        fill={c}
      />
    )),
  },

  calendarFill: {
    draw: fill((c) => (
      <Path
        d="M7 2.5a1 1 0 011 1V5h8V3.5a1 1 0 112 0V5h.5A2.5 2.5 0 0121 7.5v10A2.5 2.5 0 0118.5 20h-13A2.5 2.5 0 013 17.5v-10A2.5 2.5 0 015.5 5H6V3.5a1 1 0 011-1zM5 10v7.5a.5.5 0 00.5.5h13a.5.5 0 00.5-.5V10H5z"
        fill={c}
      />
    )),
  },

  chatFill: {
    draw: fill((c) => (
      <Path
        d="M6.5 4h11A2.5 2.5 0 0120 6.5v7a2.5 2.5 0 01-2.5 2.5H9.4l-4.1 3.7A.8.8 0 014 19.1V6.5A2.5 2.5 0 016.5 4z"
        fill={c}
      />
    )),
  },

  taskFill: {
    draw: fill((c) => (
      <Path
        d="M12 3a9 9 0 110 18 9 9 0 010-18zm4.2 6.1a1 1 0 00-1.5-1.3l-3.9 4.1-1.6-1.6a1 1 0 10-1.4 1.4l2.3 2.4a1 1 0 001.5 0l4.6-5z"
        fill={c}
      />
    )),
  },

  profileFill: {
    draw: fill((c) => (
      <>
        <Circle cx={12} cy={8} r={4} fill={c} />
        <Path
          d="M4.5 20c0-3.7 3.4-5.8 7.5-5.8s7.5 2.1 7.5 5.8a.7.7 0 01-.7.7H5.2a.7.7 0 01-.7-.7z"
          fill={c}
        />
      </>
    )),
  },

  /* ── tab bar: outline (inactive) ───────────────────────────────── */
  homeOutline: {
    sw: 1.8,
    draw: (c, sw) => (
      <Path
        d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-8.5z"
        fill="none"
        stroke={c}
        strokeWidth={sw}
        {...S}
      />
    ),
  },

  chatOutline: {
    sw: 1.8,
    draw: (c, sw) => (
      <Path
        d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7a2.5 2.5 0 01-2.5 2.5H9L4 20V6.5z"
        fill="none"
        stroke={c}
        strokeWidth={sw}
        {...S}
      />
    ),
  },

  taskOutline: {
    sw: 1.8,
    draw: (c, sw) => (
      <>
        <Circle cx={12} cy={12} r={8.5} fill="none" stroke={c} strokeWidth={sw} />
        <Path
          d="M8.2 12.2l2.6 2.6 5-5.2"
          fill="none"
          stroke={c}
          strokeWidth={sw}
          {...S}
        />
      </>
    ),
  },

  profileOutline: {
    sw: 1.8,
    draw: (c, sw) => (
      <>
        <Circle cx={12} cy={8.5} r={3.6} fill="none" stroke={c} strokeWidth={sw} />
        <Path
          d="M5 20c0-3.5 3.1-5.4 7-5.4s7 1.9 7 5.4"
          fill="none"
          stroke={c}
          strokeWidth={sw}
          {...S}
        />
      </>
    ),
  },
};

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 24,
  color = '#000',
  strokeWidth,
}: {
  name: IconName;
  size?: number;
  color?: string;
  /** Overrides the icon's own stroke weight; ignored by solid icons. */
  strokeWidth?: number;
}) {
  const icon = ICONS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {icon.draw(color, strokeWidth ?? icon.sw ?? 2)}
    </Svg>
  );
}
