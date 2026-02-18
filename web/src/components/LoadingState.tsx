export const LoadingState = ({ label = "Loading..." }: { label?: string }): JSX.Element => (
  <div className="loading-state">
    <div className="spinner" />
    <span>{label}</span>
  </div>
);

