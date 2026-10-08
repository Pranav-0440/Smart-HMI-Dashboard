/**
 * WebSocket Service
 * Connects to the Digital Twin server for real-time vehicle state.
 */
import type { VehicleState } from "../types/vehicle";

const getWsUrl = (): string => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const isHttps = window.location.protocol === "https:";
  const protocol = isHttps ? "wss:" : "ws:";
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `${protocol}//localhost:8000/ws/vehicle`;
  }
  return `${protocol}//${window.location.host}/ws/vehicle`;
};

const getApiUrl = (): string => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  const isHttps = window.location.protocol === "https:";
  const protocol = isHttps ? "https:" : "http:";
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `${protocol}//localhost:8000/api`;
  }
  return `${protocol}//${window.location.host}/api`;
};

const WS_URL = getWsUrl();
const API_URL = getApiUrl();

type StateCallback = (state: VehicleState) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: StateCallback[] = [];
  private reconnectTimer: number | null = null;
  private _isConnected: boolean = false;

  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log("[WS] Connected to Digital Twin");
        this._isConnected = true;
        if (this.reconnectTimer) {
          clearInterval(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const state: VehicleState = JSON.parse(event.data);
          this.listeners.forEach((cb) => cb(state));
        } catch (e) {
          console.error("[WS] Parse error:", e);
        }
      };

      this.ws.onclose = () => {
        console.log("[WS] Disconnected");
        this._isConnected = false;
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error("[WS] Error:", err);
        this._isConnected = false;
      };
    } catch (e) {
      console.error("[WS] Connection failed:", e);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setInterval(() => {
      console.log("[WS] Reconnecting...");
      this.connect();
    }, 3000);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this._isConnected = false;
  }

  onStateUpdate(callback: StateCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  sendCommand(action: string, value?: unknown, extra?: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, value, ...extra }));
    }
  }
}

export const wsService = new WebSocketService();

// ── REST API helpers ──────────────────────────────────────────

export async function apiPost(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function apiGet(endpoint: string) {
  const res = await fetch(`${API_URL}${endpoint}`);
  return res.json();
}
