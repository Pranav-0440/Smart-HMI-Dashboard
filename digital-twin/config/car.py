"""
Electric Car / 4-Wheeler Configuration
=======================================
Parameters for a typical electric sedan/hatchback.
Replace with real vehicle specs when available.
"""

CAR = {
    # ── Identity ──────────────────────────────────────────────
    "vehicle_type": "CAR",
    "vehicle_name": "EV-CAR 4W",

    # ── Mechanical ────────────────────────────────────────────
    "mass": 1500.0,                 # kg (car + driver)
    "wheel_radius": 0.32,           # m
    "drag_coefficient": 0.28,       # Cd
    "frontal_area": 2.2,            # m²
    "rolling_resistance": 0.012,    # Crr
    "gear_ratio": 9.0,
    "max_speed": 160.0,             # km/h

    # ── Battery ───────────────────────────────────────────────
    "battery_capacity": 60.0,       # kWh
    "battery_voltage_nominal": 400.0,  # V
    "battery_voltage_max": 450.0,   # V
    "battery_voltage_min": 320.0,   # V
    "battery_resistance": 0.08,     # Ω  (internal resistance)
    "battery_cells_series": 96,
    "battery_cells_parallel": 46,

    # ── Motor ─────────────────────────────────────────────────
    "motor_power_max": 100.0,       # kW
    "motor_torque_max": 310.0,      # Nm
    "motor_rpm_max": 12000,
    "motor_efficiency": 0.92,
    "motor_thermal_resistance": 0.3,  # °C/W
    "motor_thermal_capacitance": 3000, # J/°C
    "motor_max_temperature": 150.0,   # °C

    # ── Battery Thermal ───────────────────────────────────────
    "battery_thermal_resistance": 0.5,  # °C/W
    "battery_thermal_capacitance": 30000, # J/°C
    "battery_max_temperature": 55.0,     # °C

    # ── Regeneration ──────────────────────────────────────────
    "regen_max_power": 50.0,        # kW
    "regen_efficiency": 0.75,
    "regen_min_speed": 8.0,         # km/h

    # ── Drive Modes ───────────────────────────────────────────
    "drive_modes": {
        "ECO":    {"power_limit": 0.50, "regen_factor": 1.0, "speed_limit": 100.0},
        "NORMAL": {"power_limit": 0.75, "regen_factor": 0.7, "speed_limit": 140.0},
        "SPORT":  {"power_limit": 1.00, "regen_factor": 0.5, "speed_limit": 160.0},
    },

    # ── Safety Thresholds ─────────────────────────────────────
    "speed_limit_warning": 120.0,   # km/h
    "soc_low_warning": 20.0,        # %
    "soc_critical_warning": 10.0,   # %

    # ── Car-Specific Features ─────────────────────────────────
    "has_climate_control": True,
    "has_cruise_control": True,
    "has_parking_brake": True,
    "num_doors": 4,
    "num_seats": 5,
    "tire_pressure_nominal": 2.4,   # bar
}
