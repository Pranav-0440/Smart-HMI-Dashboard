/**
 * Simulation Control Panel
 * Developer/demo panel for controlling the digital twin parameters.
 */
import { useState } from "react";
import type { VehicleState, DriveMode } from "../types/vehicle";

interface SimControlProps {
  state: VehicleState;
  onThrottle: (v: number) => void;
  onBrake: (v: number) => void;
  onMode: (m: DriveMode) => void;
  onSlope: (v: number) => void;
  onAmbient: (v: number) => void;
  onReset: () => void;
}

export default function SimControl({
  state,
  onThrottle,
  onBrake,
  onMode,
  onSlope,
  onAmbient,
  onReset,
}: SimControlProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className={`sim-control ${isOpen ? "sim-control--open" : ""}`}>
      <button
        className="sim-control__toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? "▼" : "▲"} Simulation Control
      </button>

      {isOpen && (
        <div className="sim-control__body">
          <div className="sim-control__row">
            <label>Throttle</label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={state.throttle}
              onChange={(e) => onThrottle(Number(e.target.value))}
              className="sim-control__slider sim-control__slider--throttle"
            />
            <span className="sim-control__val">{state.throttle.toFixed(0)}%</span>
          </div>

          <div className="sim-control__row">
            <label>Brake</label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={state.brake}
              onChange={(e) => onBrake(Number(e.target.value))}
              className="sim-control__slider sim-control__slider--brake"
            />
            <span className="sim-control__val">{state.brake.toFixed(0)}%</span>
          </div>

          <div className="sim-control__row">
            <label>Road Slope</label>
            <input
              type="range"
              min="-15"
              max="15"
              step="1"
              value={state.slope}
              onChange={(e) => onSlope(Number(e.target.value))}
              className="sim-control__slider"
            />
            <span className="sim-control__val">{state.slope}%</span>
          </div>

          <div className="sim-control__row">
            <label>Ambient Temp</label>
            <input
              type="range"
              min="-10"
              max="50"
              step="1"
              value={state.batteryTemperature}
              onChange={(e) => onAmbient(Number(e.target.value))}
              className="sim-control__slider"
            />
            <span className="sim-control__val">{state.batteryTemperature.toFixed(0)}°C</span>
          </div>

          <div className="sim-control__row">
            <label>Drive Mode</label>
            <div className="sim-control__mode-btns">
              {(["ECO", "NORMAL", "SPORT"] as DriveMode[]).map((m) => (
                <button
                  key={m}
                  className={`sim-control__mode-btn ${
                    state.driveMode === m ? "sim-control__mode-btn--active" : ""
                  }`}
                  onClick={() => onMode(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="sim-control__row">
            <button className="sim-control__reset" onClick={onReset}>
              🔄 Reset
            </button>
          </div>

          {/* Live readout */}
          <div className="sim-control__readout">
            <div>Speed: <b>{state.speed.toFixed(1)} km/h</b></div>
            <div>SOC: <b>{state.batterySoc.toFixed(1)}%</b></div>
            <div>Motor: <b>{state.motorPower.toFixed(2)} kW</b></div>
            <div>RPM: <b>{Math.round(state.motorRpm)}</b></div>
            <div>Distance: <b>{state.distance.toFixed(2)} km</b></div>
          </div>
        </div>
      )}
    </div>
  );
}
