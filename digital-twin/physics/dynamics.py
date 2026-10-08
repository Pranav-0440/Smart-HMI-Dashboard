"""
Vehicle Dynamics Module
=======================
Combines forces to produce net acceleration and updates vehicle motion.
This is the core physics loop step for both BIKE and CAR.
"""

from . import forces


def calculate_net_force(throttle: float, brake: float,
                        vehicle, motor, drive_mode: dict,
                        slope_percent: float = 0.0) -> float:
    """
    Calculate the net force on the vehicle.

    F_net = F_tractive − F_drag − F_rolling − F_grade − F_brake

    Args:
        throttle: throttle input (0.0 to 1.0)
        brake: brake input (0.0 to 1.0)
        vehicle: Vehicle model instance
        motor: Motor model instance
        drive_mode: dict with 'power_limit', 'speed_limit'
        slope_percent: road gradient (%)

    Returns:
        Net force in Newtons
    """
    speed_ms = vehicle.speed_ms
    power_limit = drive_mode.get("power_limit", 1.0)
    speed_limit_kmh = drive_mode.get("speed_limit", vehicle.max_speed)

    # ── Tractive force from motor ─────────────────────────────
    if vehicle.speed >= speed_limit_kmh:
        throttle = 0.0  # speed limiter

    # Desired motor power (limited by mode)
    desired_power_w = throttle * motor.power_max * power_limit

    # Force available from motor at current speed
    if speed_ms > 0.1:
        f_tractive = desired_power_w / speed_ms
    else:
        # Starting from rest: use max torque
        f_tractive = (motor.torque_max * vehicle.gear_ratio /
                      vehicle.wheel_radius) * throttle * power_limit

    # ── Resistance forces ─────────────────────────────────────
    f_drag = forces.aerodynamic_drag(
        vehicle.drag_coefficient, vehicle.frontal_area, speed_ms
    )
    f_roll = forces.rolling_resistance(vehicle.rolling_resistance, vehicle.mass)
    f_grade = forces.grade_force(vehicle.mass, slope_percent)
    f_brake = forces.braking_force(brake, vehicle.mass)

    # ── Net force ─────────────────────────────────────────────
    f_net = f_tractive - f_drag - f_roll - f_grade - f_brake

    return f_net


def calculate_acceleration(f_net: float, mass: float) -> float:
    """
    a = F / m

    Returns acceleration in m/s².
    """
    if mass <= 0:
        return 0.0
    return f_net / mass


def dynamics_step(throttle: float, brake: float,
                  vehicle, motor, battery, regen, thermal,
                  drive_mode_name: str, drive_modes: dict,
                  slope_percent: float, dt: float) -> dict:
    """
    Execute one complete physics step.

    This is the 'Virtual ECU' loop — runs every 50 ms.

    Returns:
        dict with all computed values for this step
    """
    drive_mode = drive_modes.get(drive_mode_name, drive_modes.get("NORMAL", {}))

    # 1. Net force
    f_net = calculate_net_force(
        throttle, brake, vehicle, motor, drive_mode, slope_percent
    )

    # 2. Acceleration
    accel = calculate_acceleration(f_net, vehicle.mass)

    # 3. Update speed
    vehicle.update_speed(accel, dt)

    # 4. Motor RPM from wheel speed
    rpm = vehicle.motor_rpm

    # 5. Motor torque (from force)
    if vehicle.speed_ms > 0.1:
        total_force = max(0, f_net + forces.aerodynamic_drag(
            vehicle.drag_coefficient, vehicle.frontal_area, vehicle.speed_ms
        ) + forces.rolling_resistance(vehicle.rolling_resistance, vehicle.mass) +
                          forces.grade_force(vehicle.mass, slope_percent))
    else:
        total_force = max(0, f_net)

    motor.calculate_torque(total_force, vehicle.wheel_radius, vehicle.gear_ratio)

    # 6. Motor power
    motor.calculate_power(rpm)

    # 7. Regeneration
    regen_power = regen.calculate(
        vehicle.speed, brake, motor.power,
        drive_mode, battery.soc
    )
    regen.update_energy(dt)

    # 8. Battery update
    if regen.is_active and brake > 0:
        # During regen braking: motor draws less, regen charges
        net_electrical_power = motor.electrical_power - regen_power
    else:
        net_electrical_power = motor.electrical_power

    battery.update(net_electrical_power, dt)

    # 9. Thermal update
    thermal.update(motor, battery, dt)

    # 10. Build result dict
    return {
        "speed": vehicle.speed,
        "acceleration": vehicle.acceleration,
        "motor_rpm": motor.rpm,
        "motor_torque": motor.torque,
        "motor_power_kw": motor.power_kw,
        "motor_electrical_kw": motor.electrical_power_kw,
        "motor_temperature": motor.temperature,
        "battery_soc": battery.soc,
        "battery_voltage": battery.voltage,
        "battery_current": battery.current,
        "battery_power_kw": battery.power_kw,
        "battery_temperature": battery.temperature,
        "regen_power_kw": regen.regen_power_kw,
        "regen_active": regen.is_active,
        "distance": vehicle.distance_travelled,
        "net_force": f_net,
    }
