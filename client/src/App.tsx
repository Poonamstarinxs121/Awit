import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { AdminLogin } from './pages/AdminLogin';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Kanban } from './pages/Kanban';
import { Agents } from './pages/Agents';
import { AgentDetail } from './pages/AgentDetail';
import { AgentNew } from './pages/AgentNew';
import { Standups } from './pages/Standups';
import { Settings } from './pages/Settings';
import { Setup } from './pages/Setup';
import { Provisioning } from './pages/Provisioning';
import { Documents } from './pages/Documents';
import { SquadChat } from './pages/SquadChat';
import { MemoryGraph } from './pages/MemoryGraph';
import { HelpCenter } from './pages/HelpCenter';
import { Subscription } from './pages/Subscription';
import { Machines } from './pages/Machines';
import { Approvals } from './pages/Approvals';
import { BoardGroups } from './pages/BoardGroups';
import { Activity } from './pages/Activity';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/admin/login" element={<AdminLogin />} />
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
              <Route path="/" element={<Dashboard />} />
              <Route path="/boards" element={<BoardGroups />} />
              <Route path="/kanban" element={<Kanban />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/agents/new" element={<AgentNew />} />
              <Route path="/agents/:id" element={<AgentDetail />} />
              <Route path="/standups" element={<Standups />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/squad-chat" element={<SquadChat />} />
              <Route path="/memory-graph" element={<MemoryGraph />} />
              <Route path="/machines" element={<Machines />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/help" element={<HelpCenter />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
