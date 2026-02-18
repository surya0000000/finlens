import { BarChart3, CreditCard, LayoutDashboard, LogOut, MessageCircle, PiggyBank } from "lucide-react";
import { NavLink } from "react-router-dom";

import type { PropsWithChildren } from "react";

import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/accounts", label: "Accounts", icon: CreditCard },
  { to: "/subscriptions", label: "Subscriptions", icon: PiggyBank },
  { to: "/insights", label: "Insights", icon: BarChart3 },
  { to: "/advisor", label: "Advisor", icon: MessageCircle },
];

export const AppShell = ({ children }: PropsWithChildren): JSX.Element => {
  const { user, logout } = useAuth();
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">F</div>
          <div>
            <h1>FinLens X</h1>
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
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <button type="button" className="logout-button" onClick={logout}>
          <LogOut size={16} />
          Sign out
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h2>Welcome back{displayName ? `, ${displayName}` : ""}</h2>
            <p>Read-only financial clarity with explainable insights.</p>
          </div>
          <span className="user-email">{user?.email}</span>
        </header>

        {children}
      </main>
    </div>
  );
};

