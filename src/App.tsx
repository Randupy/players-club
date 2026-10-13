import { useApp } from './store';
import TopBar from './components/TopBar';
import Modals from './components/Modals';
import Home from './pages/Home';
import Library from './pages/Library';
import Discover from './pages/Discover';
import Profile from './pages/Profile';
import Settings from './pages/Settings';

export default function App() {
  const { page, toasts, state } = useApp();
  return (
    <div className="shell">
      <TopBar />
      <main className="content" key={page.name}>
        {page.name === 'home' && <Home />}
        {page.name === 'library' && <Library gameId={page.gameId} />}
        {page.name === 'discover' && <Discover />}
        {page.name === 'profile' && <Profile />}
        {page.name === 'settings' && <Settings />}
      </main>
      {state.updater.status === 'ready' && (
        <div className="update-bar">
          <span>Доступна версия {state.updater.version}. Она уже загружена.</span>
          <button className="btn small primary" onClick={() => import('./api').then((m) => m.api.installUpdate())}>
            Перезапустить и обновить
          </button>
        </div>
      )}
      <Modals />
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
