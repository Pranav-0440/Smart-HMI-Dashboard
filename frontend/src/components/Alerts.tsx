/**
 * Alerts Component
 * Displays active warnings with severity-based styling.
 */
interface AlertsProps {
  warnings: string[];
}

export default function Alerts({ warnings }: AlertsProps) {
  if (warnings.length === 0) {
    return (
      <div className="alerts alerts--clear">
        <span className="alerts__icon">✓</span>
        <span className="alerts__text">No Active Warnings</span>
      </div>
    );
  }

  return (
    <div className="alerts">
      {warnings.map((warning, idx) => {
        const severity = warning.startsWith("DANGER")
          ? "danger"
          : warning.startsWith("CRITICAL")
          ? "critical"
          : "warning";

        return (
          <div key={idx} className={`alerts__item alerts__item--${severity}`}>
            <span className="alerts__icon">
              {severity === "danger" || severity === "critical" ? "🔴" : "⚠️"}
            </span>
            <span className="alerts__text">{warning}</span>
          </div>
        );
      })}
    </div>
  );
}
