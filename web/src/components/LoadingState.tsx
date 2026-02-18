export const LoadingState = ({ label = "Loading..." }: { label?: string }) => (
  <div className="loading-state">
    <div className="spinner" />
    <span>{label}</span>
  </div>
);

