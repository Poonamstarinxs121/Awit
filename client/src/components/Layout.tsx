import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Dock, getDockWidth } from './shell/Dock';
import { TopBar } from './shell/TopBar';
import { StatusBar } from './shell/StatusBar';
import { GlobalLoader } from './ui/GlobalLoader';

export function Layout() {
  const [dockWidth, setDockWidth] = useState(getDockWidth);

  useEffect(() => {
    function handleResize() {
      setDockWidth(getDockWidth());
    }
    window.addEventListener('dock-resize', handleResize);
    return () => window.removeEventListener('dock-resize', handleResize);
  }, []);

  return (
    <div style={{ backgroundColor: 'var(--bg)', minHeight: '100vh', position: 'relative' }}>
      <GlobalLoader />
      <Dock />
      <TopBar dockWidth={dockWidth} />

      <main
        style={{
          marginLeft: `${dockWidth}px`,
          marginTop: '48px',
          marginBottom: '32px',
          minHeight: 'calc(100vh - 48px - 32px)',
          padding: '24px',
          backgroundColor: 'var(--bg)',
          overflowY: 'auto',
          transition: 'margin-left 220ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <Outlet />
      </main>

      <StatusBar dockWidth={dockWidth} />
    </div>
  );
}
