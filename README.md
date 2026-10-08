# ⚡ EV-HMI Platform — Smart Digital Twin Dashboard

**2-Wheeler + 4-Wheeler Electric Vehicle HMI with Real-time Digital Twin**

A unified platform that simulates and monitors both electric bikes and cars through a single intelligent HMI, powered by physics-based digital twins.

## 🏗️ Architecture

```
                    EV-HMI PLATFORM
                         │
             ┌───────────┴───────────┐
             │                       │
          2-WHEELER               4-WHEELER
             │                       │
       Bike Parameters          Car Parameters
             │                       │
             └───────────┬───────────┘
                         ↓
                   PHYSICS ENGINE
                         ↓
         Vehicle → Motor → Battery → Thermal
                         ↓
                  VIRTUAL SENSORS
                         ↓
                  VEHICLE STATE
                         ↓
              Python FastAPI (REST + WS)
                         ↓
                     REACT HMI
```

## 📁 Project Structure

```
Smart-HMI-Dashboard/
│
├── digital-twin/              # Python Digital Twin Simulator
│   ├── config/
│   │   ├── bike.py            # 2-Wheeler parameters (190kg, 72V, 4kWh)
│   │   └── car.py             # 4-Wheeler parameters (1500kg, 400V, 60kWh)
│   ├── models/
│   │   ├── vehicle.py         # Universal vehicle model
│   │   ├── motor.py           # Electric motor model
│   │   ├── battery.py         # Battery + SOC/SOH model
│   │   ├── thermal.py         # Thermal management
│   │   └── regeneration.py    # Regenerative braking
│   ├── physics/
│   │   ├── forces.py          # Drag, rolling, grade forces
│   │   ├── dynamics.py        # Net force → acceleration → speed
│   │   └── energy.py          # Energy tracking & efficiency
│   ├── simulator/
│   │   ├── simulator.py       # Core simulation loop (50ms)
│   │   ├── bike_simulator.py  # Bike convenience wrapper
│   │   └── car_simulator.py   # Car convenience wrapper
│   ├── main.py                # FastAPI server (REST + WebSocket)
│   └── requirements.txt
│
├── frontend/                  # React + TypeScript + Vite
│   └── src/
│       ├── components/        # Speedometer, BatteryGauge, MotorStats...
│       ├── pages/             # VehicleSelection, BikeDashboard, CarDashboard
│       ├── services/          # WebSocket client
│       └── types/             # VehicleState interface
│
├── backend/                   # (Phase 4: Spring Boot — coming next)
├── database/                  # (Phase 8: PostgreSQL — coming later)
└── README.md
```

## 🚀 Quick Start

### 1. Start the Digital Twin (Python)

```bash
cd digital-twin
pip install -r requirements.txt
python main.py
```

The server starts at:
- **REST API**: http://localhost:8000/api/vehicle/state
- **WebSocket**: ws://localhost:8000/ws/vehicle
- **API Docs**: http://localhost:8000/docs

### 2. Start the Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — select BIKE or CAR and watch the dashboard come alive.

---

## 🐳 Docker Deployment (One-Command Launch)

You can run both the Frontend and Digital Twin simulator using Docker Compose:

```bash
docker compose up --build
```
Open [http://localhost](http://localhost) to access the dashboard. For cloud deployments (Render, Railway, Vercel, AWS), see [DEPLOYMENT.md](file:///c:/Users/prana/PG/Projects/Smart-HMI-Dashboard/DEPLOYMENT.md).

### 3. Control the Simulation

Use the **Simulation Control Panel** at the bottom of the dashboard:
- 🟢 **Throttle** slider (0–100%)
- 🔴 **Brake** slider (0–100%)
- 🏔️ **Road slope** (-15% to +15%)
- ⚡ **Drive mode** (ECO / NORMAL / SPORT)

## 🔧 Key Features

| Feature | Bike | Car |
|---------|------|-----|
| Speed / RPM / Torque | ✅ | ✅ |
| Battery SOC / SOH | ✅ | ✅ |
| Voltage / Current / Power | ✅ | ✅ |
| Motor & Battery Temp | ✅ | ✅ |
| Range Estimation | ✅ | ✅ |
| Regenerative Braking | ✅ (5kW) | ✅ (50kW) |
| Drive Modes | ✅ | ✅ |
| Headlight / Indicators | ✅ | ✅ |
| Side Stand / Helmet | ✅ | — |
| Doors / Seatbelt / Climate | — | ✅ |
| Overspeed / Overtemp Alerts | ✅ | ✅ |

## 📐 Physics Equations

All calculations use **real physics** — same equations, different parameters:

- **Aerodynamic Drag**: `F = ½ρCdAv²`
- **Rolling Resistance**: `F = Crr × m × g`
- **Grade Force**: `F = m × g × sin(θ)`
- **Motor Power**: `P = τ × ω`
- **Battery SOC**: `ΔSOC = (P × Δt) / Capacity`
- **Thermal**: `dT/dt = (I²R − Q_cooling) / C_thermal`

## 🛣️ Development Phases

- [x] **Phase 1** — Common foundation (models, physics, configs)
- [x] **Phase 2** — Bike simulation + testing
- [x] **Phase 3** — Car simulation + testing
- [ ] **Phase 4** — Spring Boot backend
- [x] **Phase 5** — React HMI (bike + car dashboards)
- [x] **Phase 6** — Controls (throttle, brake, modes, regen)
- [x] **Phase 7** — Vehicle-specific features
- [ ] **Phase 8** — PostgreSQL database
- [ ] **Phase 9** — GPS/Bluetooth/Navigation simulation
- [ ] **Phase 10** — Real hardware integration (CAN/ESP32/BMS)
