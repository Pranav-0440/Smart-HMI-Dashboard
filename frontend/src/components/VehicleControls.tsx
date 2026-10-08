/**
 * Vehicle Controls Component
 * Common and vehicle-specific control toggles.
 */
import type { VehicleState } from "../types/vehicle";

interface VehicleControlsProps {
  state: VehicleState;
  onToggle: (control: string) => void;
}

export default function VehicleControls({ state, onToggle }: VehicleControlsProps) {
  const isBike = state.vehicleType === "BIKE";

  return (
    <div className="vehicle-controls">
      {/* Common controls */}
      <ControlButton
        label="Headlight"
        icon={state.headlight ? "💡" : "🔦"}
        active={state.headlight}
        onClick={() => onToggle("headlight")}
      />
      <ControlButton
        label="Left"
        icon="◀"
        active={state.leftIndicator}
        blinking={state.leftIndicator}
        color="#ffab00"
        onClick={() => onToggle("leftIndicator")}
      />
      <ControlButton
        label="Hazard"
        icon="⚠"
        active={state.hazard}
        blinking={state.hazard}
        color="#ff1744"
        onClick={() => onToggle("hazard")}
      />
      <ControlButton
        label="Right"
        icon="▶"
        active={state.rightIndicator}
        blinking={state.rightIndicator}
        color="#ffab00"
        onClick={() => onToggle("rightIndicator")}
      />

      {/* Bike-specific */}
      {isBike && (
        <>
          <ControlButton
            label="Stand"
            icon="⊥"
            active={state.sideStand ?? false}
            color={state.sideStand ? "#ff1744" : undefined}
            onClick={() => onToggle("sideStand")}
          />
        </>
      )}

      {/* Car-specific */}
      {!isBike && (
        <>
          <ControlButton
            label="Doors"
            icon={state.doorsLocked ? "🔒" : "🔓"}
            active={!state.doorsLocked}
            onClick={() => onToggle("doorsLocked")}
          />
          <ControlButton
            label="Belt"
            icon="🪢"
            active={state.seatBelt ?? true}
            color={state.seatBelt ? "#00e676" : "#ff1744"}
            onClick={() => onToggle("seatBelt")}
          />
          <ControlButton
            label="P-Brake"
            icon="🅿"
            active={state.parkingBrake ?? false}
            color={state.parkingBrake ? "#ff1744" : undefined}
            onClick={() => onToggle("parkingBrake")}
          />
          <ControlButton
            label="Climate"
            icon="❄"
            active={state.climateOn ?? false}
            onClick={() => onToggle("climate")}
          />
        </>
      )}
    </div>
  );
}

// ── Sub-component ────────────────────────────────────────────

interface ControlButtonProps {
  label: string;
  icon: string;
  active: boolean;
  blinking?: boolean;
  color?: string;
  onClick: () => void;
}

function ControlButton({
  label,
  icon,
  active,
  blinking,
  color,
  onClick,
}: ControlButtonProps) {
  return (
    <button
      className={`control-btn ${active ? "control-btn--active" : ""} ${
        blinking ? "control-btn--blink" : ""
      }`}
      style={
        active && color
          ? {
              borderColor: color,
              color: color,
              boxShadow: `0 0 12px ${color}50`,
            }
          : undefined
      }
      onClick={onClick}
    >
      <span className="control-btn__icon">{icon}</span>
      <span className="control-btn__label">{label}</span>
    </button>
  );
}
