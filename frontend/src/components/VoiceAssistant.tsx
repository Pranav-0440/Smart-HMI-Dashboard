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
  formatWarningForSpeech,
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
  "Check warnings",
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [assistantReply, setAssistantReply] = useState<string>(GREETING_TEXT);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const keepListeningRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const restartTimerRef = useRef<number | null>(null);
  const clearTranscriptTimerRef = useRef<number | null>(null);
  const handleExecuteCommandRef = useRef<(cmd: string, isManual?: boolean) => void>(() => {});
  const accumulatedSpeechRef = useRef<string>("");
  const speechDebounceTimerRef = useRef<number | null>(null);
  const warningRepeatTimerRef = useRef<number | null>(null);
  const currentTTSUtteranceTextRef = useRef<string>("");
  const warningPauseUntilRef = useRef<number>(0);

  const warningsRef = useRef<string[]>(state.warnings || []);
  const voiceEnabledRef = useRef<boolean>(voiceEnabled);
  const prevWarningsKeyRef = useRef<string>("");
  const hadWarningsRef = useRef<boolean>(false);

  warningsRef.current = state.warnings || [];
  voiceEnabledRef.current = voiceEnabled;

  const warningsKey = (state.warnings || []).join("||");

  const actions: VoiceAssistantActions = {
    onToggleControl: onControl,
    onSetMode: onMode,
    onSetThrottle: onThrottle,
    onSetBrake: onBrake,
    onSetSlope: onSlope,
    onReset,
    onMuteWarnings: (durationMs = 30000) => {
      warningPauseUntilRef.current = Date.now() + durationMs;
      if (warningRepeatTimerRef.current) {
        clearTimeout(warningRepeatTimerRef.current);
        warningRepeatTimerRef.current = null;
      }
    },
  };

  // Acoustic Echo Filter: reject captured audio that matches assistant's own TTS output
  const isDeviceAudioEcho = useCallback((recognizedText: string): boolean => {
    const currentTTS = currentTTSUtteranceTextRef.current;
    if (!currentTTS) return false;

    const cleanRec = recognizedText.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    const cleanSpoken = currentTTS.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

    if (!cleanRec || !cleanSpoken) return false;

    const isDistinctUserCommand = (text: string) => {
      const distinctKeywords = [
        "left indicator", "right indicator", "turn on", "turn off",
        "headlight", "sport mode", "eco mode", "normal mode",
        "accelerate", "brake", "hazard", "speed",
        "what is my", "battery", "range", "temperature",
        "mute", "silence", "quiet", "stop talking", "shut up",
        "door", "seatbelt", "reset"
      ];
      return distinctKeywords.some((kw) => text.includes(kw));
    };

    if (isDistinctUserCommand(cleanRec) && !cleanSpoken.includes(cleanRec)) {
      return false; // Valid driver command
    }

    if (cleanSpoken.includes(cleanRec)) {
      return true;
    }

    const recWords = cleanRec.split(/\s+/).filter((w) => w.length > 2);
    const spokenWords = new Set(cleanSpoken.split(/\s+/).filter((w) => w.length > 2));

    if (recWords.length === 0) return true;

    let matchCount = 0;
    for (const w of recWords) {
      if (spokenWords.has(w)) matchCount++;
    }

    const overlap = matchCount / recWords.length;
    return overlap >= 0.4;
  }, []);

  // Continuous Full-Duplex Speech Recognition instance
  const createAndStartRecognition = useCallback(() => {
    if (!keepListeningRef.current || typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      null;

    if (!SpeechRecognition) return;

    try {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    } catch {}

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let currentInterim = "";
      let currentFinal = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          currentFinal += item[0].transcript + " ";
        } else {
          currentInterim += item[0].transcript;
        }
      }

      const rawNew = (currentFinal || currentInterim).trim();
      if (!rawNew) return;

      if (isDeviceAudioEcho(rawNew)) {
        return;
      }

      if (currentFinal.trim()) {
        accumulatedSpeechRef.current = (accumulatedSpeechRef.current + " " + currentFinal).trim();
      }

      const activeText = (accumulatedSpeechRef.current + " " + currentInterim).trim();
      if (!activeText) return;

      if (isDeviceAudioEcho(activeText)) {
        accumulatedSpeechRef.current = "";
        return;
      }

      setTranscript(activeText);

      // Barge-in: If user starts speaking while Copilot is speaking or repeating warnings, cancel TTS immediately
      if (isSpeakingRef.current || (typeof window !== "undefined" && window.speechSynthesis?.speaking)) {
        try {
          window.speechSynthesis?.cancel();
        } catch {}
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        currentTTSUtteranceTextRef.current = "";
        warningPauseUntilRef.current = Date.now() + 7000;
        if (warningRepeatTimerRef.current) {
          clearTimeout(warningRepeatTimerRef.current);
          warningRepeatTimerRef.current = null;
        }
      }

      // Debounce 700ms silence to receive complete phrase
      if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
      speechDebounceTimerRef.current = window.setTimeout(() => {
        const fullPhrase = accumulatedSpeechRef.current.trim();
        if (fullPhrase && fullPhrase.length >= 3) {
          accumulatedSpeechRef.current = "";
          if (!isDeviceAudioEcho(fullPhrase)) {
            handleExecuteCommandRef.current(fullPhrase, false);
          }
        }
      }, 700);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        keepListeningRef.current = false;
        setIsOpen(false);
        setAssistantReply("Microphone access denied. Please allow microphone permission in your browser.");
        return;
      }
      if (keepListeningRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = window.setTimeout(createAndStartRecognition, 200);
      }
    };

    recognition.onend = () => {
      if (accumulatedSpeechRef.current.trim().length >= 3) {
        const fullPhrase = accumulatedSpeechRef.current.trim();
        accumulatedSpeechRef.current = "";
        if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
        if (!isDeviceAudioEcho(fullPhrase)) {
          handleExecuteCommandRef.current(fullPhrase, false);
        }
      }

      if (keepListeningRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = window.setTimeout(createAndStartRecognition, 100);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err: any) {
      if (err.name !== "InvalidStateError") {
        console.debug("[VoiceAssistant] Start attempt:", err);
      }
    }
  }, [isDeviceAudioEcho]);

  // Execute and process command
  const handleExecuteCommand = useCallback(
    (commandText: string, isManual: boolean = false) => {
      try {
        window.speechSynthesis?.cancel();
      } catch {}
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      currentTTSUtteranceTextRef.current = "";

      // Pause repeating warnings for 7s so command response is heard clearly
      warningPauseUntilRef.current = Date.now() + 7000;
      if (warningRepeatTimerRef.current) {
        clearTimeout(warningRepeatTimerRef.current);
        warningRepeatTimerRef.current = null;
      }

      setTranscript(`"${commandText}"`);
      const result = processVoiceCommand(commandText, state, actions);
      setAssistantReply(result.response);

      if (result.matched || isManual) {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
        currentTTSUtteranceTextRef.current = result.response.toLowerCase().trim();

        speakResponse(
          result.response,
          voiceEnabled,
          () => {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            currentTTSUtteranceTextRef.current = "";
          },
          () => {
            isSpeakingRef.current = true;
            setIsSpeaking(true);
          }
        );
      }

      if (clearTranscriptTimerRef.current) clearTimeout(clearTranscriptTimerRef.current);
      clearTranscriptTimerRef.current = window.setTimeout(() => {
        setTranscript("");
      }, 4000);
    },
    [state, voiceEnabled]
  );

  handleExecuteCommandRef.current = handleExecuteCommand;

  // Watchdog timer: keep continuous recognition alive
  useEffect(() => {
    const watchdog = setInterval(() => {
      if (keepListeningRef.current) {
        try {
          if (!recognitionRef.current) {
            createAndStartRecognition();
          } else {
            recognitionRef.current.start();
          }
        } catch {}
      }
    }, 1200);

    return () => clearInterval(watchdog);
  }, [createAndStartRecognition]);

  // Audible Warning Repeater: Speaks active warnings aloud and repeats every 2 seconds until cleared
  const announceWarningsLoop = useCallback(() => {
    if (warningRepeatTimerRef.current) {
      clearTimeout(warningRepeatTimerRef.current);
      warningRepeatTimerRef.current = null;
    }

    const currentWarnings = warningsRef.current;
    if (!currentWarnings || currentWarnings.length === 0) {
      return;
    }

    // Check if warnings are temporarily paused (driver speaking or muted)
    const now = Date.now();
    if (now < warningPauseUntilRef.current) {
      const remainingPause = warningPauseUntilRef.current - now;
      warningRepeatTimerRef.current = window.setTimeout(announceWarningsLoop, Math.max(600, remainingPause));
      return;
    }

    // If currently speaking a command or greeting, wait and check again shortly
    if (isSpeakingRef.current || (typeof window !== "undefined" && window.speechSynthesis?.speaking)) {
      warningRepeatTimerRef.current = window.setTimeout(announceWarningsLoop, 500);
      return;
    }

    const spokenText = currentWarnings.map(formatWarningForSpeech).join(" ");
    setAssistantReply(`🚨 ${spokenText}`);

    if (voiceEnabledRef.current) {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      currentTTSUtteranceTextRef.current = spokenText.toLowerCase().trim();

      speakResponse(
        spokenText,
        true,
        () => {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          currentTTSUtteranceTextRef.current = "";

          // Schedule NEXT repeat exactly 2 seconds after speech completes!
          if (warningsRef.current && warningsRef.current.length > 0) {
            if (warningRepeatTimerRef.current) clearTimeout(warningRepeatTimerRef.current);
            warningRepeatTimerRef.current = window.setTimeout(() => {
              announceWarningsLoop();
            }, 2000);
          }
        },
        () => {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
        }
      );
    } else {
      // Voice muted in UI settings, re-check in 2s
      if (warningRepeatTimerRef.current) clearTimeout(warningRepeatTimerRef.current);
      warningRepeatTimerRef.current = window.setTimeout(announceWarningsLoop, 2000);
    }
  }, []);

  // Trigger announcement loop whenever warnings change or appear
  useEffect(() => {
    prevWarningsKeyRef.current = warningsKey;

    if (!warningsKey) {
      if (warningRepeatTimerRef.current) {
        clearTimeout(warningRepeatTimerRef.current);
        warningRepeatTimerRef.current = null;
      }
      if (hadWarningsRef.current) {
        hadWarningsRef.current = false;
        setAssistantReply("✅ All warnings cleared. System status normal.");
        if (voiceEnabledRef.current) {
          speakResponse("All warnings cleared. System status normal.", true);
        }
      }
      return;
    }

    hadWarningsRef.current = true;
    const spokenText = (state.warnings || []).map(formatWarningForSpeech).join(" ");
    setAssistantReply(`🚨 ${spokenText}`);

    // If loop isn't active, kick off immediately
    if (!warningRepeatTimerRef.current && !isSpeakingRef.current) {
      warningRepeatTimerRef.current = window.setTimeout(announceWarningsLoop, 100);
    }
  }, [warningsKey, announceWarningsLoop]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      keepListeningRef.current = false;
      isSpeakingRef.current = false;
      if (warningRepeatTimerRef.current) clearTimeout(warningRepeatTimerRef.current);
      if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (clearTranscriptTimerRef.current) clearTimeout(clearTranscriptTimerRef.current);
      try {
        window.speechSynthesis?.cancel();
        recognitionRef.current?.abort();
      } catch {}
    };
  }, []);

  // Turn on/off Assistant
  const handleToggleAssistant = () => {
    if (isOpen && keepListeningRef.current) {
      // User explicitly wants to turn off assistant
      keepListeningRef.current = false;
      isSpeakingRef.current = false;
      setIsOpen(false);
      setIsSpeaking(false);
      accumulatedSpeechRef.current = "";
      if (warningRepeatTimerRef.current) clearTimeout(warningRepeatTimerRef.current);
      if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try {
        window.speechSynthesis?.cancel();
        recognitionRef.current?.abort();
      } catch {}
      return;
    }

    // Turn ON assistant: keep listening continuously!
    keepListeningRef.current = true;
    setIsOpen(true);
    setTranscript("");
    accumulatedSpeechRef.current = "";
    setAssistantReply(GREETING_TEXT);

    // Speak initial greeting, then start speech recognition cleanly!
    if (voiceEnabled) {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      try {
        recognitionRef.current?.abort();
      } catch {}

      speakResponse(
        GREETING_TEXT,
        true,
        () => {
          setTimeout(() => {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            if (keepListeningRef.current) {
              createAndStartRecognition();
            }
          }, 300);
        },
        () => {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
        }
      );
    } else {
      createAndStartRecognition();
    }
  };

  const handleClosePanel = () => {
    keepListeningRef.current = false;
    isSpeakingRef.current = false;
    setIsOpen(false);
    setIsSpeaking(false);
    accumulatedSpeechRef.current = "";
    if (warningRepeatTimerRef.current) clearTimeout(warningRepeatTimerRef.current);
    if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    try {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort();
    } catch {}
  };

  const hasWarnings = Boolean(state.warnings && state.warnings.length > 0);

  return (
    <div className={`voice-assistant voice-assistant--left ${isOpen ? "voice-assistant--open" : ""}`}>
      {/* 3D Robot Voice Assistant Button on Left Side */}
      <button
        id="voice-assistant-toggle"
        className={`voice-assistant__robot-btn ${
          isOpen ? "voice-assistant__robot-btn--active" : ""
        } ${hasWarnings ? "voice-assistant__robot-btn--warning" : ""}`}
        onClick={handleToggleAssistant}
        title={
          isOpen
            ? "EV Copilot Listening Continuously (Click to turn off)"
            : "3D EV Copilot Voice Assistant — Click to speak"
        }
        aria-label="3D EV Voice Assistant"
      >
        <div className="voice-assistant__avatar-container">
          <img
            src="/ai_robot.png"
            alt="3D AI Assistant"
            className="voice-assistant__robot-img"
          />
          {(isOpen || hasWarnings) && (
            <div
              className={`voice-assistant__glow-ring ${
                hasWarnings ? "voice-assistant__glow-ring--warning" : ""
              }`}
            />
          )}
        </div>

        <div className="voice-assistant__meta">
          <div className="voice-assistant__status-row">
            <span
              className={`voice-assistant__dot ${
                hasWarnings
                  ? "voice-assistant__dot--warning"
                  : isOpen
                  ? "voice-assistant__dot--pulsing"
                  : ""
              }`}
            />
            <span className="voice-assistant__name">EV Copilot</span>
          </div>
          <span className="voice-assistant__callout">
            {hasWarnings
              ? "🚨 Active Warning!"
              : isSpeaking
              ? "Speaking... 🔊"
              : isOpen
              ? "Listening continuously 🎙️"
              : "Tap to activate 🎙️"}
          </span>
        </div>

        {(isOpen || hasWarnings) && (
          <div
            className={`voice-assistant__waves ${
              hasWarnings ? "voice-assistant__waves--warning" : ""
            }`}
          >
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
                  onClick={() => handleExecuteCommand(cmd, true)}
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
