import Dock from '@/components/TenacitOS/Dock';
import TopBar from '@/components/TenacitOS/TopBar';
import StatusBar from '@/components/TenacitOS/StatusBar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Dock />
      <TopBar />
      <main style={{
        marginLeft: 68,
        marginTop: 48,
        marginBottom: 32,
        minHeight: 'calc(100vh - 80px)',
        padding: 24,
        background: 'var(--background)',
      }}>
        {children}
      </main>
      <StatusBar />
    </>
  );
}
