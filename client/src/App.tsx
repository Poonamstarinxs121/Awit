import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { TenantsListPage } from './pages/admin/TenantsListPage';
import { TenantDetailPage } from './pages/admin/TenantDetailPage';
import { FinancePage } from './pages/admin/FinancePage';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { LandingPage } from './pages/LandingPage';
import { Board } from './pages/Board';
import { Agents } from './pages/Agents';
import { AgentDetail } from './pages/AgentDetail';
import { AgentNew } from './pages/AgentNew';
import { Standups } from './pages/Standups';
import { Settings } from './pages/Settings';
import { Setup } from './pages/Setup';
import { Provisioning } from './pages/Provisioning';
import { Documents } from './pages/Documents';
import { MemoryGraph } from './pages/MemoryGraph';
import { HelpCenter } from './pages/HelpCenter';
import { Subscription } from './pages/Subscription';
import { Machines } from './pages/Machines';
import { Approvals } from './pages/Approvals';
import { BoardGroups } from './pages/BoardGroups';
import { SystemMonitor } from './pages/SystemMonitor';
import { SessionsPage } from './pages/SessionsPage';
import { CostsPage } from './pages/CostsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { CalendarPage } from './pages/CalendarPage';
import { LogsPage } from './pages/LogsPage';
import { TerminalPage } from './pages/TerminalPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { SearchPage } from './pages/SearchPage';
import { ActionsPage } from './pages/ActionsPage';
import { AboutPage } from './pages/AboutPage';
import { Organisation } from './pages/Organisation';
import { MarketplacePage } from './pages/MarketplacePage';
import { PacksPage } from './pages/PacksPage';
import { OfficePage } from './pages/OfficePage';
import { FleetPage } from './pages/FleetPage';
import { useAuth } from './hooks/useAuth';
import { Navigate } from 'react-router-dom';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0C0C0C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #2A2A2A', borderTopColor: '#FF3B30', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
  if (!user || !user.isSaasAdmin) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />
            <Route path="/admin/tenants" element={<AdminRoute><TenantsListPage /></AdminRoute>} />
            <Route path="/admin/tenants/:id" element={<AdminRoute><TenantDetailPage /></AdminRoute>} />
            <Route path="/admin/finance" element={<AdminRoute><FinancePage /></AdminRoute>} />
            <Route path="/register" element={<Register />} />
            <Route path="/setup" element={<ProtectedRoute><Setup /></ProtectedRoute>} />
            <Route path="/setup/provisioning" element={<ProtectedRoute><Provisioning /></ProtectedRoute>} />
            <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/boards" element={<BoardGroups />} />
              <Route path="/kanban" element={<Board />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/agents/new" element={<AgentNew />} />
              <Route path="/agents/:id" element={<AgentDetail />} />
              <Route path="/standups" element={<Standups />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/documents" element={<Documents />} />

              <Route path="/machines" element={<Machines />} />
              <Route path="/activity" element={<LogsPage />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/help" element={<HelpCenter />} />
              <Route path="/system" element={<SystemMonitor />} />
              <Route path="/sessions" element={<SessionsPage />} />
              <Route path="/costs" element={<CostsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/terminal" element={<TerminalPage />} />
              <Route path="/automation" element={<WorkflowsPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/actions" element={<ActionsPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/memory" element={<MemoryGraph />} />
              <Route path="/organisation" element={<Organisation />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/packs" element={<PacksPage />} />
              <Route path="/office" element={<OfficePage />} />
              <Route path="/fleet" element={<FleetPage />} />
            </Route>
          </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
