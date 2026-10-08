"""
Core Simulator
==============
The universal simulation engine that drives both BIKE and CAR digital twins.
Runs the Virtual ECU loop at 50ms intervals, producing vehicle state JSON.
"""

import time
import json
import math
from typing import Optional, Callable

from models.vehicle import Vehicle
from models.motor import Motor
from models.battery import Battery
from models.thermal import ThermalModel
from models.regeneration import RegenerationModel
from physics.dynamics import dynamics_step
from physics.energy import EnergyTracker


class Simulator:
    """
    Universal EV Digital Twin Simulator.

    Works for both BIKE and CAR — the config dict determines the vehicle.
    """

    def __init__(self, config: dict, dt: float = 0.05):
        """
        Args:
            config: vehicle configuration dict (from bike.py or car.py)
            dt: simulation time step in seconds (default 50ms)
        """
        self.config = config
        self.dt = dt
        self.vehicle_type = config["vehicle_type"]

        # ── Subsystem models ──────────────────────────────────
        self.vehicle = Vehicle(config)
        self.motor = Motor(config)
        self.battery = Battery(config)
        self.thermal = ThermalModel(config)
        self.regen = RegenerationModel(config)
        self.energy = EnergyTracker()

        # ── Driver inputs ─────────────────────────────────────
        self.throttle: float = 0.0          # 0.0 to 1.0
        self.brake: float = 0.0             # 0.0 to 1.0
        self.drive_mode: str = "NORMAL"
        self.slope_percent: float = 0.0     # road gradient

        # ── Vehicle-specific controls ─────────────────────────
        self.headlight: bool = False
        self.left_indicator: bool = False
        self.right_indicator: bool = False
        self.hazard: bool = False
        self.horn: bool = False

        # Bike-specific
        self.side_stand: bool = False
        self.helmet_on: bool = True
        self.speed_limiter: float = config.get("speed_limiter_default", 80.0)

        # Car-specific
        self.doors_locked: bool = True
        self.seat_belt: bool = True
        self.parking_brake: bool = False
        self.climate_on: bool = False
        self.climate_temp: float = 24.0
        self.cruise_control: bool = False
        self.cruise_speed: float = 0.0

        # ── Alerts ────────────────────────────────────────────
        self.warnings: list = []

        # ── Simulation state ──────────────────────────────────
        self.running: bool = False
        self.tick_count: int = 0
        self.sim_time: float = 0.0  # seconds

        # ── Trip data ─────────────────────────────────────────
        self.trip_start_time: float = 0.0
        self.max_speed: float = 0.0
        self._speed_sum: float = 0.0

        # ── Callbacks ─────────────────────────────────────────
        self._on_state_update: Optional[Callable] = None

    def set_on_state_update(self, callback: Callable) -> None:
        """Register callback for each state update."""
        self._on_state_update = callback

    # ── Driver Controls ───────────────────────────────────────

    def set_throttle(self, value: float) -> None:
        """Set throttle position (0–100%)."""
        self.throttle = max(0.0, min(1.0, value / 100.0))

    def set_brake(self, value: float) -> None:
        """Set brake position (0–100%)."""
        self.brake = max(0.0, min(1.0, value / 100.0))

    def set_drive_mode(self, mode: str) -> None:
        """Set drive mode: ECO, NORMAL, SPORT."""
        if mode in self.config.get("drive_modes", {}):
            self.drive_mode = mode

    def set_slope(self, percent: float) -> None:
        """Set road slope (-30% to +30%)."""
        self.slope_percent = max(-30.0, min(30.0, percent))

    def set_ambient_temperature(self, temp: float) -> None:
        """Set ambient temperature."""
        self.thermal.set_ambient(temp)

    def set_initial_soc(self, soc: float) -> None:
        """Set initial battery SOC."""
        self.battery.reset(initial_soc=soc,
                           ambient_temp=self.thermal.ambient_temperature)

    # ── Safety Checks ─────────────────────────────────────────

    def _check_warnings(self) -> list:
        """Generate warnings based on current state."""
        warnings = []

        # Common warnings
        if self.battery.is_critical:
            warnings.append("CRITICAL: BATTERY CRITICALLY LOW")
        elif self.battery.is_low:
            warnings.append("WARNING: LOW BATTERY")

        if self.battery.is_overheated:
            warnings.append("DANGER: BATTERY OVERHEATING")

        if self.motor.is_overheated:
            warnings.append("DANGER: MOTOR OVERHEATING")

        speed_warning = self.config.get("speed_limit_warning", 80.0)
        if self.vehicle.speed > speed_warning:
            warnings.append("WARNING: OVERSPEED")

        # Bike-specific warnings
        if self.vehicle_type == "BIKE":
            if self.side_stand and self.vehicle.speed > 0:
                warnings.append("DANGER: SIDE STAND DOWN")
            if not self.helmet_on and self.vehicle.speed > 0:
                warnings.append("WARNING: HELMET NOT DETECTED")

        # Car-specific warnings
        if self.vehicle_type == "CAR":
            if not self.seat_belt and self.vehicle.speed > 0:
                warnings.append("WARNING: SEAT BELT NOT FASTENED")
            if not self.doors_locked and self.vehicle.speed > 10:
                warnings.append("WARNING: DOORS UNLOCKED")
            if self.parking_brake and self.vehicle.speed > 5:
                warnings.append("WARNING: PARKING BRAKE ENGAGED")

        return warnings

    def _should_block_drive(self) -> bool:
        """Check if driving should be blocked for safety."""
        if self.vehicle_type == "BIKE":
            if self.side_stand:
                return True
        if self.vehicle_type == "CAR":
            if self.parking_brake and self.throttle > 0:
                return True
        return False

    # ── Physics Step ──────────────────────────────────────────

    def step(self) -> dict:
        """
        Execute one simulation step (the Virtual ECU loop).

        Returns:
            Complete vehicle state as a dict
        """
        self.tick_count += 1
        self.sim_time += self.dt

        # Safety interlock
        effective_throttle = self.throttle
        if self._should_block_drive():
            effective_throttle = 0.0

        # Run physics
        drive_modes = self.config.get("drive_modes", {})
        dynamics_step(
            effective_throttle, self.brake,
            self.vehicle, self.motor, self.battery,
            self.regen, self.thermal,
            self.drive_mode, drive_modes,
            self.slope_percent, self.dt
        )

        # Energy tracking
        self.energy.update(
            self.motor.electrical_power_kw,
            self.regen.regen_power_kw,
            self.vehicle.distance_travelled,
            self.dt
        )

        # Trip stats
        if self.vehicle.speed > self.max_speed:
            self.max_speed = self.vehicle.speed
        self._speed_sum += self.vehicle.speed

        # Range estimate
        estimated_range = self.battery.estimate_range(
            self.energy.average_power_kw,
            max(self.vehicle.speed, 30.0)  # assume 30 km/h if stationary
        )

        # Warnings
        self.warnings = self._check_warnings()

        # Build state
        state = self._build_state(estimated_range)

        # Callback
        if self._on_state_update:
            self._on_state_update(state)

        return state

    def _build_state(self, estimated_range: float) -> dict:
        """Build the universal vehicle state JSON."""
        state = {
            # Identity
            "vehicleType": self.vehicle_type,
            "vehicleName": self.config.get("vehicle_name", self.vehicle_type),
            "timestamp": time.time(),

            # Speed & Motion
            "speed": round(self.vehicle.speed, 1),
            "acceleration": round(self.vehicle.acceleration, 2),
            "distance": round(self.vehicle.distance_travelled, 2),

            # Driver Inputs
            "throttle": round(self.throttle * 100, 1),
            "brake": round(self.brake * 100, 1),

            # Motor
            "motorRpm": round(self.motor.rpm),
            "motorTorque": round(self.motor.torque, 1),
            "motorPower": round(self.motor.power_kw, 2),
            "motorTemperature": round(self.motor.temperature, 1),

            # Battery
            "batterySoc": round(self.battery.soc, 1),
            "batterySoh": round(self.battery.soh, 1),
            "batteryVoltage": round(self.battery.voltage, 1),
            "batteryCurrent": round(self.battery.current, 1),
            "batteryPower": round(self.battery.power_kw, 2),
            "batteryTemperature": round(self.battery.temperature, 1),

            # Range
            "range": round(max(0, estimated_range), 1),

            # Regeneration
            "regenerationPower": round(self.regen.regen_power_kw, 2),
            "regenerationActive": self.regen.is_active,

            # Energy
            "energyConsumed": round(self.energy.net_consumed_wh, 1),
            "energyRegenerated": round(self.energy.total_regenerated_wh, 1),
            "consumptionWhPerKm": round(self.energy.consumption_wh_per_km, 1),

            # Drive Mode
            "driveMode": self.drive_mode,
            "slope": self.slope_percent,

            # Controls
            "headlight": self.headlight,
            "leftIndicator": self.left_indicator,
            "rightIndicator": self.right_indicator,
            "hazard": self.hazard,

            # Warnings
            "warnings": self.warnings,
            "warningCount": len(self.warnings),

            # Trip
            "maxSpeed": round(self.max_speed, 1),
            "avgSpeed": round(self._speed_sum / max(1, self.tick_count), 1),
            "tripTime": round(self.sim_time, 1),
        }

        # Bike-specific state
        if self.vehicle_type == "BIKE":
            state.update({
                "sideStand": self.side_stand,
                "helmetOn": self.helmet_on,
                "speedLimiter": self.speed_limiter,
                "horn": self.horn,
            })

        # Car-specific state
        if self.vehicle_type == "CAR":
            state.update({
                "doorsLocked": self.doors_locked,
                "seatBelt": self.seat_belt,
                "parkingBrake": self.parking_brake,
                "climateOn": self.climate_on,
                "climateTemp": self.climate_temp,
                "cruiseControl": self.cruise_control,
                "cruiseSpeed": self.cruise_speed,
            })

        return state

    # ── Trip Summary ──────────────────────────────────────────

    def get_trip_summary(self) -> dict:
        """Generate a trip summary report."""
        return {
            "vehicleType": self.vehicle_type,
            "distance_km": round(self.vehicle.distance_travelled, 2),
            "duration_s": round(self.sim_time, 1),
            "energy_consumed_wh": round(self.energy.total_consumed_wh, 1),
            "energy_regenerated_wh": round(self.energy.total_regenerated_wh, 1),
            "net_energy_wh": round(self.energy.net_consumed_wh, 1),
            "avg_speed_kmh": round(self._speed_sum / max(1, self.tick_count), 1),
            "max_speed_kmh": round(self.max_speed, 1),
            "efficiency_wh_per_km": round(self.energy.consumption_wh_per_km, 1),
            "final_soc": round(self.battery.soc, 1),
        }

    # ── Reset ─────────────────────────────────────────────────

    def reset(self, initial_soc: float = 80.0) -> None:
        """Reset all models to initial state."""
        ambient = self.thermal.ambient_temperature
        self.vehicle.reset()
        self.motor.reset(ambient)
        self.battery.reset(initial_soc, ambient)
        self.thermal.reset(ambient)
        self.regen.reset()
        self.energy.reset()

        self.throttle = 0.0
        self.brake = 0.0
        self.drive_mode = "NORMAL"
        self.slope_percent = 0.0
        self.warnings = []
        self.tick_count = 0
        self.sim_time = 0.0
        self.max_speed = 0.0
        self._speed_sum = 0.0

    def state_json(self) -> str:
        """Return current state as JSON string."""
        return json.dumps(self.step(), indent=2)

    def __repr__(self) -> str:
        return (
            f"Simulator({self.vehicle_type}: "
            f"{self.vehicle.speed:.1f} km/h, "
            f"SOC={self.battery.soc:.1f}%)"
        )
