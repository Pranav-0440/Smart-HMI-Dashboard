"""
Universal Battery Model
=======================
SOC, SOH, voltage, current, power, temperature — works for any EV battery.
4 kWh @ 72 V (bike) or 60 kWh @ 400 V (car) — same algorithm.
"""

import math


class Battery:
    """Lithium-ion battery pack model — common for BIKE and CAR."""

    def __init__(self, config: dict):
        # ── Pack parameters ───────────────────────────────────
        self.capacity: float = config["battery_capacity"]                # kWh
        self.capacity_wh: float = self.capacity * 1000.0                 # Wh
        self.voltage_nominal: float = config["battery_voltage_nominal"]  # V
        self.voltage_max: float = config.get("battery_voltage_max",
                                             self.voltage_nominal * 1.17)
        self.voltage_min: float = config.get("battery_voltage_min",
                                             self.voltage_nominal * 0.83)
        self.internal_resistance: float = config["battery_resistance"]   # Ω

        # Thermal
        self.thermal_resistance: float = config.get("battery_thermal_resistance", 1.0)
        self.thermal_capacitance: float = config.get("battery_thermal_capacitance", 10000)
        self.max_temperature: float = config.get("battery_max_temperature", 60.0)

        # ── Live state ────────────────────────────────────────
        self.soc: float = 80.0              # % (start at 80%)
        self.soh: float = 100.0             # % (brand new)
        self.voltage: float = self.voltage_nominal  # V
        self.current: float = 0.0           # A  (positive = discharging)
        self.power: float = 0.0             # W
        self.temperature: float = 25.0      # °C
        self.energy_consumed: float = 0.0   # Wh (trip)
        self.energy_regenerated: float = 0.0  # Wh (trip)
        self.is_overheated: bool = False
        self.is_low: bool = False
        self.is_critical: bool = False

        # Thresholds from config
        self._soc_low = config.get("soc_low_warning", 20.0)
        self._soc_critical = config.get("soc_critical_warning", 10.0)

    def _soc_to_voltage(self) -> float:
        """
        Map SOC → terminal voltage using a simplified OCV curve.
        Linear interpolation between V_min (SOC=0) and V_max (SOC=100).
        Real BMS uses lookup tables; this is sufficient for simulation.
        """
        soc_fraction = self.soc / 100.0
        ocv = self.voltage_min + (self.voltage_max - self.voltage_min) * soc_fraction
        # Subtract internal resistance drop
        ir_drop = self.current * self.internal_resistance
        self.voltage = max(self.voltage_min, ocv - ir_drop)
        return self.voltage

    def update(self, electrical_power: float, dt: float) -> None:
        """
        Update battery state for one time step.

        Args:
            electrical_power: power drawn from battery in Watts
                              (positive = discharging, negative = charging/regen)
            dt: time step in seconds
        """
        self.power = electrical_power

        # Current
        if self.voltage > 0:
            self.current = electrical_power / self.voltage
        else:
            self.current = 0.0

        # Energy consumed this step (Wh)
        energy_step = electrical_power * dt / 3600.0  # Ws → Wh

        if electrical_power >= 0:
            self.energy_consumed += energy_step
        else:
            self.energy_regenerated += abs(energy_step)

        # SOC update
        usable_capacity = self.capacity_wh * (self.soh / 100.0)
        if usable_capacity > 0:
            soc_change = (energy_step / usable_capacity) * 100.0
            self.soc -= soc_change  # discharge → SOC decreases
            self.soc = max(0.0, min(100.0, self.soc))

        # Voltage update
        self._soc_to_voltage()

        # Warnings
        self.is_low = self.soc <= self._soc_low
        self.is_critical = self.soc <= self._soc_critical

    def charge(self, power_w: float, dt: float) -> None:
        """Charge the battery (power is positive, SOC increases)."""
        self.update(-abs(power_w), dt)

    @property
    def i2r_loss(self) -> float:
        """Resistive heat loss: I²R in Watts."""
        return self.current ** 2 * self.internal_resistance

    def update_temperature(self, ambient_temp: float, dt: float) -> None:
        """
        Lumped thermal model for battery pack.
          dT/dt = (I²R − Q_cooling) / C_thermal
        """
        q_loss = self.i2r_loss
        q_cooling = (self.temperature - ambient_temp) / self.thermal_resistance
        dT = (q_loss - q_cooling) / self.thermal_capacitance * dt
        self.temperature += dT
        self.temperature = max(ambient_temp, self.temperature)
        self.is_overheated = self.temperature >= self.max_temperature

    def estimate_range(self, avg_power_kw: float, speed_kmh: float) -> float:
        """
        Estimate remaining range in km.

        Range = (remaining_energy / avg_power) × speed
        """
        if avg_power_kw <= 0 or speed_kmh <= 0:
            # Fallback: use nominal range based on SOC
            wh_per_km_nominal = self.capacity_wh / (self.capacity * 6.0)  # rough
            remaining_wh = self.capacity_wh * (self.soc / 100.0) * (self.soh / 100.0)
            if wh_per_km_nominal > 0:
                return remaining_wh / wh_per_km_nominal
            return 0.0

        remaining_energy_kwh = self.capacity * (self.soc / 100.0) * (self.soh / 100.0)
        hours_remaining = remaining_energy_kwh / avg_power_kw
        return hours_remaining * speed_kmh

    def reset(self, initial_soc: float = 80.0, ambient_temp: float = 25.0) -> None:
        self.soc = initial_soc
        self.voltage = self._soc_to_voltage()
        self.current = 0.0
        self.power = 0.0
        self.temperature = ambient_temp
        self.energy_consumed = 0.0
        self.energy_regenerated = 0.0
        self.is_overheated = False
        self.is_low = False
        self.is_critical = False

    @property
    def power_kw(self) -> float:
        return self.power / 1000.0

    def __repr__(self) -> str:
        return (
            f"Battery(SOC={self.soc:.1f}%, "
            f"{self.voltage:.1f}V, "
            f"{self.current:.1f}A, "
            f"{self.temperature:.1f}°C)"
        )
