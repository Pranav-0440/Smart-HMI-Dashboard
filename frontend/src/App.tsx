/**
 * EV-HMI Platform — Main App
 * Routes between vehicle selection, bike dashboard, and car dashboard.
 */
import { useState, useEffect, useCallback } from "react";
import type { VehicleState, VehicleType, DriveMode } from "./types/vehicle";
import { wsService, apiPost } from "./services/websocket";
import VehicleSelection from "./pages/VehicleSelection";
import BikeDashboard from "./pages/BikeDashboard";
import CarDashboard from "./pages/CarDashboard";

// Default state for initial render
const DEFAULT_STATE: VehicleState = {
  vehicleType: "BIKE",
  vehicleName: "EV-BIKE 2W",
  timestamp: 0,
  speed: 0,
  acceleration: 0,
  distance: 0,
  throttle: 0,
  brake: 0,
  motorRpm: 0,
  motorTorque: 0,
  motorPower: 0,
  motorTemperature: 25,
  batterySoc: 80,
  batterySoh: 100,
  batteryVoltage: 72,
  batteryCurrent: 0,
  batteryPower: 0,
  batteryTemperature: 25,
  range: 0,
  regenerationPower: 0,
  regenerationActive: false,
  energyConsumed: 0,
  energyRegenerated: 0,
  consumptionWhPerKm: 0,
  driveMode: "NORMAL",
  slope: 0,
  headlight: false,
  leftIndicator: false,
  rightIndicator: false,
  hazard: false,
  warnings: [],
  warningCount: 0,
  maxSpeed: 0,
  avgSpeed: 0,
  tripTime: 0,
};

type Page = "selection" | "bike" | "car";

export default function App() {
  const [page, setPage] = useState<Page>("selection");
  const [state, setState] = useState<VehicleState>(DEFAULT_STATE);
  const [connected, setConnected] = useState(false);

  // Connect WebSocket on mount
  useEffect(() => {
    wsService.connect();
    const unsub = wsService.onStateUpdate((newState) => {
      setState(newState);
      setConnected(true);
    });

    return () => {
      unsub();
      wsService.disconnect();
    };
  }, []);

  // Vehicle selection handler
  const handleSelectVehicle = useCallback(async (type: VehicleType) => {
    // Tell the backend to switch vehicle
    try {
      await apiPost("/vehicle/type", { type });
    } catch {
      // If API fails, just send via WS
      wsService.sendCommand("vehicleType", type);
    }
    setPage(type === "BIKE" ? "bike" : "car");
  }, []);

  // Go back to selection
  const handleBack = useCallback(() => {
    setPage("selection");
  }, []);

  // Control handlers
  const handleThrottle = useCallback((v: number) => {
    wsService.sendCommand("throttle", v);
    apiPost("/vehicle/throttle", { value: v }).catch(() => {});
  }, []);

  const handleBrake = useCallback((v: number) => {
    wsService.sendCommand("brake", v);
    apiPost("/vehicle/brake", { value: v }).catch(() => {});
  }, []);

  const handleMode = useCallback((m: DriveMode) => {
    wsService.sendCommand("mode", m);
    apiPost("/vehicle/mode", { mode: m }).catch(() => {});
  }, []);

  const handleSlope = useCallback((v: number) => {
    wsService.sendCommand("slope", v);
    apiPost("/vehicle/slope", { value: v }).catch(() => {});
  }, []);

  const handleAmbient = useCallback((v: number) => {
    wsService.sendCommand("ambient", v);
    apiPost("/vehicle/ambient", { value: v }).catch(() => {});
  }, []);

  const handleControl = useCallback((control: string) => {
    wsService.sendCommand("control", undefined, { control });
    apiPost("/vehicle/control", { control }).catch(() => {});
  }, []);

  const handleReset = useCallback(() => {
    wsService.sendCommand("reset");
    apiPost("/vehicle/reset", { soc: 80, ambientTemp: 25 }).catch(() => {});
  }, []);

  const [demoMode, setDemoMode] = useState(false);

  // Connection status overlay / banner
  const ConnectionOverlay = () =>
    !connected && !demoMode ? (
      <div className="connection-overlay">
        <div className="connection-overlay__content">
          <div className="connection-overlay__spinner" />
          <p>Connecting to Digital Twin...</p>
          <p className="connection-overlay__hint">
            Start the Python server: <code>cd digital-twin && python main.py</code>
          </p>
          <button
            className="vehicle-card__btn"
            style={{
              marginTop: "16px",
              padding: "10px 20px",
              borderRadius: "9999px",
              background: "rgba(0, 229, 255, 0.15)",
              border: "1px solid rgba(0, 229, 255, 0.4)",
              color: "#00e5ff",
              cursor: "pointer",
              fontWeight: 600,
              fontFamily: "inherit",
            }}
            onClick={() => setDemoMode(true)}
          >
            🚀 Continue in Demo Mode
          </button>
        </div>
      </div>
    ) : null;

  return (
    <>
      <ConnectionOverlay />
      {page === "selection" && (
        <VehicleSelection onSelect={handleSelectVehicle} />
      )}
      {page === "bike" && (
        <BikeDashboard
          state={state}
          onBack={handleBack}
          onThrottle={handleThrottle}
          onBrake={handleBrake}
          onMode={handleMode}
          onSlope={handleSlope}
          onAmbient={handleAmbient}
          onControl={handleControl}
          onReset={handleReset}
        />
      )}
      {page === "car" && (
        <CarDashboard
          state={state}
          onBack={handleBack}
          onThrottle={handleThrottle}
          onBrake={handleBrake}
          onMode={handleMode}
          onSlope={handleSlope}
          onAmbient={handleAmbient}
          onControl={handleControl}
          onReset={handleReset}
        />
      )}
    </>
  );
}
