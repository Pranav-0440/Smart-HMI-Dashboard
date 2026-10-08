/**
 * Speedometer Component
 * Animated circular speedometer gauge with gradient arc.
 */
import { useEffect, useRef } from "react";

interface SpeedometerProps {
  speed: number;
  maxSpeed: number;
  unit?: string;
  size?: number;
  accentColor?: string;
}

export default function Speedometer({
  speed,
  maxSpeed,
  unit = "km/h",
  size = 260,
  accentColor = "#00e5ff",
}: SpeedometerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 20;
    const startAngle = (3 * Math.PI) / 4;
    const endAngle = (Math.PI) / 4 + Math.PI;
    const totalArc = endAngle - startAngle;

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Background track
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.stroke();

    // Value arc
    const fraction = Math.min(speed / maxSpeed, 1);
    const valueAngle = startAngle + totalArc * fraction;

    if (fraction > 0.001) {
      const gradient = ctx.createLinearGradient(0, size, size, 0);
      gradient.addColorStop(0, "#00c853");
      gradient.addColorStop(0.5, accentColor);
      gradient.addColorStop(1, fraction > 0.85 ? "#ff1744" : "#ffab00");

      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, valueAngle);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.stroke();

      // Glow effect
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, valueAngle);
      ctx.strokeStyle = accentColor + "40";
      ctx.lineWidth = 24;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // Tick marks
    const numTicks = 10;
    for (let i = 0; i <= numTicks; i++) {
      const tickAngle = startAngle + (totalArc * i) / numTicks;
      const innerR = radius - 22;
      const outerR = radius - 10;
      const isMajor = i % 2 === 0;

      ctx.beginPath();
      ctx.moveTo(
        cx + Math.cos(tickAngle) * (isMajor ? innerR : innerR + 6),
        cy + Math.sin(tickAngle) * (isMajor ? innerR : innerR + 6)
      );
      ctx.lineTo(
        cx + Math.cos(tickAngle) * outerR,
        cy + Math.sin(tickAngle) * outerR
      );
      ctx.strokeStyle = isMajor
        ? "rgba(255,255,255,0.5)"
        : "rgba(255,255,255,0.2)";
      ctx.lineWidth = isMajor ? 2 : 1;
      ctx.stroke();

      // Labels
      if (isMajor) {
        const labelR = innerR - 14;
        const tickSpeed = Math.round((maxSpeed * i) / numTicks);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "10px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          tickSpeed.toString(),
          cx + Math.cos(tickAngle) * labelR,
          cy + Math.sin(tickAngle) * labelR
        );
      }
    }

    // Center speed value
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${size / 4.2}px 'Inter', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Math.round(speed).toString(), cx, cy - 8);

    // Unit
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `${size / 16}px 'Inter', sans-serif`;
    ctx.fillText(unit, cx, cy + size / 7);
  }, [speed, maxSpeed, size, unit, accentColor]);

  return (
    <div className="speedometer">
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
      />
    </div>
  );
}
