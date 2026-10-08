/**
 * Range Display Component
 */
interface RangeDisplayProps {
  range: number;
  soc: number;
  consumptionWhPerKm: number;
}

export default function RangeDisplay({
  range,
  soc,
  consumptionWhPerKm,
}: RangeDisplayProps) {
  const getRangeColor = () => {
    if (soc > 50) return "#00e676";
    if (soc > 25) return "#ffab00";
    return "#ff1744";
  };

  return (
    <div className="range-display">
      <div className="range-display__icon" style={{ color: getRangeColor() }}>
        📍
      </div>
      <div className="range-display__info">
        <span className="range-display__label">Range</span>
        <span
          className="range-display__value"
          style={{ color: getRangeColor() }}
        >
          {Math.round(range)} km
        </span>
      </div>
      {consumptionWhPerKm > 0 && (
        <div className="range-display__efficiency">
          {consumptionWhPerKm.toFixed(0)} Wh/km
        </div>
      )}
    </div>
  );
}
