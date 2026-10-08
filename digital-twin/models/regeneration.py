"""
Regenerative Braking Model
===========================
Handles energy recovery during braking / coasting / downhill.
Same algorithm for BIKE and CAR — only max regen power differs.
"""


class RegenerationModel:
    """Regenerative braking — returns energy to the battery."""

    def __init__(self, config: dict):
        self.max_power: float = config.get("regen_max_power", 5.0) * 1000.0  # W
        self.efficiency: float = config.get("regen_efficiency", 0.70)
        self.min_speed: float = config.get("regen_min_speed", 5.0)  # km/h

        # ── Live state ────────────────────────────────────────
        self.regen_power: float = 0.0       # W  (power being recovered)
        self.is_active: bool = False
        self.total_energy_recovered: float = 0.0  # Wh

    def calculate(self, speed_kmh: float, brake_input: float,
                  motor_power_w: float, drive_mode: dict,
                  battery_soc: float) -> float:
        """
        Calculate regeneration power.

        Args:
            speed_kmh: current vehicle speed
            brake_input: brake pedal/lever position (0.0 to 1.0)
            motor_power_w: current motor mechanical power (W)
            drive_mode: drive mode dict with 'regen_factor'
            battery_soc: current SOC (%) — reduce regen near 100%

        Returns:
            Regeneration power in Watts (negative = charging battery)
        """
        self.is_active = False
        self.regen_power = 0.0

        # No regen below minimum speed
        if speed_kmh < self.min_speed:
            return 0.0

        # No regen if battery is nearly full
        if battery_soc >= 95.0:
            return 0.0

        # Regen only during braking (or coasting with high regen mode)
        if brake_input <= 0.0:
            return 0.0

        # Regen power proportional to brake input and available kinetic energy
        regen_factor = drive_mode.get("regen_factor", 0.7)
        raw_regen = brake_input * self.max_power * regen_factor

        # Apply efficiency
        actual_regen = raw_regen * self.efficiency

        # Cap to max
        actual_regen = min(actual_regen, self.max_power)

        # Taper near full SOC
        if battery_soc > 80.0:
            taper = (95.0 - battery_soc) / 15.0
            actual_regen *= max(0.0, taper)

        self.regen_power = actual_regen
        self.is_active = actual_regen > 0
        return actual_regen

    def update_energy(self, dt: float) -> None:
        """Track total energy recovered."""
        if self.is_active:
            self.total_energy_recovered += self.regen_power * dt / 3600.0  # Wh

    @property
    def regen_power_kw(self) -> float:
        return self.regen_power / 1000.0

    def reset(self) -> None:
        self.regen_power = 0.0
        self.is_active = False
        self.total_energy_recovered = 0.0

    def __repr__(self) -> str:
        status = "ON" if self.is_active else "OFF"
        return f"Regen({status}, {self.regen_power_kw:.1f} kW)"
