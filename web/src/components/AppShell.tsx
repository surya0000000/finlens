import { Suspense, lazy, useMemo, useState } from "react";
import { Compass, Landmark, LayoutDashboard, LogOut, Sparkles } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import type { PropsWithChildren } from "react";

import { useAuth } from "../context/AuthContext";
const AICopilotPanel = lazy(() =>
  import("./AICopilotPanel").then((module) => ({ default: module.AICopilotPanel })),
);

const navItems = [
  { to: "/dashboard", label: "Command Center", icon: LayoutDashboard },
  { to: "/analytics", label: "Deep Analytics", icon: Compass },
  { to: "/accounts", label: "Accounts & Integrations", icon: Landmark },
];

export const AppShell = ({ children }: PropsWithChildren) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [copilotOpen, setCopilotOpen] = useState(false);
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  const pageMeta = useMemo(() => {
    if (location.pathname.startsWith("/analytics")) {
      return {
        title: "Deep Analytics",
        subtitle: "Data-dense intelligence with premium clarity.",
      };
    }

    if (location.pathname.startsWith("/accounts")) {
      return {
        title: "Accounts & Integrations",
        subtitle: "Institution connectivity, sync posture, and financial infrastructure.",
      };
    }

    return {
      title: "Financial Command Center",
      subtitle: "Unified visibility across cash, investments, credit, and recurring spend.",
    };
  }, [location.pathname]);

  return (
    <>
      <div className="layout">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-icon">F</div>
            <div>
              <h1>FinLens</h1>
              <p>Financial Intelligence</p>
            </div>
          </div>

          <nav className="nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <button type="button" className="logout-button" onClick={logout}>
            <LogOut size={15} />
            Sign out
          </button>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <div>
              <h2>{pageMeta.title}</h2>
              <p>{pageMeta.subtitle}</p>
            </div>
            <div className="user-chip">
              <span className="user-chip-name">{displayName || "FinLens User"}</span>
              <span className="user-chip-email">{user?.email}</span>
            </div>
          </header>

          {children}
        </main>
      </div>

      <button
        type="button"
        className="copilot-trigger"
        onClick={() => setCopilotOpen(true)}
        aria-label="Ask FinLens AI"
      >
        <Sparkles size={14} />
        Ask FinLens
      </button>

      {copilotOpen ? (
        <Suspense fallback={null}>
          <AICopilotPanel isOpen={copilotOpen} onClose={() => setCopilotOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
};

