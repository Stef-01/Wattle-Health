// Figma "Wattle" icon set (1.5 px stroke, round caps), drawn to match the frames in
// file NEbiukDE3TyWFptwaCBhwV. Keep every icon a 24-box; size with the `size` prop.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </Svg>
);
export const ArrowLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12H5" />
    <path d="m11 18-6-6 6-6" />
  </Svg>
);
export const ChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const Check = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12 5 5L19 7" />
  </Svg>
);
export const Home = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
  </Svg>
);
export const Clock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const Heart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10Z" />
  </Svg>
);
export const User = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
);
export const Mic = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </Svg>
);
export const MapPin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10Z" />
    <circle cx="12" cy="11" r="2.2" />
  </Svg>
);
export const Bookmark = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3h12v18l-6-4-6 4V3Z" />
  </Svg>
);
export const Video = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="7" width="13" height="10" rx="2" />
    <path d="m16 10 5-2.5v9L16 14" />
  </Svg>
);
export const File = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 3h7l5 5v13H7V3Z" />
    <path d="M14 3v5h5" />
  </Svg>
);
export const ExternalLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4 10 14" />
    <path d="M18 13v7H4V6h7" />
  </Svg>
);
export const Search = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.3-4.3" />
  </Svg>
);
export const Edit = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="m13.5 7.5 3 3" />
  </Svg>
);
export const Sliders = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Svg>
);
export const Shield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);
export const Book = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z" />
    <path d="M5 18a2 2 0 0 1 2-2h11" />
  </Svg>
);
export const Leaf = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 4c-8 0-14 5-14 12 0 1.5.3 3 1 4 1-6 5-10 11-12-4 3-7 7-8 12 7 0 11-5 11-12 0-1.4-.4-2.8-1-4Z" />
  </Svg>
);
export const Cloud = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 2 3 3 0 0 1 0 6H7Z" />
  </Svg>
);
export const Settings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.3 1a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.6a7 7 0 0 0-2 1.2l-2.3-1-2 3.5 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.5 2.3-1a7 7 0 0 0 2 1.2L10 21h4l.6-2.6a7 7 0 0 0 2-1.2l2.3 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2Z" />
  </Svg>
);
export const Close = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const Share = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v12" />
    <path d="m8 7 4-4 4 4" />
    <path d="M5 12v8h14v-8" />
  </Svg>
);
