/**
 * Inline icon set.
 *
 * Emoji were doing the job of icons across the UI — they render in each
 * platform's own colour and style, ignore the surrounding text colour, and
 * sit inconsistently on the baseline, which is most of why the interface read
 * as unfinished. These are stroke icons on a 24px grid that inherit
 * `currentColor` and scale with their container.
 */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false'
}

/** All icons accept className; default size comes from the 1em box. */
const Svg = ({ className = 'h-4 w-4', children, ...rest }) => (
  <svg {...base} {...rest} className={className}>
    {children}
  </svg>
)

export const IconHome = (p) => (
  <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></Svg>
)
export const IconPlus = (p) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
)
export const IconClock = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
)
export const IconUsers = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 5.5a3.2 3.2 0 0 1 0 6.4M17.5 20a6.6 6.6 0 0 0-2-4.7" />
  </Svg>
)
export const IconAlert = (p) => (
  <Svg {...p}>
    <path d="M10.3 4.3 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4M12 17.2v.1" />
  </Svg>
)
export const IconSparkles = (p) => (
  <Svg {...p}>
    <path d="M12 3.5 13.4 8 18 9.4 13.4 10.8 12 15.3 10.6 10.8 6 9.4 10.6 8 12 3.5Z" />
    <path d="M18.5 15.5 19.2 17.6 21.3 18.3 19.2 19 18.5 21.1 17.8 19 15.7 18.3 17.8 17.6 18.5 15.5Z" />
  </Svg>
)
export const IconShield = (p) => (
  <Svg {...p}><path d="M12 3l7.5 3v6c0 4.4-3.1 7.8-7.5 9-4.4-1.2-7.5-4.6-7.5-9V6L12 3Z" /></Svg>
)
export const IconBell = (p) => (
  <Svg {...p}>
    <path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
    <path d="M13.7 20a2 2 0 0 1-3.4 0" />
  </Svg>
)
export const IconMenu = (p) => (
  <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>
)
export const IconPencil = (p) => (
  <Svg {...p}>
    <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="M14.5 6.5l3 3" />
  </Svg>
)
export const IconTrash = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13" />
    <path d="M10 11v5M14 11v5" />
  </Svg>
)
export const IconHourglass = (p) => (
  <Svg {...p}>
    <path d="M7 3h10M7 21h10" />
    <path d="M8 3c0 4 4 5.2 4 7.5S8 17 8 21M16 3c0 4-4 5.2-4 7.5s4 6.5 4 10.5" />
  </Svg>
)
export const IconSearch = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></Svg>
)
export const IconFilter = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M7 12h10M10 17h4" />
  </Svg>
)
export const IconCalendar = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
  </Svg>
)
export const IconLock = (p) => (
  <Svg {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </Svg>
)
export const IconCamera = (p) => (
  <Svg {...p}>
    <path d="M3.5 8.5h3l1.5-2.5h8L17.5 8.5h3v11h-17v-11Z" />
    <circle cx="12" cy="13.5" r="3.3" />
  </Svg>
)
export const IconCheck = (p) => (
  <Svg {...p}><path d="M5 12.5 10 17.5 19 7" /></Svg>
)
export const IconPrinter = (p) => (
  <Svg {...p}>
    <path d="M7 9V3.5h10V9" />
    <rect x="3.5" y="9" width="17" height="7.5" rx="2" />
    <path d="M7 14h10v6.5H7V14Z" />
  </Svg>
)
export const IconRefresh = (p) => (
  <Svg {...p}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4v4.5h-4.5" />
  </Svg>
)
export const IconCopy = (p) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
    <path d="M15.5 5.5h-9a2.5 2.5 0 0 0-2.5 2.5v9" />
  </Svg>
)
export const IconClose = (p) => (
  <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>
)
export const IconChart = (p) => (
  <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>
)
export const IconUser = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Svg>
)
export const IconEye = (p) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3.2" />
  </Svg>
)
export const IconEyeOff = (p) => (
  <Svg {...p}>
    <path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.3 4.1M6.4 7.6A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9.3 9.3 0 0 0 3.7-.75" />
    <path d="M9.8 9.9a3.2 3.2 0 0 0 4.4 4.4M3.5 3.5l17 17" />
  </Svg>
)
export const IconShieldCheck = (p) => (
  <Svg {...p}>
    <path d="M12 3l7.5 3v6c0 4.4-3.1 7.8-7.5 9-4.4-1.2-7.5-4.6-7.5-9V6L12 3Z" />
    <path d="M9 12.2 11.2 14.4 15.2 10.4" />
  </Svg>
)
export const IconBolt = (p) => (
  <Svg {...p}><path d="M13.5 2.5 4.5 13.5h6l-.5 8 9-11h-6l.5-8Z" /></Svg>
)
export const IconTarget = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </Svg>
)
export const IconFlame = (p) => (
  <Svg {...p}>
    <path d="M12 3s4.5 3.8 4.5 8a4.5 4.5 0 0 1-9 0c0-1.4.6-2.6 1.3-3.5.2 1.3 1 2 1.9 2 .9 0 1.3-.8 1.3-2 0-1.9-.5-3.3-.5-4.5Z" />
    <path d="M12 20.5a6.5 6.5 0 0 0 6.5-6.5" />
  </Svg>
)
export const IconSun = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
  </Svg>
)
export const IconMoon = (p) => (
  <Svg {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></Svg>
)
export const IconTrendUp = (p) => (
  <Svg {...p}><path d="M3 17l6.5-6.5 4 4L21 7" /><path d="M21 12.5V7h-5.5" /></Svg>
)
export const IconTrendDown = (p) => (
  <Svg {...p}><path d="M3 7l6.5 6.5 4-4L21 17" /><path d="M21 12.5V17h-4.5" /></Svg>
)
export const IconMail = (p) => (
  <Svg {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
    <path d="m3.8 7 7.3 5.4a1.5 1.5 0 0 0 1.8 0L20.2 7" />
  </Svg>
)
export const IconList = (p) => (
  <Svg {...p}>
    <path d="M9 6.5h11M9 12h11M9 17.5h11" />
    <path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />
  </Svg>
)
export const IconInbox = (p) => (
  <Svg {...p}>
    <path d="M3.5 13.5 6 5h12l2.5 8.5v5.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-5.5Z" />
    <path d="M3.5 13.5H9a3 3 0 0 0 6 0h5.5" />
  </Svg>
)
export const IconBriefcase = (p) => (
  <Svg {...p}>
    <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
    <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
    <path d="M3 12.5h18" />
  </Svg>
)
export const IconTimer = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 10v3.5l2.5 1.5M9.5 3h5" />
  </Svg>
)
