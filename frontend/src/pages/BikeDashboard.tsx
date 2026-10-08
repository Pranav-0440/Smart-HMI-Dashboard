/**
 * Bike Dashboard Page
 * Motorcycle-style HMI with cockpit layout.
 */
import type { VehicleState, DriveMode } from "../types/vehicle";
import Speedometer from "../components/Speedometer";
import BatteryGauge from "../components/BatteryGauge";
import MotorStats from "../components/MotorStats";
import DriveModes from "../components/DriveModes";
import RangeDisplay from "../components/RangeDisplay";
import PowerDisplay from "../components/PowerDisplay";
import VehicleControls from "../components/VehicleControls";
import Alerts from "../components/Alerts";
import SimControl from "../components/SimControl";
import VoiceAssistant from "../components/VoiceAssistant";

interface BikeDashboardProps {
  state: VehicleState;
  onBack: () => void;
  onThrottle: (v: number) => void;
  onBrake: (v: number) => void;
  onMode: (m: DriveMode) => void;
  onSlope: (v: number) => void;
  onAmbient: (v: number) => void;
  onControl: (c: string) => void;
  onReset: () => void;
}

export default function BikeDashboard({
  state,
  onBack,
  onThrottle,
  onBrake,
  onMode,
  onSlope,
  onAmbient,
  onControl,
  onReset,
}: BikeDashboardProps) {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  return (
    <div className="dashboard dashboard--bike">
      {/* Top bar */}
      <div className="dashboard__topbar">
        <button className="dashboard__back" onClick={onBack}>
          ← Back
        </button>
        <span className="dashboard__time">{timeStr}</span>
        <span className="dashboard__vehicle-name">🏍️ {state.vehicleName}</span>
        <span className="dashboard__status">
          <span className="dashboard__signal">📶</span>
          <span className="dashboard__soc-mini">🔋 {Math.round(state.batterySoc)}%</span>
          <span className="dashboard__temp-mini">
            {state.batteryTemperature.toFixed(0)}°C
          </span>
        </span>
      </div>

      {/* Main dashboard grid */}
      <div className="dashboard__main">
        {/* Left column: Battery + Range + Voice Assistant */}
        <div className="dashboard__left">
          <BatteryGauge
            soc={state.batterySoc}
            soh={state.batterySoh}
            voltage={state.batteryVoltage}
            current={state.batteryCurrent}
            temperature={state.batteryTemperature}
            power={state.batteryPower}
          />
          <RangeDisplay
            range={state.range}
            soc={state.batterySoc}
            consumptionWhPerKm={state.consumptionWhPerKm}
          />
          <VoiceAssistant
            state={state}
            onControl={onControl}
            onMode={onMode}
            onThrottle={onThrottle}
            onBrake={onBrake}
            onSlope={onSlope}
            onReset={onReset}
          />
        </div>

        {/* Center: Speedometer */}
        <div className="dashboard__center">
          <Speedometer
            speed={state.speed}
            maxSpeed={100}
            accentColor="#00e5ff"
          />
          <PowerDisplay
            motorPower={state.motorPower}
            batteryPower={state.batteryPower}
            regenPower={state.regenerationPower}
            regenActive={state.regenerationActive}
          />
        </div>

        {/* Right column: Motor */}
        <div className="dashboard__right">
          <MotorStats
            rpm={state.motorRpm}
            maxRpm={6000}
            torque={state.motorTorque}
            power={state.motorPower}
            temperature={state.motorTemperature}
            maxTemp={120}
          />
        </div>
      </div>

      {/* Drive modes */}
      <DriveModes activeMode={state.driveMode} onChange={onMode} />

      {/* Controls bar */}
      <VehicleControls state={state} onToggle={onControl} />

      {/* Alerts */}
      <Alerts warnings={state.warnings} />

      {/* Sim control panel */}
      <SimControl
        state={state}
        onThrottle={onThrottle}
        onBrake={onBrake}
        onMode={onMode}
        onSlope={onSlope}
        onAmbient={onAmbient}
        onReset={onReset}
      />
    </div>
  );
}
