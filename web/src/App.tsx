import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AccountsPage } from "./pages/AccountsPage";
import { SubscriptionsPage } from "./pages/SubscriptionsPage";
import { InsightsPage } from "./pages/InsightsPage";
import { AdvisorPage } from "./pages/AdvisorPage";
import { NotFoundPage } from "./pages/NotFoundPage";

const ProtectedLayout = (): JSX.Element => (
  <ProtectedRoute>
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/advisor" element={<AdvisorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  </ProtectedRoute>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
