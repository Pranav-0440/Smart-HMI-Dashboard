/**
 * Motor Stats Component
 * Displays RPM, torque, power, temperature, and efficiency.
 */
interface MotorStatsProps {
  rpm: number;
  maxRpm: number;
  torque: number;
  power: number;
  temperature: number;
  maxTemp: number;
}

export default function MotorStats({
  rpm,
  maxRpm,
  torque,
  power,
  temperature,
  maxTemp,
}: MotorStatsProps) {
  const rpmFraction = Math.min(rpm / maxRpm, 1);
  const tempFraction = Math.min(temperature / maxTemp, 1);

  const getRpmColor = () => {
    if (rpmFraction < 0.6) return "#00e5ff";
    if (rpmFraction < 0.85) return "#ffab00";
    return "#ff1744";
  };

  const getTempColor = () => {
    if (tempFraction < 0.6) return "#00e5ff";
    if (tempFraction < 0.8) return "#ffab00";
    return "#ff1744";
  };

  return (
    <div className="motor-stats">
      <h3 className="motor-stats__title">Motor</h3>

      <div className="motor-stats__grid">
        {/* RPM */}
        <div className="motor-stats__item">
          <span className="motor-stats__label">RPM</span>
          <div className="motor-stats__bar-track">
            <div
              className="motor-stats__bar-fill"
              style={{
                width: `${rpmFraction * 100}%`,
                background: getRpmColor(),
                boxShadow: `0 0 10px ${getRpmColor()}80`,
              }}
            />
          </div>
          <span className="motor-stats__value" style={{ color: getRpmColor() }}>
            {Math.round(rpm)}
          </span>
        </div>

        {/* Torque */}
        <div className="motor-stats__item">
          <span className="motor-stats__label">Torque</span>
          <span className="motor-stats__value">{torque.toFixed(1)} Nm</span>
        </div>

        {/* Power */}
        <div className="motor-stats__item">
          <span className="motor-stats__label">Power</span>
          <span className="motor-stats__value motor-stats__value--highlight">
            {power.toFixed(2)} kW
          </span>
        </div>

        {/* Temperature */}
        <div className="motor-stats__item">
          <span className="motor-stats__label">Temp</span>
          <div className="motor-stats__bar-track">
            <div
              className="motor-stats__bar-fill"
              style={{
                width: `${tempFraction * 100}%`,
                background: getTempColor(),
                boxShadow: `0 0 10px ${getTempColor()}80`,
              }}
            />
          </div>
          <span className="motor-stats__value" style={{ color: getTempColor() }}>
            {temperature.toFixed(1)}°C
          </span>
        </div>
      </div>
    </div>
  );
}
