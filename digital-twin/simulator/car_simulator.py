"""
Car Simulator
=============
Convenience wrapper around the core Simulator for electric car.
Pre-loads car configuration.
"""

from simulator.simulator import Simulator
from config.car import CAR


def create_car_simulator(dt: float = 0.05) -> Simulator:
    """Create a Simulator pre-configured for electric car."""
    sim = Simulator(CAR, dt=dt)
    return sim


class CarSimulator(Simulator):
    """Car-specific simulator with convenience methods."""

    def __init__(self, dt: float = 0.05):
        super().__init__(CAR, dt=dt)

    def toggle_doors(self) -> bool:
        self.doors_locked = not self.doors_locked
        return self.doors_locked

    def toggle_seat_belt(self) -> bool:
        self.seat_belt = not self.seat_belt
        return self.seat_belt

    def toggle_parking_brake(self) -> bool:
        self.parking_brake = not self.parking_brake
        return self.parking_brake

    def toggle_climate(self) -> bool:
        self.climate_on = not self.climate_on
        return self.climate_on

    def set_climate_temperature(self, temp: float) -> None:
        self.climate_temp = max(16.0, min(30.0, temp))

    def toggle_cruise_control(self) -> bool:
        self.cruise_control = not self.cruise_control
        if self.cruise_control:
            self.cruise_speed = self.vehicle.speed
        return self.cruise_control

    def toggle_hazard(self) -> bool:
        self.hazard = not self.hazard
        if self.hazard:
            self.left_indicator = True
            self.right_indicator = True
        else:
            self.left_indicator = False
            self.right_indicator = False
        return self.hazard
