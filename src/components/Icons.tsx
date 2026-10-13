const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const IconBack = () => (<svg {...base}><path d="M15 5l-7 7 7 7" /></svg>);
export const IconForward = () => (<svg {...base}><path d="M9 5l7 7-7 7" /></svg>);
export const IconDownload = () => (<svg {...base}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>);
export const IconMin = () => (<svg {...base} width={14} height={14}><path d="M5 12h14" /></svg>);
export const IconMax = () => (<svg {...base} width={13} height={13}><rect x="5" y="5" width="14" height="14" rx="2" /></svg>);
export const IconClose = () => (<svg {...base} width={14} height={14}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconChevron = () => (<svg {...base} width={14} height={14}><path d="M6 9l6 6 6-6" /></svg>);
export const IconPlus = () => (<svg {...base} width={28} height={28}><path d="M12 5v14M5 12h14" /></svg>);
export const IconCheck = () => (<svg {...base} width={11} height={11} strokeWidth={3.2}><path d="M5 13l4 4 10-10" /></svg>);
export const IconArrowDown = () => (<svg {...base} width={11} height={11} strokeWidth={3.2}><path d="M12 5v13M6 13l6 6 6-6" /></svg>);
export const IconStar = ({ filled }: { filled?: boolean }) => (<svg {...base} width={16} height={16} fill={filled ? 'currentColor' : 'none'}><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" /></svg>);
export const IconPause = () => (<svg {...base} width={15} height={15}><path d="M8 5v14M16 5v14" /></svg>);
export const IconPlay = () => (<svg {...base} width={15} height={15} fill="currentColor"><path d="M8 5l11 7-11 7z" /></svg>);
export const IconX = () => (<svg {...base} width={15} height={15}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconSearch = () => (<svg {...base} width={15} height={15}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>);
