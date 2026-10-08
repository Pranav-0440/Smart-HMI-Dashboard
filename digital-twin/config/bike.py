"""
Electric Bike / 2-Wheeler Configuration
========================================
Parameters for a typical electric scooter/bike.
Replace with real vehicle specs when available.
"""

BIKE = {
    # ── Identity ──────────────────────────────────────────────
    "vehicle_type": "BIKE",
    "vehicle_name": "EV-BIKE 2W",

    # ── Mechanical ────────────────────────────────────────────
    "mass": 190.0,                  # kg (bike + rider)
    "wheel_radius": 0.30,           # m
    "drag_coefficient": 0.70,       # Cd
    "frontal_area": 0.60,           # m²
    "rolling_resistance": 0.015,    # Crr
    "gear_ratio": 9.0,
    "max_speed": 100.0,             # km/h

    # ── Battery ───────────────────────────────────────────────
    "battery_capacity": 4.0,        # kWh
    "battery_voltage_nominal": 72.0,  # V
    "battery_voltage_max": 84.0,    # V
    "battery_voltage_min": 60.0,    # V
    "battery_resistance": 0.05,     # Ω  (internal resistance)
    "battery_cells_series": 20,
    "battery_cells_parallel": 4,

    # ── Motor ─────────────────────────────────────────────────
    "motor_power_max": 8.0,         # kW
    "motor_torque_max": 30.0,       # Nm
    "motor_rpm_max": 6000,
    "motor_efficiency": 0.90,
    "motor_thermal_resistance": 0.8,  # °C/W
    "motor_thermal_capacitance": 800, # J/°C
    "motor_max_temperature": 120.0,   # °C

    # ── Battery Thermal ───────────────────────────────────────
    "battery_thermal_resistance": 1.2,  # °C/W
    "battery_thermal_capacitance": 5000, # J/°C
    "battery_max_temperature": 60.0,     # °C

    # ── Regeneration ──────────────────────────────────────────
    "regen_max_power": 5.0,         # kW
    "regen_efficiency": 0.70,
    "regen_min_speed": 5.0,         # km/h (no regen below this)

    # ── Drive Modes ───────────────────────────────────────────
    "drive_modes": {
        "ECO":    {"power_limit": 0.50, "regen_factor": 1.0, "speed_limit": 45.0},
        "NORMAL": {"power_limit": 0.75, "regen_factor": 0.7, "speed_limit": 80.0},
        "SPORT":  {"power_limit": 1.00, "regen_factor": 0.5, "speed_limit": 100.0},
    },

    # ── Safety Thresholds ─────────────────────────────────────
    "speed_limit_warning": 80.0,    # km/h
    "soc_low_warning": 20.0,        # %
    "soc_critical_warning": 10.0,   # %

    # ── Bike-Specific Features ────────────────────────────────
    "has_side_stand": True,
    "has_helmet_detection": True,
    "speed_limiter_default": 80.0,  # km/h
}
