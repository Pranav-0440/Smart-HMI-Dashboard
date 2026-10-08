/**
 * 3D AI Robot Voice Assistant Component
 * Floating on the left side of the dashboard.
 * When turned on, greets the driver verbally ("Hello! I'm your EV copilot, I'm listening..."),
 * continuously listens for multiple voice commands without turning off automatically,
 * and immediately executes requested vehicle actions.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import type { VehicleState, DriveMode } from "../types/vehicle";
import {
  processVoiceCommand,
  speakResponse,
  type VoiceAssistantActions,
} from "../services/voiceAssistant";

interface VoiceAssistantProps {
  state: VehicleState;
  onControl: (control: string) => void;
  onMode: (mode: DriveMode) => void;
  onThrottle: (v: number) => void;
  onBrake: (v: number) => void;
  onSlope: (v: number) => void;
  onReset: () => void;
}

// Quick voice suggestions for user inspiration or instant click testing
const SUGGESTIONS = [
  "Turn on left indicator",
  "Turn on headlights",
  "Switch to Sport mode",
  "Turn on hazard lights",
  "What is my battery?",
  "What is my speed?",
  "Accelerate",
  "Slow down",
];

const GREETING_TEXT = "Hello! I am your EV copilot. I am listening, tell me what you want me to do!";

type SpeechRecognitionType = any;

export default function VoiceAssistant({
  state,
  onControl,
  onMode,
  onThrottle,
  onBrake,
  onSlope,
  onReset,
}: VoiceAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [assistantReply, setAssistantReply] = useState<string>(GREETING_TEXT);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [hasSpeechRecognition, setHasSpeechRecognition] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const keepListeningRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const restartTimerRef = useRef<number | null>(null);
  const clearTranscriptTimerRef = useRef<number | null>(null);

  const actions: VoiceAssistantActions = {
    onToggleControl: onControl,
    onSetMode: onMode,
    onSetThrottle: onThrottle,
    onSetBrake: onBrake,
    onSetSlope: onSlope,
    onReset,
  };

  // Safe restart recognition helper
  const restartRecognition = useCallback(() => {
    if (!keepListeningRef.current || !recognitionRef.current) return;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);

    restartTimerRef.current = window.setTimeout(() => {
      if (!keepListeningRef.current || !recognitionRef.current || isSpeakingRef.current) return;
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err: any) {
        // "already started" error is safe to ignore
        if (err.name !== "InvalidStateError") {
          console.debug("[VoiceAssistant] Restart attempt:", err);
        }
      }
    }, 100);
  }, []);

  // Watchdog timer: guarantees continuous listening stays alive even across silent pauses or browser timeouts
  useEffect(() => {
    const watchdog = setInterval(() => {
      if (keepListeningRef.current && !isSpeakingRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch {}
      }
    }, 800);

    return () => clearInterval(watchdog);
  }, []);

  // Execute and process a command (from mic or suggestion click)
  const handleExecuteCommand = useCallback(
    (commandText: string) => {
      // Avoid processing the assistant's own speech
      if (isSpeakingRef.current) return;

      setTranscript(`"${commandText}"`);
      const result = processVoiceCommand(commandText, state, actions);
      setAssistantReply(result.response);

      // Speak confirmation
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      speakResponse(
        result.response,
        voiceEnabled,
        () => {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          // Continue listening seamlessly
          if (keepListeningRef.current) {
            restartRecognition();
          }
        },
        () => {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
        }
      );

      // Automatically reset user transcript bubble after 4 seconds to keep UI clean while listening
      if (clearTranscriptTimerRef.current) clearTimeout(clearTranscriptTimerRef.current);
      clearTranscriptTimerRef.current = window.setTimeout(() => {
        setTranscript("");
      }, 4000);
    },
    [state, voiceEnabled, restartRecognition]
  );

  // Initialize Speech Recognition on Mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      null;

    if (!SpeechRecognition) {
      setHasSpeechRecognition(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Continuous listening: does not stop after a single sentence!
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      if (isSpeakingRef.current) return;

      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      const activeText = finalTranscript || interimTranscript;
      if (activeText.trim()) {
        setTranscript(activeText);
      }

      if (finalTranscript.trim()) {
        handleExecuteCommand(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        // Normal silence timeout in continuous mode; auto-restart if we want to keep listening
        if (keepListeningRef.current) {
          restartRecognition();
        }
        return;
      }

      if (event.error === "not-allowed") {
        keepListeningRef.current = false;
        setIsListening(false);
        setAssistantReply("Microphone access denied. Please allow microphone permission in your browser.");
        return;
      }

      console.warn("[VoiceAssistant] Speech error:", event.error);
      if (keepListeningRef.current) {
        restartRecognition();
      }
    };

    recognition.onend = () => {
      // If user enabled assistant, keep listening continuously!
      if (keepListeningRef.current) {
        restartRecognition();
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      keepListeningRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (clearTranscriptTimerRef.current) clearTimeout(clearTranscriptTimerRef.current);
      try {
        recognition.abort();
      } catch {}
    };
  }, [handleExecuteCommand, restartRecognition]);


  // Turn on/off Assistant
  const handleToggleAssistant = () => {
    if (isOpen && keepListeningRef.current) {
      // User explicitly wants to turn off assistant
      keepListeningRef.current = false;
      setIsListening(false);
      setIsOpen(false);
      try {
        recognitionRef.current?.stop();
      } catch {}
      return;
    }

    // Turn ON assistant: keep listening continuously!
    keepListeningRef.current = true;
    setIsOpen(true);
    setIsListening(true);
    setTranscript("");
    setAssistantReply(GREETING_TEXT);

    // Speak greeting aloud
    if (voiceEnabled) {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      speakResponse(
        GREETING_TEXT,
        true,
        () => {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          if (keepListeningRef.current) {
            restartRecognition();
          }
        },
        () => {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
        }
      );
    }

    if (!hasSpeechRecognition) {
      setAssistantReply("Speech recognition is not supported in this browser. You can tap any suggestion chip below to test commands!");
      return;
    }

    try {
      recognitionRef.current?.start();
    } catch (e) {
      console.debug("[VoiceAssistant] Start error:", e);
    }
  };

  const handleClosePanel = () => {
    keepListeningRef.current = false;
    setIsListening(false);
    setIsOpen(false);
    try {
      recognitionRef.current?.stop();
    } catch {}
  };

  return (
    <div className={`voice-assistant voice-assistant--left ${isOpen ? "voice-assistant--open" : ""}`}>
      {/* 3D Robot Voice Assistant Button on Left Side */}
      <button
        id="voice-assistant-toggle"
        className={`voice-assistant__robot-btn ${isListening ? "voice-assistant__robot-btn--active" : ""}`}
        onClick={handleToggleAssistant}
        title={isListening ? "EV Copilot Listening Continuously (Click to stop)" : "3D EV Copilot Voice Assistant — Click to speak"}
        aria-label="3D EV Voice Assistant"
      >
        <div className="voice-assistant__avatar-container">
          <img
            src="/ai_robot.png"
            alt="3D AI Assistant"
            className="voice-assistant__robot-img"
          />
          {isListening && <div className="voice-assistant__glow-ring" />}
        </div>

        <div className="voice-assistant__meta">
          <div className="voice-assistant__status-row">
            <span className={`voice-assistant__dot ${isListening ? "voice-assistant__dot--pulsing" : ""}`} />
            <span className="voice-assistant__name">EV Copilot</span>
          </div>
          <span className="voice-assistant__callout">
            {isSpeaking
              ? "Speaking... 🔊"
              : isListening
              ? "Listening continuously 🎙️"
              : "Tap to activate 🎙️"}
          </span>
        </div>

        {isListening && (
          <div className="voice-assistant__waves">
            <span className="wave wave-1" />
            <span className="wave wave-2" />
            <span className="wave wave-3" />
            <span className="wave wave-4" />
          </div>
        )}
      </button>

      {/* Expandable Holographic Assistant Dialogue Card */}
      {isOpen && (
        <div className="voice-assistant__panel voice-assistant__panel--left">
          <div className="voice-assistant__header">
            <div className="voice-assistant__title">
              <span className="voice-assistant__badge">Always Listening</span>
              <span>Voice Control</span>
            </div>
            <div className="voice-assistant__actions">
              <button
                className={`voice-assistant__btn-icon ${voiceEnabled ? "voice-assistant__btn-icon--active" : ""}`}
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                title={voiceEnabled ? "Mute Voice Audio" : "Enable Voice Audio"}
              >
                {voiceEnabled ? "🔊" : "🔇"}
              </button>
              <button
                className="voice-assistant__btn-icon"
                onClick={handleClosePanel}
                title="Turn Off Assistant"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Spoken Transcript & Assistant Response */}
          <div className="voice-assistant__body">
            <div className="voice-assistant__ai-bubble">
              <div className="voice-assistant__ai-avatar-wrap">
                <img src="/ai_robot.png" alt="AI Robot" className="voice-assistant__ai-mini-img" />
              </div>
              <div className="voice-assistant__ai-text">
                <p>{assistantReply}</p>
              </div>
            </div>

            {transcript && (
              <div className="voice-assistant__user-bubble">
                <span className="voice-assistant__bubble-label">You said:</span>
                <p>{transcript}</p>
              </div>
            )}
          </div>

          {/* Quick Voice Suggestions */}
          <div className="voice-assistant__footer">
            <div className="voice-assistant__suggestions-title">Say anytime or tap:</div>
            <div className="voice-assistant__chips">
              {SUGGESTIONS.map((cmd) => (
                <button
                  key={cmd}
                  className="voice-assistant__chip"
                  onClick={() => handleExecuteCommand(cmd)}
                >
                  💬 {cmd}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
