"""
Energy Module
=============
Energy consumption tracking and efficiency calculations.
"""


class EnergyTracker:
    """Tracks energy flow: consumption, regeneration, efficiency."""

    def __init__(self):
        self.total_consumed_wh: float = 0.0
        self.total_regenerated_wh: float = 0.0
        self.total_distance_km: float = 0.0
        self._power_samples: list = []
        self._max_samples: int = 600  # ~30 seconds at 50ms

    def update(self, power_kw: float, regen_kw: float,
               distance_km: float, dt: float) -> None:
        """Update energy tracking for one time step."""
        # Energy consumed (Wh)
        self.total_consumed_wh += max(0, power_kw) * 1000.0 * dt / 3600.0
        self.total_regenerated_wh += max(0, regen_kw) * 1000.0 * dt / 3600.0
        self.total_distance_km = distance_km

        # Rolling average power
        self._power_samples.append(power_kw)
        if len(self._power_samples) > self._max_samples:
            self._power_samples.pop(0)

    @property
    def net_consumed_wh(self) -> float:
        return self.total_consumed_wh - self.total_regenerated_wh

    @property
    def average_power_kw(self) -> float:
        if not self._power_samples:
            return 0.0
        return sum(self._power_samples) / len(self._power_samples)

    @property
    def consumption_wh_per_km(self) -> float:
        """Energy efficiency in Wh/km."""
        if self.total_distance_km <= 0.01:
            return 0.0
        return self.net_consumed_wh / self.total_distance_km

    def reset(self) -> None:
        self.total_consumed_wh = 0.0
        self.total_regenerated_wh = 0.0
        self.total_distance_km = 0.0
        self._power_samples.clear()

    def __repr__(self) -> str:
        return (
            f"Energy(consumed={self.net_consumed_wh:.0f}Wh, "
            f"efficiency={self.consumption_wh_per_km:.0f}Wh/km)"
        )
