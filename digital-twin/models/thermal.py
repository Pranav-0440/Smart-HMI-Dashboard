"""
Thermal Model
=============
Manages ambient conditions and coordinates thermal updates
for motor and battery. Can be extended with cooling systems.
"""


class ThermalModel:
    """Coordinates thermal behaviour across all subsystems."""

    def __init__(self, config: dict):
        self.ambient_temperature: float = 25.0  # °C  (can be changed by simulator)

        # Cooling parameters (future: active cooling)
        self.cooling_active: bool = False
        self.cooling_power: float = 0.0  # W

    def set_ambient(self, temp: float) -> None:
        """Set ambient/environmental temperature."""
        self.ambient_temperature = temp

    def update(self, motor, battery, dt: float) -> None:
        """
        Update temperatures for motor and battery.

        Args:
            motor: Motor instance
            battery: Battery instance
            dt: time step in seconds
        """
        motor.update_temperature(self.ambient_temperature, dt)
        battery.update_temperature(self.ambient_temperature, dt)

    def reset(self, ambient: float = 25.0) -> None:
        self.ambient_temperature = ambient
        self.cooling_active = False

    def __repr__(self) -> str:
        return f"Thermal(ambient={self.ambient_temperature:.1f}°C)"
