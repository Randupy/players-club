import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store';
import { api } from '../api';
import type { ImportCandidate } from '../types';
import { IconX } from './Icons';

function Shell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn small" onClick={onClose} aria-label="Закрыть"><IconX /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddGame() {
  const { closeModal, openModal, toast, navigate } = useApp();
  const [magnet, setMagnet] = useState('');
  const [busy, setBusy] = useState(false);

  const done = (id: string | undefined) => {
    closeModal();
    toast('Загрузка началась. Следить за ней можно в разделе «Загрузки».');
    if (id) navigate({ name: 'library', gameId: id });
  };

  return (
    <Shell title="Добавить игру" onClose={closeModal}>
      <label className="field">
        <span>Magnet-ссылка</span>
        <textarea rows={3} value={magnet} onChange={(e) => setMagnet(e.target.value)} placeholder="magnet:?xt=urn:btih:…" />
      </label>
      <div className="row end">
        <button
          className="btn primary"
          disabled={busy || !magnet.trim()}
          onClick={async () => {
            setBusy(true);
            const r = await api.addMagnet(magnet.trim());
            setBusy(false);
            r.ok ? done(r.id) : toast(r.error || 'Не удалось добавить ссылку');
          }}
        >Скачать</button>
      </div>
      <div className="or"><span>или</span></div>
      <div className="choices">
        <button className="choice" onClick={async () => { const r = await api.addTorrentFile(); if (r) r.ok ? done(r.id) : toast(r.error || 'Не удалось открыть файл'); }}>
          <b>Файл .torrent</b>
          <span>Выберите файл раздачи на компьютере</span>
        </button>
        <button className="choice" onClick={async () => { const id = await api.addManual(); if (id) { closeModal(); navigate({ name: 'library', gameId: id }); } }}>
          <b>Уже установленная игра</b>
          <span>Укажите .exe, лаунчер будет запускать её и считать время</span>
        </button>
        <button className="choice" onClick={() => openModal({ type: 'import' })}>
          <b>Импорт из Steam, Epic, GOG</b>
          <span>Найдём установленные игры автоматически</span>
        </button>
      </div>
    </Shell>
  );
}

function ImportGames() {
  const { closeModal, toast } = useApp();
  const [items, setItems] = useState<ImportCandidate[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.scanImports().then((list) => {
      setItems(list);
      setPicked(new Set(list.filter((i) => !i.already).map((i) => i.key)));
    });
  }, []);

  const label = { steam: 'Steam', epic: 'Epic Games', gog: 'GOG' } as const;
  const chosen = items?.filter((i) => picked.has(i.key) && !i.already) ?? [];

  return (
    <Shell title="Импорт установленных игр" onClose={closeModal} wide>
      {!items && <p className="muted">Ищем игры в Steam, Epic Games и GOG…</p>}
      {items && items.length === 0 && <p className="muted">Установленных игр не найдено. Если они лежат в нестандартной папке, добавьте их по .exe через «Добавить игру».</p>}
      {items && items.length > 0 && (
        <>
          <div className="import-list">
            {items.map((i) => (
              <label key={i.key} className={'import-row' + (i.already ? ' dim' : '')}>
                <input
                  type="checkbox"
                  disabled={i.already}
                  checked={picked.has(i.key) || i.already}
                  onChange={(e) => {
                    const n = new Set(picked);
                    e.target.checked ? n.add(i.key) : n.delete(i.key);
                    setPicked(n);
                  }}
                />
                <span className="grow">{i.name}</span>
                <span className="tag">{label[i.source]}</span>
                {i.already && <span className="muted small-text">уже в библиотеке</span>}
              </label>
            ))}
          </div>
          <div className="row end">
            <button className="btn" onClick={closeModal}>Отмена</button>
            <button
              className="btn primary"
              disabled={chosen.length === 0}
              onClick={async () => {
                await api.addImports(chosen);
                toast(`Добавлено игр: ${chosen.length}`);
                closeModal();
              }}
            >Добавить выбранные ({chosen.length})</button>
          </div>
        </>
      )}
    </Shell>
  );
}

function Prompt({ m }: { m: Extract<NonNullable<ReturnType<typeof useApp>['modal']>, { type: 'prompt' }> }) {
  const { closeModal } = useApp();
  const [v, setV] = useState(m.value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.select(), []);
  const submit = () => {
    if (!v.trim()) return;
    m.onOk(v.trim());
    closeModal();
  };
  return (
    <Shell title={m.title} onClose={closeModal}>
      <input ref={ref} className="input" value={v} placeholder={m.placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <div className="row end">
        <button className="btn" onClick={closeModal}>Отмена</button>
        <button className="btn primary" onClick={submit}>{m.okLabel}</button>
      </div>
    </Shell>
  );
}

export default function Modals() {
  const { modal, closeModal } = useApp();
  if (!modal) return null;
  if (modal.type === 'add') return <AddGame />;
  if (modal.type === 'import') return <ImportGames />;
  if (modal.type === 'prompt') return <Prompt m={modal} />;
  return (
    <Shell title={modal.title} onClose={closeModal}>
      <p className="confirm-text">{modal.text}</p>
      <div className="row end">
        <button className="btn" onClick={closeModal}>Отмена</button>
        {modal.extra && <button className="btn" onClick={() => { modal.extra!.onOk(); closeModal(); }}>{modal.extra.label}</button>}
        <button className={'btn ' + (modal.danger ? 'danger' : 'primary')} onClick={() => { modal.onOk(); closeModal(); }}>{modal.okLabel}</button>
      </div>
    </Shell>
  );
}
