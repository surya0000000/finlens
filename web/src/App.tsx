import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { LoadingState } from "./components/LoadingState";
import { ProtectedRoute } from "./components/ProtectedRoute";
const AuthPage = lazy(() => import("./pages/AuthPage").then((module) => ({ default: module.AuthPage })));
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })),
);
const AccountsPage = lazy(() => import("./pages/AccountsPage").then((module) => ({ default: module.AccountsPage })));
const SubscriptionsPage = lazy(() =>
  import("./pages/SubscriptionsPage").then((module) => ({ default: module.SubscriptionsPage })),
);
const InsightsPage = lazy(() => import("./pages/InsightsPage").then((module) => ({ default: module.InsightsPage })));
const AdvisorPage = lazy(() => import("./pages/AdvisorPage").then((module) => ({ default: module.AdvisorPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));

const ProtectedLayout = () => (
  <ProtectedRoute>
    <AppShell>
      <Suspense fallback={<LoadingState label="Loading page..." />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/advisor" element={<AdvisorPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  </ProtectedRoute>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth"
          element={
            <Suspense fallback={<LoadingState label="Loading authentication..." />}>
              <AuthPage />
            </Suspense>
          }
        />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
