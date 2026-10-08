/**
 * Voice Assistant Component
 * Floating interactive AI Voice Assistant for EV-HMI Dashboard.
 * Listens to driver voice commands and responds with voice audio and visual feedback.
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
  "What is my battery?",
  "What is my speed?",
  "Turn on hazard lights",
  "Accelerate",
  "Slow down",
];

// Browser SpeechRecognition interface declaration
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
  const [transcript, setTranscript] = useState("");
  const [assistantReply, setAssistantReply] = useState<string>(
    "Hi! I'm your EV Copilot. Tap the mic and say a command like 'Turn on left indicator' or 'Switch to Sport mode'."
  );
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [hasSpeechRecognition, setHasSpeechRecognition] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);

  const actions: VoiceAssistantActions = {
    onToggleControl: onControl,
    onSetMode: onMode,
    onSetThrottle: onThrottle,
    onSetBrake: onBrake,
    onSetSlope: onSlope,
    onReset,
  };

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
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript("Listening...");
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const text = event.results[current][0].transcript;
      setTranscript(text);

      if (event.results[current].isFinal) {
        handleExecuteCommand(text);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("[VoiceAssistant] Speech error:", event.error);
      setIsListening(false);
      if (event.error === "not-allowed") {
        setAssistantReply("Microphone access was denied. Please allow microphone permissions in your browser.");
      } else if (event.error !== "no-speech") {
        setAssistantReply(`Voice recognition notice: ${event.error}. You can also tap any suggestion chip below.`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, []);

  // Execute and process a command (from mic or suggestion click)
  const handleExecuteCommand = useCallback(
    (commandText: string) => {
      setTranscript(`"${commandText}"`);
      const result = processVoiceCommand(commandText, state, actions);
      setAssistantReply(result.response);
      speakResponse(result.response, voiceEnabled);
    },
    [state, voiceEnabled]
  );

  // Toggle listening
  const toggleListening = () => {
    if (!hasSpeechRecognition) {
      setAssistantReply("Speech recognition is not supported in this browser. You can tap any suggestion chip below to test commands!");
      setIsOpen(true);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setIsOpen(true);
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.warn("[VoiceAssistant] Start error:", e);
      }
    }
  };

  return (
    <div className={`voice-assistant ${isOpen ? "voice-assistant--open" : ""}`}>
      {/* Floating Trigger Orb / Mic Button */}
      <button
        id="voice-assistant-toggle"
        className={`voice-assistant__orb ${isListening ? "voice-assistant__orb--listening" : ""}`}
        onClick={toggleListening}
        title={isListening ? "Listening... (Click to stop)" : "EV Voice Assistant (Click to speak)"}
        aria-label="Voice Assistant"
      >
        <span className="voice-assistant__orb-icon">{isListening ? "🎙️" : "✨"}</span>
        {isListening && (
          <div className="voice-assistant__waves">
            <span className="wave wave-1" />
            <span className="wave wave-2" />
            <span className="wave wave-3" />
            <span className="wave wave-4" />
          </div>
        )}
        <span className="voice-assistant__orb-label">{isListening ? "Listening..." : "Voice Assistant"}</span>
      </button>

      {/* Expandable Assistant Card */}
      {isOpen && (
        <div className="voice-assistant__panel">
          <div className="voice-assistant__header">
            <div className="voice-assistant__title">
              <span className="voice-assistant__badge">AI Copilot</span>
              <span>EV Voice Control</span>
            </div>
            <div className="voice-assistant__actions">
              <button
                className={`voice-assistant__btn-icon ${voiceEnabled ? "voice-assistant__btn-icon--active" : ""}`}
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                title={voiceEnabled ? "Mute Voice Feedback" : "Enable Voice Feedback"}
              >
                {voiceEnabled ? "🔊" : "🔇"}
              </button>
              <button
                className="voice-assistant__btn-icon"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Spoken Transcript & Assistant Response */}
          <div className="voice-assistant__body">
            {transcript && (
              <div className="voice-assistant__user-bubble">
                <span className="voice-assistant__bubble-label">You:</span>
                <p>{transcript}</p>
              </div>
            )}

            <div className="voice-assistant__ai-bubble">
              <div className="voice-assistant__ai-avatar">⚡</div>
              <div className="voice-assistant__ai-text">
                <p>{assistantReply}</p>
              </div>
            </div>
          </div>

          {/* Quick Voice Suggestions */}
          <div className="voice-assistant__footer">
            <div className="voice-assistant__suggestions-title">Try saying or tap to test:</div>
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
