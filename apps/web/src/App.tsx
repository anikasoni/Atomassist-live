import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AgentDashboardPage } from "./pages/AgentDashboardPage";
import { AgentLoginPage } from "./pages/AgentLoginPage";
import { AgentSessionPage } from "./pages/AgentSessionPage";
import { CallPlaceholderPage } from "./pages/CallPlaceholderPage";
import { HomePage } from "./pages/HomePage";
import { JoinPage } from "./pages/JoinPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SessionHistoryPage } from "./pages/SessionHistoryPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/agent/login" element={<AgentLoginPage />} />
        <Route path="/agent/dashboard" element={<AgentDashboardPage />} />
        <Route path="/agent/session/:sessionId" element={<AgentSessionPage />} />
        <Route path="/join/:inviteToken" element={<JoinPage />} />
        <Route path="/call/:sessionId" element={<CallPlaceholderPage />} />
        <Route path="/session/:sessionId/history" element={<SessionHistoryPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}