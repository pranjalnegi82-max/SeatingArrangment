export default function ProgressBar({ percent }) {
  return (
    <div className="progress-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
      <span className="progress-bar-label">{percent}%</span>
    </div>
  );
}
