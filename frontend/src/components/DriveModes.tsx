/**
 * Drive Modes Component
 * ECO / NORMAL / SPORT selector with animated transitions.
 */
import type { DriveMode } from "../types/vehicle";

interface DriveModesProps {
  activeMode: DriveMode;
  onChange: (mode: DriveMode) => void;
}

const MODES: { mode: DriveMode; icon: string; color: string; label: string }[] = [
  { mode: "ECO", icon: "🌿", color: "#00e676", label: "ECO" },
  { mode: "NORMAL", icon: "⚡", color: "#00e5ff", label: "NORMAL" },
  { mode: "SPORT", icon: "🔥", color: "#ff1744", label: "SPORT" },
];

export default function DriveModes({ activeMode, onChange }: DriveModesProps) {
  return (
    <div className="drive-modes">
      {MODES.map(({ mode, icon, color, label }) => (
        <button
          key={mode}
          className={`drive-modes__btn ${
            activeMode === mode ? "drive-modes__btn--active" : ""
          }`}
          style={
            activeMode === mode
              ? {
                  borderColor: color,
                  color: color,
                  boxShadow: `0 0 20px ${color}40, inset 0 0 20px ${color}15`,
                }
              : undefined
          }
          onClick={() => onChange(mode)}
        >
          <span className="drive-modes__icon">{icon}</span>
          <span className="drive-modes__label">{label}</span>
        </button>
      ))}
    </div>
  );
}
