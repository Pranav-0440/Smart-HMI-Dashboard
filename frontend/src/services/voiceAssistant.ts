/**
 * Voice Assistant Service & Command Parser
 * Handles Speech Recognition (STT), Speech Synthesis (TTS),
 * and natural language command parsing for the EV-HMI dashboard.
 */
import type { VehicleState, DriveMode } from "../types/vehicle";

export interface VoiceAssistantActions {
  onToggleControl: (control: string) => void;
  onSetMode: (mode: DriveMode) => void;
  onSetThrottle: (val: number) => void;
  onSetBrake: (val: number) => void;
  onSetSlope: (val: number) => void;
  onReset: () => void;
}

export interface VoiceCommandResult {
  matched: boolean;
  actionName?: string;
  response: string;
}

// Speak response using browser Text-to-Speech
export function speakResponse(
  text: string,
  enabled: boolean = true,
  onEnd?: () => void,
  onStart?: () => void
): void {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
    if (onEnd) onEnd();
    return;
  }
  try {
    window.speechSynthesis.cancel(); // cancel any previous speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    
    // Retain global reference to avoid Chrome GC bug dropping onend
    (window as any).__lastSpeechUtterance = utterance;

    let hasEnded = false;
    const safeEnd = () => {
      if (hasEnded) return;
      hasEnded = true;
      if (onEnd) onEnd();
    };

    if (onStart) utterance.onstart = onStart;
    utterance.onend = safeEnd;
    utterance.onerror = safeEnd;

    // Safety fallback: in case onend never fires from browser
    const maxDuration = Math.max(2500, text.length * 80);
    setTimeout(safeEnd, maxDuration);

    // Prefer natural sounding voices if available
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(
      (v) => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Samantha"))
    ) || voices.find((v) => v.lang.startsWith("en"));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("[VoiceAssistant] TTS error:", err);
    if (onEnd) onEnd();
  }
}


/**
 * Parses user spoken phrase and triggers the corresponding vehicle control.
 */
