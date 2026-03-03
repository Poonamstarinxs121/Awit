import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Dock, getDockWidth, useIsMobile } from './shell/Dock';
import { TopBar } from './shell/TopBar';
import { StatusBar } from './shell/StatusBar';
import { GlobalLoader } from './ui/GlobalLoader';

export function Layout() {
  const [dockWidth, setDockWidth] = useState(getDockWidth);
  const isMobile = useIsMobile();

  useEffect(() => {
    function handleResize() {
      setDockWidth(getDockWidth());
    }
    window.addEventListener('dock-resize', handleResize);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('dock-resize', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div style={{ backgroundColor: 'var(--bg)', minHeight: '100vh', position: 'relative' }}>
      <GlobalLoader />
      <Dock />
      <TopBar dockWidth={isMobile ? 0 : dockWidth} />

      <main
        style={{
          marginLeft: isMobile ? '0px' : `${dockWidth}px`,
          marginTop: '48px',
          marginBottom: isMobile ? '0px' : '32px',
          minHeight: isMobile ? 'calc(100vh - 48px)' : 'calc(100vh - 48px - 32px)',
          padding: isMobile ? '12px' : '24px',
          backgroundColor: 'var(--bg)',
          overflowY: 'auto',
          transition: 'margin-left 220ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <Outlet />
      </main>

      {!isMobile && <StatusBar dockWidth={dockWidth} />}
    </div>
  );
}
