import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { api } from './api';
import type { AppState, Page } from './types';

export type Modal =
  | { type: 'add' }
  | { type: 'import' }
  | { type: 'prompt'; title: string; value: string; placeholder?: string; okLabel: string; onOk: (v: string) => void }
  | { type: 'confirm'; title: string; text: string; okLabel: string; danger?: boolean; onOk: () => void; extra?: { label: string; onOk: () => void } };

interface Ctx {
  state: AppState;
  page: Page;
  navigate: (p: Page) => void;
  back: () => void;
  forward: () => void;
  canBack: boolean;
  canForward: boolean;
  modal: Modal | null;
  openModal: (m: Modal) => void;
  closeModal: () => void;
  toast: (msg: string) => void;
  toasts: { id: number; msg: string }[];
  downloadsOpen: boolean;
  setDownloadsOpen: (v: boolean) => void;
}

const StoreCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(StoreCtx);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [stack, setStack] = useState<Page[]>([{ name: 'home' }]);
  const [idx, setIdx] = useState(0);
  const [modal, setModal] = useState<Modal | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const toastId = useRef(0);

  useEffect(() => {
    api.state().then(setState);
    const patch = (key: keyof AppState) => (v: any) => setState((s) => (s ? { ...s, [key]: v } : s));
    const offs = [
      api.on('games', patch('games')),
      api.on('sessions', patch('sessions')),
      api.on('downloads', patch('downloads')),
      api.on('running', patch('running')),
      api.on('profile', patch('profile')),
      api.on('settings', patch('settings')),
      api.on('catalogInstalls', (v) => setState((s) => (s ? { ...s, catalogInstalls: { ...v } } : s))),
      api.on('updater', patch('updater')),
      api.on('maximized', patch('maximized'))
    ];
    return () => offs.forEach((o) => o());
  }, []);

  const navigate = useCallback(
    (p: Page) => {
      setStack((s) => [...s.slice(0, idx + 1), p]);
      setIdx((i) => i + 1);
      setDownloadsOpen(false);
    },
    [idx]
  );
  const back = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);
  const forward = useCallback(() => setIdx((i) => Math.min(stack.length - 1, i + 1)), [stack.length]);

  const toast = useCallback((msg: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const value = useMemo<Ctx | null>(() => {
    if (!state) return null;
    return {
      state,
      page: stack[idx],
      navigate,
      back,
      forward,
      canBack: idx > 0,
      canForward: idx < stack.length - 1,
      modal,
      openModal: setModal,
      closeModal: () => setModal(null),
      toast,
      toasts,
      downloadsOpen,
      setDownloadsOpen
    };
  }, [state, stack, idx, navigate, back, forward, modal, toast, toasts, downloadsOpen]);

  if (!value) return <div className="boot" />;
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
