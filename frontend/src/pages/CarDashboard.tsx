/**
 * Car Dashboard Page
 * Automotive infotainment-style HMI with wider layout.
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
import SettingsWidget, { type DashboardTheme } from "../components/SettingsWidget";
import type { AssistantLanguage } from "../services/voiceAssistant";

interface CarDashboardProps {
  state: VehicleState;
  onBack: () => void;
  onThrottle: (v: number) => void;
  onBrake: (v: number) => void;
  onMode: (m: DriveMode) => void;
  onSlope: (v: number) => void;
  onAmbient: (v: number) => void;
  onControl: (c: string) => void;
  onReset: () => void;
  theme?: DashboardTheme;
  onThemeChange?: (t: DashboardTheme) => void;
  language?: AssistantLanguage;
  onLanguageChange?: (l: AssistantLanguage) => void;
  voiceEnabled?: boolean;
  onVoiceToggle?: (v: boolean) => void;
}

export default function CarDashboard({
  state,
  onBack,
  onThrottle,
  onBrake,
  onMode,
  onSlope,
  onAmbient,
  onControl,
  onReset,
  theme = "dark",
  onThemeChange = () => {},
  language = "en",
  onLanguageChange = () => {},
  voiceEnabled = true,
  onVoiceToggle = () => {},
}: CarDashboardProps) {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  return (
    <div className="dashboard dashboard--car">
      {/* Top bar */}
      <div className="dashboard__topbar dashboard__topbar--car">
        <button className="dashboard__back" onClick={onBack}>
          ← Back
        </button>
        <span className="dashboard__vehicle-name">🚗 {state.vehicleName}</span>
        <span className="dashboard__gear">D</span>
        <span className="dashboard__status">
          <span className="dashboard__soc-mini">🔋 {Math.round(state.batterySoc)}%</span>
          <span className="dashboard__temp-mini">
            {state.batteryTemperature.toFixed(0)}°C
          </span>
          <span className="dashboard__time">{timeStr}</span>
        </span>
      </div>

      {/* Main dashboard grid — wider layout for car */}
      <div className="dashboard__main dashboard__main--car">
        {/* Left: Battery + Energy */}
        <div className="dashboard__left dashboard__left--car">
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
            language={language}
            onLanguageChange={onLanguageChange}
            voiceEnabled={voiceEnabled}
            onVoiceToggle={onVoiceToggle}
          />
        </div>

        {/* Center: Speed */}
        <div className="dashboard__center">
          <Speedometer
            speed={state.speed}
            maxSpeed={160}
            size={280}
            accentColor="#448aff"
          />
          <PowerDisplay
            motorPower={state.motorPower}
            batteryPower={state.batteryPower}
            regenPower={state.regenerationPower}
            regenActive={state.regenerationActive}
          />
        </div>

        {/* Right: Motor + Car-specific + Settings */}
        <div className="dashboard__right dashboard__right--car">
          <MotorStats
            rpm={state.motorRpm}
            maxRpm={12000}
            torque={state.motorTorque}
            power={state.motorPower}
            temperature={state.motorTemperature}
            maxTemp={150}
          />

          {/* Car-specific info */}
          <div className="car-info">
            {state.climateOn && (
              <div className="car-info__item">
                <span>❄ Climate</span>
                <span>{state.climateTemp}°C</span>
              </div>
            )}
            {state.cruiseControl && (
              <div className="car-info__item">
                <span>🚀 Cruise</span>
                <span>{state.cruiseSpeed?.toFixed(0)} km/h</span>
              </div>
            )}
            <div className="car-info__item">
              <span>🚪 Doors</span>
              <span>{state.doorsLocked ? "Locked" : "Unlocked"}</span>
            </div>
            <div className="car-info__item">
              <span>🪢 Belt</span>
              <span style={{ color: state.seatBelt ? "#00e676" : "#ff1744" }}>
                {state.seatBelt ? "On" : "Off"}
              </span>
            </div>
          </div>

          <SettingsWidget
            theme={theme}
            onThemeChange={onThemeChange}
            language={language}
            onLanguageChange={onLanguageChange}
            voiceEnabled={voiceEnabled}
            onVoiceToggle={onVoiceToggle}
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
