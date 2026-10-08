"""
Forces Module
=============
Calculates all forces acting on the vehicle:
  - Aerodynamic drag
  - Rolling resistance
  - Grade (hill) force
  - Tractive (motor) force
  - Braking force

Same equations for BIKE and CAR — parameters make the difference.
"""

import math

# Constants
AIR_DENSITY = 1.225  # kg/m³  (sea level, 15°C)
GRAVITY = 9.81       # m/s²


def aerodynamic_drag(cd: float, frontal_area: float,
                     speed_ms: float, air_density: float = AIR_DENSITY) -> float:
    """
    F_drag = ½ × ρ × Cd × A × v²

    Args:
        cd: drag coefficient
        frontal_area: frontal area in m²
        speed_ms: speed in m/s

    Returns:
        Drag force in Newtons (always opposes motion)
    """
    return 0.5 * air_density * cd * frontal_area * speed_ms ** 2


def rolling_resistance(crr: float, mass: float,
                       gravity: float = GRAVITY) -> float:
    """
    F_rolling = Crr × m × g

    Returns:
        Rolling resistance force in Newtons
    """
    return crr * mass * gravity


def grade_force(mass: float, slope_percent: float,
                gravity: float = GRAVITY) -> float:
    """
    F_grade = m × g × sin(θ)

    Args:
        slope_percent: road slope in percent (positive = uphill)

    Returns:
        Grade force in Newtons (positive uphill, negative downhill)
    """
    theta = math.atan(slope_percent / 100.0)
    return mass * gravity * math.sin(theta)


def tractive_force(motor_torque: float, gear_ratio: float,
                   wheel_radius: float, efficiency: float = 0.95) -> float:
    """
    F_tractive = (Motor_Torque × Gear_Ratio × η) / Wheel_Radius

    Returns:
        Tractive force in Newtons at the wheel contact patch
    """
    if wheel_radius <= 0:
        return 0.0
    return (motor_torque * gear_ratio * efficiency) / wheel_radius


def braking_force(brake_input: float, mass: float,
                  max_decel: float = 8.0, gravity: float = GRAVITY) -> float:
    """
    Braking force = brake_input × mass × max_deceleration

    Args:
        brake_input: 0.0 to 1.0
        max_decel: maximum braking deceleration in m/s²

    Returns:
        Braking force in Newtons (always opposes motion)
    """
    return brake_input * mass * max_decel


def total_resistance(cd: float, frontal_area: float, speed_ms: float,
                     crr: float, mass: float,
                     slope_percent: float = 0.0) -> float:
    """
    Sum of all resistance forces opposing motion.

    Returns:
        Total resistance in Newtons
    """
    f_drag = aerodynamic_drag(cd, frontal_area, speed_ms)
    f_roll = rolling_resistance(crr, mass)
    f_grade = grade_force(mass, slope_percent)
    return f_drag + f_roll + f_grade
