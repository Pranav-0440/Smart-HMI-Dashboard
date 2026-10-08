/**
 * Vehicle Selection Page
 * Landing page — choose between Electric Bike and Electric Car.
 */
import type { VehicleType } from "../types/vehicle";

interface VehicleSelectionProps {
  onSelect: (type: VehicleType) => void;
}

export default function VehicleSelection({ onSelect }: VehicleSelectionProps) {
  return (
    <div className="vehicle-selection">
      <div className="vehicle-selection__bg" />

      <div className="vehicle-selection__content">
        <div className="vehicle-selection__header">
          <h1 className="vehicle-selection__title">
            <span className="vehicle-selection__logo">⚡</span>
            EV-HMI Platform
          </h1>
          <p className="vehicle-selection__subtitle">
            Smart Digital Twin — Real-time Vehicle Monitoring
          </p>
        </div>

        <h2 className="vehicle-selection__prompt">Select Your Vehicle</h2>

        <div className="vehicle-selection__cards">
          {/* BIKE */}
          <button
            className="vehicle-card vehicle-card--bike"
            onClick={() => onSelect("BIKE")}
          >
            <div className="vehicle-card__icon">🏍️</div>
            <div className="vehicle-card__info">
              <h3 className="vehicle-card__name">2-Wheeler</h3>
              <p className="vehicle-card__desc">Electric Bike / Scooter</p>
              <div className="vehicle-card__specs">
                <span>8 kW</span>
                <span>•</span>
                <span>72 V</span>
                <span>•</span>
                <span>4 kWh</span>
              </div>
            </div>
            <div className="vehicle-card__arrow">→</div>
          </button>

          {/* CAR */}
          <button
            className="vehicle-card vehicle-card--car"
            onClick={() => onSelect("CAR")}
          >
            <div className="vehicle-card__icon">🚗</div>
            <div className="vehicle-card__info">
              <h3 className="vehicle-card__name">4-Wheeler</h3>
              <p className="vehicle-card__desc">Electric Car</p>
              <div className="vehicle-card__specs">
                <span>100 kW</span>
                <span>•</span>
                <span>400 V</span>
                <span>•</span>
                <span>60 kWh</span>
              </div>
            </div>
            <div className="vehicle-card__arrow">→</div>
          </button>
        </div>

        <div className="vehicle-selection__footer">
          <p>Smart EV HMI — Digital Twin Simulator</p>
        </div>
      </div>
    </div>
  );
}
