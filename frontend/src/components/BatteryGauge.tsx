/**
 * Battery Gauge Component
 * Vertical or horizontal battery indicator with SOC, SOH, voltage, temp.
 */
interface BatteryGaugeProps {
  soc: number;
  soh: number;
  voltage: number;
  current: number;
  temperature: number;
  power: number;
  isCharging?: boolean;
  layout?: "vertical" | "horizontal";
}

export default function BatteryGauge({
  soc,
  soh,
  voltage,
  current,
  temperature,
  power,
  isCharging = false,
  layout = "vertical",
}: BatteryGaugeProps) {
  const getSOCColor = () => {
    if (soc > 60) return "#00e676";
    if (soc > 30) return "#ffab00";
    if (soc > 15) return "#ff6d00";
    return "#ff1744";
  };

  const getTempColor = () => {
    if (temperature < 35) return "#00e5ff";
    if (temperature < 45) return "#ffab00";
    return "#ff1744";
  };

  return (
    <div className={`battery-gauge battery-gauge--${layout}`}>
      <div className="battery-gauge__visual">
        <div className="battery-gauge__cap" />
        <div className="battery-gauge__body">
          <div
            className="battery-gauge__fill"
            style={{
              height: `${soc}%`,
              background: `linear-gradient(to top, ${getSOCColor()}cc, ${getSOCColor()})`,
              boxShadow: `0 0 20px ${getSOCColor()}60`,
            }}
          >
            {isCharging && <div className="battery-gauge__charging-icon">⚡</div>}
          </div>
          <div className="battery-gauge__percentage">{Math.round(soc)}%</div>
        </div>
      </div>

      <div className="battery-gauge__stats">
        <div className="battery-gauge__stat">
          <span className="battery-gauge__label">SOH</span>
          <span className="battery-gauge__value">{soh.toFixed(0)}%</span>
        </div>
        <div className="battery-gauge__stat">
          <span className="battery-gauge__label">Voltage</span>
          <span className="battery-gauge__value">{voltage.toFixed(1)} V</span>
        </div>
        <div className="battery-gauge__stat">
          <span className="battery-gauge__label">Current</span>
          <span className="battery-gauge__value">{current.toFixed(1)} A</span>
        </div>
        <div className="battery-gauge__stat">
          <span className="battery-gauge__label">Power</span>
          <span className="battery-gauge__value">{Math.abs(power).toFixed(2)} kW</span>
        </div>
        <div className="battery-gauge__stat">
          <span className="battery-gauge__label">Temp</span>
          <span className="battery-gauge__value" style={{ color: getTempColor() }}>
            {temperature.toFixed(1)}°C
          </span>
        </div>
      </div>
    </div>
  );
}