export function processVoiceCommand(
  rawTranscript: string,
  state: VehicleState,
  actions: VoiceAssistantActions
): VoiceCommandResult {
  const text = rawTranscript.toLowerCase().trim();

  // ── LEFT INDICATOR ──
  const isLeftIndicator =
    (text.includes("left") &&
      (text.includes("indicator") ||
        text.includes("signal") ||
        text.includes("blinker") ||
        text.includes("light") ||
        text.includes("turn") ||
        text.includes("indicate") ||
        text.includes("side"))) ||
    text === "left" ||
    text === "left indicator" ||
    text === "turn left";

  if (isLeftIndicator) {
    const isOff = text.includes("off") || text.includes("stop") || text.includes("cancel") || text.includes("disable") || text.includes("cut");
    if (isOff) {
      if (state.leftIndicator) actions.onToggleControl("leftIndicator");
      return { matched: true, actionName: "left_indicator_off", response: "Left indicator turned off." };
    } else {
      if (!state.leftIndicator) {
        actions.onToggleControl("leftIndicator");
      }
      return { matched: true, actionName: "left_indicator_on", response: "Left indicator turned on." };
    }
  }

  // ── RIGHT INDICATOR ──
  const isRightIndicator =
    (text.includes("right") &&
      (text.includes("indicator") ||
        text.includes("signal") ||
        text.includes("blinker") ||
        text.includes("light") ||
        text.includes("turn") ||
        text.includes("indicate") ||
        text.includes("side"))) ||
    text === "right" ||
    text === "right indicator" ||
    text === "turn right";

  if (isRightIndicator) {
    const isOff = text.includes("off") || text.includes("stop") || text.includes("cancel") || text.includes("disable") || text.includes("cut");
    if (isOff) {
      if (state.rightIndicator) actions.onToggleControl("rightIndicator");
      return { matched: true, actionName: "right_indicator_off", response: "Right indicator turned off." };
    } else {
      if (!state.rightIndicator) {
        actions.onToggleControl("rightIndicator");
      }
      return { matched: true, actionName: "right_indicator_on", response: "Right indicator turned on." };
    }
  }

  // ── HAZARD LIGHTS ──
  if (
    text.includes("hazard") ||
    text.includes("emergency light") ||
    text.includes("flashers") ||
    text.includes("both indicator") ||
    text.includes("warning light")
  ) {
    actions.onToggleControl("hazard");
    const nextState = !state.hazard;
    return {
      matched: true,
      actionName: "hazard",
      response: nextState ? "Hazard warning flashers activated." : "Hazard lights deactivated.",
    };
  }

  // ── HEADLIGHTS / LIGHTS ──
  if (
    text.includes("headlight") ||
    text.includes("head lamp") ||
    text.includes("light") ||
    text.includes("lamp") ||
    text.includes("beam")
  ) {
    const isOff = text.includes("off") || text.includes("turn off") || text.includes("disable") || text.includes("kill");
    if (isOff) {
      if (state.headlight) actions.onToggleControl("headlight");
      return { matched: true, actionName: "headlight_off", response: "Headlights turned off." };
    } else {
      if (!state.headlight) actions.onToggleControl("headlight");
      return { matched: true, actionName: "headlight_on", response: "Headlights turned on." };
    }
  }

  // ── DRIVE MODES ──
  if (text.includes("sport") || text.includes("beast") || text.includes("fast mode") || text.includes("power mode") || text.includes("turbo")) {
    actions.onSetMode("SPORT");
    return { matched: true, actionName: "mode_sport", response: "Engaged Sport mode. Maximum power unlocked." };
  }

  if (text.includes("eco") || text.includes("economy") || text.includes("save battery") || text.includes("efficient") || text.includes("range mode")) {
    actions.onSetMode("ECO");
    return { matched: true, actionName: "mode_eco", response: "Switched to Eco mode for maximum efficiency." };
  }

  if (text.includes("normal") || text.includes("standard") || text.includes("city mode") || text.includes("default mode") || text.includes("drive mode")) {
    actions.onSetMode("NORMAL");
    return { matched: true, actionName: "mode_normal", response: "Switched to Normal drive mode." };
  }

  // ── CAR CABIN CONTROLS (Climate / Doors / Seatbelt / Park Brake) ──
  if (
    text.includes("climate") ||
    text.includes("ac") ||
    text.includes("air condition") ||
    text.includes("cooling") ||
    text.includes("heater") ||
    text.includes("temperature control")
  ) {
    actions.onToggleControl("climate");
    return {
      matched: true,
      actionName: "climate",
      response: "Climate control toggled.",
    };
  }

  if (text.includes("door") || text.includes("lock") || text.includes("unlock")) {
    actions.onToggleControl("doorsLocked");
    return {
      matched: true,
      actionName: "doors",
      response: "Vehicle door locks toggled.",
    };
  }

  if (text.includes("parking brake") || text.includes("handbrake") || text.includes("p brake") || text.includes("park brake")) {
    actions.onToggleControl("parkingBrake");
    return {
      matched: true,
      actionName: "parking_brake",
      response: "Parking brake toggled.",
    };
  }

  if (text.includes("seatbelt") || text.includes("seat belt") || text.includes("belt")) {
    actions.onToggleControl("seatBelt");
    return {
      matched: true,
      actionName: "seatbelt",
      response: "Seatbelt status updated.",
    };
  }

  // ── BIKE CONTROLS (Side Stand / Helmet / Horn) ──
  if (text.includes("stand") || text.includes("side stand") || text.includes("kickstand")) {
    actions.onToggleControl("sideStand");
    return {
      matched: true,
      actionName: "side_stand",
      response: "Side stand toggled.",
    };
  }

  // ── RESET ──
  if (text.includes("reset") || text.includes("restart") || text.includes("start over")) {
    actions.onReset();
    return {
      matched: true,
      actionName: "reset",
      response: "Simulation reset to default initial state.",
    };
  }

  if (text.includes("helmet")) {
    actions.onToggleControl("helmetOn");
    return {
      matched: true,
      actionName: "helmet",
      response: "Helmet sensor status toggled.",
    };
  }

  if (text.includes("horn") || text.includes("honk") || text.includes("beep")) {
    actions.onToggleControl("horn");
    return {
      matched: true,
      actionName: "horn",
      response: "Beep beep! Horn sounded.",
    };
  }

  // ── TELEMETRY QUERIES ──
  if (text.includes("speed") || text.includes("how fast")) {
    const currentSpeed = Math.round(state.speed);
    return {
      matched: true,
      actionName: "query_speed",
      response: `Current speed is ${currentSpeed} kilometers per hour.`,
    };
  }

  if (text.includes("battery") || text.includes("charge") || text.includes("soc") || text.includes("power left")) {
    const soc = Math.round(state.batterySoc);
    const range = Math.round(state.range);
    return {
      matched: true,
      actionName: "query_battery",
      response: `Battery state of charge is at ${soc} percent with approximately ${range} kilometers of remaining range.`,
    };
  }

  if (text.includes("range") || text.includes("how far")) {
    const range = Math.round(state.range);
    return {
      matched: true,
      actionName: "query_range",
      response: `Estimated remaining driving range is ${range} kilometers.`,
    };
  }

  if (text.includes("temperature") || text.includes("temp") || text.includes("motor temp") || text.includes("overheating")) {
    const mTemp = Math.round(state.motorTemperature);
    const bTemp = Math.round(state.batteryTemperature);
    return {
      matched: true,
      actionName: "query_temp",
      response: `Motor temperature is ${mTemp} degrees Celsius, and battery temperature is ${bTemp} degrees Celsius.`,
    };
  }

  // ── THROTTLE / ACCELERATION / BRAKE ──
  if (text.includes("accelerate") || text.includes("speed up") || text.includes("throttle up") || text.includes("go faster")) {
    const newThrottle = Math.min(100, Math.round(state.throttle + 25));
    actions.onSetThrottle(newThrottle);
    return {
      matched: true,
      actionName: "accelerate",
      response: `Accelerating. Throttle set to ${newThrottle} percent.`,
    };
  }

  if (text.includes("brake") || text.includes("slow down") || text.includes("stop") || text.includes("decelerate")) {
    actions.onSetThrottle(0);
    actions.onSetBrake(60);
    return {
      matched: true,
      actionName: "brake",
      response: "Applying regenerative braking.",
    };
  }

  // ── RESET ──
  if (text.includes("reset") || text.includes("restart simulation") || text.includes("new trip")) {
    actions.onReset();
    return {
      matched: true,
      actionName: "reset",
      response: "Simulation reset to initial state.",
    };
  }

  // ── FALLBACK / UNRECOGNIZED ──
  return {
    matched: false,
    response: `I heard "${rawTranscript}", but I didn't recognize that command. Try saying "Turn on left indicator", "Switch to Sport mode", or "What's my battery?".`,
  };
}
