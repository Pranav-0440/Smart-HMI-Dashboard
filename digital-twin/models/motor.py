"""
Universal Motor Model
=====================
Calculates torque, power, RPM, temperature for any EV motor.
Parameters come from vehicle config.
"""

import math


class Motor:
    """Electric motor model — common for BIKE and CAR."""

    def __init__(self, config: dict):
        self.power_max: float = config["motor_power_max"] * 1000.0  # W
        self.torque_max: float = config["motor_torque_max"]          # Nm
        self.rpm_max: int = config["motor_rpm_max"]
        self.efficiency: float = config["motor_efficiency"]

        # Thermal
        self.thermal_resistance: float = config.get("motor_thermal_resistance", 0.5)
        self.thermal_capacitance: float = config.get("motor_thermal_capacitance", 1500)
        self.max_temperature: float = config.get("motor_max_temperature", 130.0)

        # ── Live state ────────────────────────────────────────
        self.torque: float = 0.0             # Nm
        self.power: float = 0.0              # W
        self.rpm: float = 0.0                # RPM
        self.temperature: float = 25.0       # °C
        self.is_overheated: bool = False

    def calculate_torque(self, total_force: float, wheel_radius: float,
                         gear_ratio: float) -> float:
        """
        Derive motor torque from total wheel force.

        Motor torque = (Force × wheel_radius) / gear_ratio
        """
        wheel_torque = total_force * wheel_radius
        motor_torque = wheel_torque / gear_ratio
        self.torque = max(0.0, min(motor_torque, self.torque_max))
        return self.torque

    def calculate_power(self, rpm: float) -> float:
        """
        P = Torque × ω    where ω = 2π × RPM / 60

        Returns power in Watts.
        """
        self.rpm = min(rpm, self.rpm_max)
        if self.rpm <= 0:
            self.power = 0.0
            return 0.0
        omega = 2.0 * math.pi * self.rpm / 60.0
        mechanical_power = self.torque * omega
        self.power = min(mechanical_power, self.power_max)
        return self.power

    @property
    def electrical_power(self) -> float:
        """Electrical power drawn from battery = mechanical / efficiency."""
        if self.efficiency <= 0:
            return self.power
        return self.power / self.efficiency

    @property
    def power_loss(self) -> float:
        """Heat generated = electrical power − mechanical power."""
        return max(0.0, self.electrical_power - self.power)

    @property
    def power_kw(self) -> float:
        """Mechanical power in kW."""
        return self.power / 1000.0

    @property
    def electrical_power_kw(self) -> float:
        """Electrical power in kW."""
        return self.electrical_power / 1000.0

    def update_temperature(self, ambient_temp: float, dt: float) -> None:
        """
        Simple lumped thermal model:
          dT/dt = (Q_loss − Q_cooling) / C_thermal
        where
          Q_cooling = (T_motor − T_ambient) / R_thermal
        """
        q_loss = self.power_loss
        q_cooling = (self.temperature - ambient_temp) / self.thermal_resistance
        dT = (q_loss - q_cooling) / self.thermal_capacitance * dt
        self.temperature += dT
        self.temperature = max(ambient_temp, self.temperature)
        self.is_overheated = self.temperature >= self.max_temperature

    def reset(self, ambient_temp: float = 25.0) -> None:
        self.torque = 0.0
        self.power = 0.0
        self.rpm = 0.0
        self.temperature = ambient_temp
        self.is_overheated = False

    def __repr__(self) -> str:
        return (
            f"Motor({self.power_kw:.1f} kW, "
            f"{self.rpm:.0f} RPM, "
            f"{self.torque:.1f} Nm, "
            f"{self.temperature:.1f}°C)"
        )
