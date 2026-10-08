"""
EV Digital Twin — Main Entry Point
====================================
Runs the simulation loop and exposes a REST + WebSocket API
using FastAPI so the Spring Boot backend (or direct React) can connect.

Usage:
    python -m digital-twin.main
    or
    python main.py

Endpoints:
    GET  /api/vehicle/state       → current vehicle state
    POST /api/vehicle/type        → switch vehicle (BIKE/CAR)
    POST /api/vehicle/throttle    → set throttle
    POST /api/vehicle/brake       → set brake
    POST /api/vehicle/mode        → set drive mode
    POST /api/vehicle/slope       → set road slope
    POST /api/vehicle/control     → toggle controls
    POST /api/vehicle/reset       → reset simulation
    WS   /ws/vehicle              → real-time state stream
"""

import asyncio
import json
import time
import sys
import os

# Add current directory and parent to path
_cur_dir = os.path.dirname(os.path.abspath(__file__))
if _cur_dir not in sys.path:
    sys.path.insert(0, _cur_dir)
_parent_dir = os.path.dirname(_cur_dir)
if _parent_dir not in sys.path:
    sys.path.insert(0, _parent_dir)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

from config.bike import BIKE
from config.car import CAR
from simulator.simulator import Simulator


# ══════════════════════════════════════════════════════════════
#  App Setup
# ══════════════════════════════════════════════════════════════

