"""
Bike Simulator
==============
Convenience wrapper around the core Simulator for electric bike.
Pre-loads bike configuration.
"""

from simulator.simulator import Simulator
from config.bike import BIKE


def create_bike_simulator(dt: float = 0.05) -> Simulator:
    """Create a Simulator pre-configured for electric bike."""
    sim = Simulator(BIKE, dt=dt)
    return sim


class BikeSimulator(Simulator):
    """Bike-specific simulator with convenience methods."""

    def __init__(self, dt: float = 0.05):
        super().__init__(BIKE, dt=dt)

    def toggle_side_stand(self) -> bool:
        """Toggle side stand and return new state."""
        self.side_stand = not self.side_stand
        return self.side_stand

    def toggle_headlight(self) -> bool:
        self.headlight = not self.headlight
        return self.headlight

    def toggle_left_indicator(self) -> bool:
        self.left_indicator = not self.left_indicator
        if self.left_indicator:
            self.right_indicator = False
            self.hazard = False
        return self.left_indicator

    def toggle_right_indicator(self) -> bool:
        self.right_indicator = not self.right_indicator
        if self.right_indicator:
            self.left_indicator = False
            self.hazard = False
        return self.right_indicator

    def toggle_hazard(self) -> bool:
        self.hazard = not self.hazard
        if self.hazard:
            self.left_indicator = True
            self.right_indicator = True
        else:
            self.left_indicator = False
            self.right_indicator = False
        return self.hazard
