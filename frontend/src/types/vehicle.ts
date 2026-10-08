/**
 * Vehicle State Interface — shared by both BIKE and CAR
 */
export type VehicleType = "BIKE" | "CAR";
export type DriveMode = "ECO" | "NORMAL" | "SPORT";

export interface VehicleState {
  // Identity
  vehicleType: VehicleType;
  vehicleName: string;
  timestamp: number;

  // Speed & Motion
  speed: number;
  acceleration: number;
  distance: number;

  // Driver Inputs
  throttle: number;
  brake: number;

  // Motor
  motorRpm: number;
  motorTorque: number;
  motorPower: number;
  motorTemperature: number;

  // Battery
  batterySoc: number;
  batterySoh: number;
  batteryVoltage: number;
  batteryCurrent: number;
  batteryPower: number;
  batteryTemperature: number;

  // Range
  range: number;

  // Regeneration
  regenerationPower: number;
  regenerationActive: boolean;

  // Energy
  energyConsumed: number;
  energyRegenerated: number;
  consumptionWhPerKm: number;

  // Drive Mode
  driveMode: DriveMode;
  slope: number;

  // Controls
  headlight: boolean;
  leftIndicator: boolean;
  rightIndicator: boolean;
  hazard: boolean;

  // Warnings
  warnings: string[];
  warningCount: number;

  // Trip
  maxSpeed: number;
  avgSpeed: number;
  tripTime: number;

  // Bike-specific
  sideStand?: boolean;
  helmetOn?: boolean;
  speedLimiter?: number;
  horn?: boolean;

  // Car-specific
  doorsLocked?: boolean;
  seatBelt?: boolean;
  parkingBrake?: boolean;
  climateOn?: boolean;
  climateTemp?: number;
  cruiseControl?: boolean;
  cruiseSpeed?: number;
}

export interface TripSummary {
  vehicleType: VehicleType;
  distance_km: number;
  duration_s: number;
  energy_consumed_wh: number;
  energy_regenerated_wh: number;
  net_energy_wh: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  efficiency_wh_per_km: number;
  final_soc: number;
}
