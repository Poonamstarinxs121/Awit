import { Outlet } from 'react-router-dom';
import { Dock } from './shell/Dock';
import { TopBar } from './shell/TopBar';
import { StatusBar } from './shell/StatusBar';
import { GlobalLoader } from './ui/GlobalLoader';

export function Layout() {
  return (
    <div style={{ backgroundColor: 'var(--bg)', minHeight: '100vh', position: 'relative' }}>
      <GlobalLoader />
      <Dock />
      <TopBar />

      <main
        style={{
          marginLeft: '68px',
          marginTop: '48px',
          marginBottom: '32px',
          minHeight: 'calc(100vh - 48px - 32px)',
          padding: '24px',
          backgroundColor: 'var(--bg)',
          overflowY: 'auto',
        }}
      >
        <Outlet />
      </main>

      <StatusBar />
    </div>
  );
}