app = FastAPI(
    title="EV Digital Twin API",
    description="Smart EV HMI — 2-Wheeler + 4-Wheeler Digital Twin",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Vehicle configs ───────────────────────────────────────────
VEHICLE_CONFIGS = {
    "BIKE": BIKE,
    "CAR": CAR,
}

# ── Simulator instance ───────────────────────────────────────
simulator: Simulator = Simulator(BIKE, dt=0.05)
connected_clients: list[WebSocket] = []
sim_running: bool = True


# ══════════════════════════════════════════════════════════════
#  Request Models
# ══════════════════════════════════════════════════════════════

class ThrottleRequest(BaseModel):
    value: float  # 0–100

class BrakeRequest(BaseModel):
    value: float  # 0–100

class ModeRequest(BaseModel):
    mode: str  # ECO, NORMAL, SPORT

class VehicleTypeRequest(BaseModel):
    type: str  # BIKE, CAR

class SlopeRequest(BaseModel):
    value: float  # -30 to +30

class ControlRequest(BaseModel):
    control: str  # headlight, leftIndicator, rightIndicator, hazard, etc.
    value: Optional[bool] = None
    numericValue: Optional[float] = None

class ResetRequest(BaseModel):
    soc: Optional[float] = 80.0
    ambientTemp: Optional[float] = 25.0

class AmbientRequest(BaseModel):
    value: float


# ══════════════════════════════════════════════════════════════
#  REST Endpoints
# ══════════════════════════════════════════════════════════════

@app.get("/api/vehicle/state")
async def get_vehicle_state():
    """Get current vehicle state snapshot."""
    return simulator.step()


@app.post("/api/vehicle/type")
async def set_vehicle_type(req: VehicleTypeRequest):
    """Switch between BIKE and CAR."""
    global simulator
    vehicle_type = req.type.upper()
    if vehicle_type not in VEHICLE_CONFIGS:
        return {"error": f"Unknown vehicle type: {vehicle_type}"}

    config = VEHICLE_CONFIGS[vehicle_type]
    simulator = Simulator(config, dt=0.05)
    return {"status": "ok", "vehicleType": vehicle_type}


@app.post("/api/vehicle/throttle")
async def set_throttle(req: ThrottleRequest):
    """Set throttle position (0–100%)."""
    simulator.set_throttle(req.value)
    return {"status": "ok", "throttle": req.value}


@app.post("/api/vehicle/brake")
async def set_brake(req: BrakeRequest):
    """Set brake position (0–100%)."""
    simulator.set_brake(req.value)
    return {"status": "ok", "brake": req.value}


@app.post("/api/vehicle/mode")
async def set_drive_mode(req: ModeRequest):
    """Set drive mode (ECO, NORMAL, SPORT)."""
    simulator.set_drive_mode(req.mode.upper())
    return {"status": "ok", "driveMode": req.mode.upper()}


@app.post("/api/vehicle/slope")
async def set_slope(req: SlopeRequest):
    """Set road slope (%)."""
    simulator.set_slope(req.value)
    return {"status": "ok", "slope": req.value}


@app.post("/api/vehicle/ambient")
async def set_ambient(req: AmbientRequest):
    """Set ambient temperature."""
    simulator.set_ambient_temperature(req.value)
    return {"status": "ok", "ambient": req.value}


@app.post("/api/vehicle/control")
async def toggle_control(req: ControlRequest):
    """Toggle a vehicle control (headlight, indicator, etc.)."""
    control = req.control

    if control == "headlight":
        simulator.headlight = not simulator.headlight
        return {"status": "ok", "headlight": simulator.headlight}
    elif control == "leftIndicator":
        simulator.left_indicator = not simulator.left_indicator
        return {"status": "ok", "leftIndicator": simulator.left_indicator}
    elif control == "rightIndicator":
        simulator.right_indicator = not simulator.right_indicator
        return {"status": "ok", "rightIndicator": simulator.right_indicator}
    elif control == "hazard":
        simulator.hazard = not simulator.hazard
        simulator.left_indicator = simulator.hazard
        simulator.right_indicator = simulator.hazard
        return {"status": "ok", "hazard": simulator.hazard}
    elif control == "sideStand":
        simulator.side_stand = not simulator.side_stand
        return {"status": "ok", "sideStand": simulator.side_stand}
    elif control == "seatBelt":
        simulator.seat_belt = not simulator.seat_belt
        return {"status": "ok", "seatBelt": simulator.seat_belt}
    elif control == "doorsLocked":
        simulator.doors_locked = not simulator.doors_locked
        return {"status": "ok", "doorsLocked": simulator.doors_locked}
    elif control == "parkingBrake":
        simulator.parking_brake = not simulator.parking_brake
        return {"status": "ok", "parkingBrake": simulator.parking_brake}
    elif control == "climate":
        simulator.climate_on = not simulator.climate_on
        if req.numericValue is not None:
            simulator.climate_temp = req.numericValue
        return {"status": "ok", "climateOn": simulator.climate_on,
                "climateTemp": simulator.climate_temp}
    elif control == "cruiseControl":
        simulator.cruise_control = not simulator.cruise_control
        if simulator.cruise_control:
            simulator.cruise_speed = simulator.vehicle.speed
        return {"status": "ok", "cruiseControl": simulator.cruise_control}
    else:
        return {"error": f"Unknown control: {control}"}


@app.post("/api/vehicle/reset")
async def reset_simulation(req: ResetRequest):
    """Reset the simulation."""
    simulator.set_ambient_temperature(req.ambientTemp or 25.0)
    simulator.reset(initial_soc=req.soc or 80.0)
    return {"status": "ok"}


@app.get("/api/vehicle/trip")
async def get_trip_summary():
    """Get trip summary."""
    return simulator.get_trip_summary()


@app.get("/api/vehicle/configs")
async def get_available_configs():
    """List available vehicle types."""
    return {
        "vehicles": [
            {"type": "BIKE", "name": BIKE["vehicle_name"]},
            {"type": "CAR", "name": CAR["vehicle_name"]},
        ]
    }


# ══════════════════════════════════════════════════════════════
#  WebSocket — Real-time State Stream
# ══════════════════════════════════════════════════════════════

@app.websocket("/ws/vehicle")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time vehicle state updates.
    Sends state JSON every 50ms (20 Hz).
    """
    await websocket.accept()
    connected_clients.append(websocket)
    print(f"[WS] Client connected. Total: {len(connected_clients)}")

    try:
        while True:
            # Run simulation step
            state = simulator.step()

            # Send state to this client
            await websocket.send_json(state)

            # Check for incoming commands
            try:
                data = await asyncio.wait_for(
                    websocket.receive_text(), timeout=0.05
                )
                # Process incoming command
                try:
                    cmd = json.loads(data)
                    _process_ws_command(cmd)
                except json.JSONDecodeError:
                    pass
            except asyncio.TimeoutError:
                pass

    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        print(f"[WS] Client disconnected. Total: {len(connected_clients)}")
    except Exception as e:
        print(f"[WS] Error: {e}")
        if websocket in connected_clients:
            connected_clients.remove(websocket)


def _process_ws_command(cmd: dict) -> None:
    """Process a command received via WebSocket."""
    global simulator

    action = cmd.get("action", "")

    if action == "throttle":
        simulator.set_throttle(cmd.get("value", 0))
    elif action == "brake":
        simulator.set_brake(cmd.get("value", 0))
    elif action == "mode":
        simulator.set_drive_mode(cmd.get("value", "NORMAL"))
    elif action == "slope":
        simulator.set_slope(cmd.get("value", 0))
    elif action == "ambient":
        simulator.set_ambient_temperature(cmd.get("value", 25))
    elif action == "vehicleType":
        vtype = cmd.get("value", "BIKE").upper()
        if vtype in VEHICLE_CONFIGS:
            simulator = Simulator(VEHICLE_CONFIGS[vtype], dt=0.05)
    elif action == "control":
        control = cmd.get("control", "")
        # Map camelCase to snake_case attribute
        control_map = {
            "headlight": "headlight",
            "leftIndicator": "left_indicator",
            "rightIndicator": "right_indicator",
            "hazard": "hazard",
            "sideStand": "side_stand",
            "seatBelt": "seat_belt",
            "doorsLocked": "doors_locked",
            "parkingBrake": "parking_brake",
            "climate": "climate_on",
            "climateOn": "climate_on",
            "cruiseControl": "cruise_control",
            "horn": "horn",
        }
        attr = control_map.get(control, control)
        if hasattr(simulator, attr):
            new_val = not getattr(simulator, attr)
            setattr(simulator, attr, new_val)
            if attr == "hazard":
                simulator.left_indicator = new_val
                simulator.right_indicator = new_val
            print(f"[WS Control] Toggled {attr} -> {new_val}")
    elif action == "reset":
        simulator.reset(initial_soc=cmd.get("soc", 80.0))


# ══════════════════════════════════════════════════════════════
#  Startup
# ══════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup_event():
    print("=" * 50)
    print("  EV DIGITAL TWIN - Smart HMI Platform")
    print("  2-Wheeler + 4-Wheeler Simulator")
    print("=" * 50)
    print("  REST API:   http://localhost:8000/api/vehicle/state")
    print("  WebSocket:  ws://localhost:8000/ws/vehicle")
    print("  Docs:       http://localhost:8000/docs")
    print("=" * 50)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    is_production = bool(os.environ.get("PORT") or os.environ.get("RENDER") or os.environ.get("RAILWAY_ENVIRONMENT"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=not is_production,
        log_level="info",
    )
