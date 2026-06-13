import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AgentDashboardPage } from "./pages/AgentDashboardPage";
import { AgentLoginPage } from "./pages/AgentLoginPage";
import { AgentSessionPage } from "./pages/AgentSessionPage";
import { CallPlaceholderPage } from "./pages/CallPlaceholderPage";
import { HomePage } from "./pages/HomePage";
import { JoinPage } from "./pages/JoinPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ObservabilityPage } from "./pages/ObservabilityPage";
import { RecordingArchitecturePage } from "./pages/RecordingArchitecturePage";
import { SessionHistoryPage } from "./pages/SessionHistoryPage";
import { ProtectedAdminRoute } from "./routes/ProtectedAdminRoute";
import { ProtectedAgentRoute } from "./routes/ProtectedAgentRoute";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/agent/login" element={<AgentLoginPage />} />

        <Route
          path="/agent/dashboard"
          element={
            <ProtectedAgentRoute>
              <AgentDashboardPage />
            </ProtectedAgentRoute>
          }
        />

        <Route
          path="/agent/session/:sessionId"
          element={
            <ProtectedAgentRoute>
              <AgentSessionPage />
            </ProtectedAgentRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <AdminDashboardPage />
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/admin/observability"
          element={
            <ProtectedAdminRoute>
              <ObservabilityPage />
            </ProtectedAdminRoute>
          }
        />

        <Route
          path="/admin/recording"
          element={
            <ProtectedAdminRoute>
              <RecordingArchitecturePage />
            </ProtectedAdminRoute>
          }
        />
<Route path="/join/:inviteToken" element={<JoinPage />} />
        <Route path="/call/:sessionId" element={<CallPlaceholderPage />} />
        <Route path="/session/:sessionId/history" element={<SessionHistoryPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}