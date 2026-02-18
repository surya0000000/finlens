import { Link } from "react-router-dom";

export const NotFoundPage = () => (
  <div className="not-found-page">
    <h1>Page not found</h1>
    <p>The page you requested does not exist.</p>
    <Link to="/dashboard" className="primary-button">
      Return to dashboard
    </Link>
  </div>
);

