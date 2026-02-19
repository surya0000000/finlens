import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { extractApiError } from "../lib/api";

type AuthMode = "login" | "register";

export const AuthPage = () => {
  const { token, login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [formState, setFormState] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login(formState.email, formState.password);
      } else {
        await register({
          email: formState.email,
          password: formState.password,
          firstName: formState.firstName || undefined,
          lastName: formState.lastName || undefined,
        });
      }
    } catch (submitError) {
      setError(extractApiError(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>FinLens</h1>
        <p>Calm, high-clarity financial intelligence with read-only control.</p>

        <div className="auth-toggle">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          {mode === "register" ? (
            <div className="auth-name-grid">
              <input
                required
                placeholder="First name"
                value={formState.firstName}
                onChange={(event) =>
                  setFormState((previous) => ({ ...previous, firstName: event.target.value }))
                }
              />
              <input
                required
                placeholder="Last name"
                value={formState.lastName}
                onChange={(event) =>
                  setFormState((previous) => ({ ...previous, lastName: event.target.value }))
                }
              />
            </div>
          ) : null}

          <input
            required
            type="email"
            placeholder="Email"
            value={formState.email}
            onChange={(event) =>
              setFormState((previous) => ({ ...previous, email: event.target.value }))
            }
          />
          <input
            required
            minLength={8}
            type="password"
            placeholder="Password"
            value={formState.password}
            onChange={(event) =>
              setFormState((previous) => ({ ...previous, password: event.target.value }))
            }
          />
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        {error ? <p className="error-text">{error}</p> : null}
      </div>
    </div>
  );
};

