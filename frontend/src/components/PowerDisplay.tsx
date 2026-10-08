/**
 * Power Display Component
 * Shows motor and battery power with regeneration indication.
 */
interface PowerDisplayProps {
  motorPower: number;
  batteryPower: number;
  regenPower: number;
  regenActive: boolean;
}

export default function PowerDisplay({
  motorPower,
  batteryPower,
  regenPower,
  regenActive,
}: PowerDisplayProps) {
  return (
    <div className="power-display">
      <div className="power-display__item">
        <span className="power-display__label">Motor</span>
        <span className="power-display__value">{motorPower.toFixed(2)} kW</span>
      </div>
      <div className="power-display__item">
        <span className="power-display__label">Battery</span>
        <span className="power-display__value">{Math.abs(batteryPower).toFixed(2)} kW</span>
      </div>
      {regenActive && (
        <div className="power-display__item power-display__item--regen">
          <span className="power-display__label">♻ Regen</span>
          <span className="power-display__value power-display__value--regen">
            {regenPower.toFixed(2)} kW
          </span>
        </div>
      )}
    </div>
  );
}
