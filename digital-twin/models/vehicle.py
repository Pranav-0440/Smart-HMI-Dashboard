"""
Universal Vehicle Model
=======================
A single Vehicle class that represents BOTH 2-wheelers and 4-wheelers.
Parameters are injected from config/bike.py or config/car.py.
"""

import math


class Vehicle:
    """Common vehicle model — works for both BIKE and CAR."""

    def __init__(self, config: dict):
        # ── Identity ──────────────────────────────────────────
        self.vehicle_type: str = config["vehicle_type"]
        self.vehicle_name: str = config.get("vehicle_name", self.vehicle_type)

        # ── Mechanical parameters ─────────────────────────────
        self.mass: float = config["mass"]                        # kg
        self.wheel_radius: float = config["wheel_radius"]        # m
        self.drag_coefficient: float = config["drag_coefficient"]  # Cd
        self.frontal_area: float = config["frontal_area"]        # m²
        self.rolling_resistance: float = config["rolling_resistance"]  # Crr
        self.gear_ratio: float = config["gear_ratio"]
        self.max_speed: float = config["max_speed"]              # km/h

        # ── Live state ────────────────────────────────────────
        self.speed: float = 0.0              # km/h
        self.acceleration: float = 0.0       # m/s²
        self.distance_travelled: float = 0.0  # km
        self.heading: float = 0.0            # degrees

    @property
    def speed_ms(self) -> float:
        """Current speed in m/s."""
        return self.speed * 1000.0 / 3600.0

    @property
    def wheel_rpm(self) -> float:
        """Wheel RPM derived from speed."""
        if self.speed <= 0:
            return 0.0
        circumference = 2.0 * math.pi * self.wheel_radius  # m
        rps = self.speed_ms / circumference  # revolutions per second
        return rps * 60.0

    @property
    def motor_rpm(self) -> float:
        """Motor RPM = wheel RPM × gear ratio."""
        return self.wheel_rpm * self.gear_ratio

    def update_speed(self, acceleration: float, dt: float) -> None:
        """
        Update vehicle speed based on net acceleration.

        Args:
            acceleration: net acceleration in m/s²
            dt: time step in seconds
        """
        self.acceleration = acceleration
        new_speed_ms = self.speed_ms + acceleration * dt
        new_speed_ms = max(0.0, new_speed_ms)  # can't go negative

        # Convert back to km/h
        new_speed = new_speed_ms * 3600.0 / 1000.0
        self.speed = min(new_speed, self.max_speed)

        # Update distance
        avg_speed_ms = (self.speed_ms + new_speed_ms) / 2.0
        self.distance_travelled += (avg_speed_ms * dt) / 1000.0  # km

    def reset(self) -> None:
        """Reset vehicle state to standstill."""
        self.speed = 0.0
        self.acceleration = 0.0
        self.distance_travelled = 0.0

    def __repr__(self) -> str:
        return (
            f"Vehicle({self.vehicle_type}: "
            f"{self.speed:.1f} km/h, "
            f"{self.motor_rpm:.0f} RPM, "
            f"{self.distance_travelled:.2f} km)"
        )
