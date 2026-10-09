/**
 * 3D AI Robot Voice Assistant Component
 * Floating on the left side of the dashboard.
 * Supports multilingual voice control in English, Hindi (हिन्दी), and Marathi (मराठी).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import type { VehicleState, DriveMode } from "../types/vehicle";
import {
  processVoiceCommand,
  speakResponse,
  formatWarningForSpeech,
  LANGUAGE_CONFIG,
  type AssistantLanguage,
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
  language?: AssistantLanguage;
  onLanguageChange?: (lang: AssistantLanguage) => void;
  voiceEnabled?: boolean;
  onVoiceToggle?: (enabled: boolean) => void;
}

type SpeechRecognitionType = any;

export default function VoiceAssistant({
  state,
  onControl,
  onMode,
  onThrottle,
  onBrake,
  onSlope,
  onReset,
  language: propLanguage,
  onLanguageChange: propOnLanguageChange,
  voiceEnabled: propVoiceEnabled,
  onVoiceToggle: propOnVoiceToggle,
}: VoiceAssistantProps) {
  const [internalLanguage, setInternalLanguage] = useState<AssistantLanguage>("en");
  const [internalVoiceEnabled, setInternalVoiceEnabled] = useState(true);

  const language = propLanguage !== undefined ? propLanguage : internalLanguage;
  const voiceEnabled = propVoiceEnabled !== undefined ? propVoiceEnabled : internalVoiceEnabled;

  const [isOpen, setIsOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [assistantReply, setAssistantReply] = useState<string>(LANGUAGE_CONFIG[language].greeting);

  const languageRef = useRef<AssistantLanguage>(language);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const keepListeningRef = useRef<boolean>(false);
  const isGreetingPlayingRef = useRef<boolean>(false);
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

  languageRef.current = language;
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
        "door", "seatbelt", "reset", "चालू", "बंद", "इंडिकेटर", "हेडलाइट"
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

  // Continuous Speech Recognition instance configured with selected language
  const createAndStartRecognition = useCallback(() => {
    if (!keepListeningRef.current || isGreetingPlayingRef.current || typeof window === "undefined") return;

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
    // Set locale based on chosen language (en-IN / hi-IN / mr-IN)
    recognition.lang = LANGUAGE_CONFIG[languageRef.current].recognitionLang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      if (isGreetingPlayingRef.current) {
        accumulatedSpeechRef.current = "";
        setTranscript("");
        return;
      }

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
        if (fullPhrase && fullPhrase.length >= 2) {
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
        isGreetingPlayingRef.current = false;
        setIsOpen(false);
        setAssistantReply("Microphone access denied. Please allow microphone permission in your browser.");
        return;
      }
      if (keepListeningRef.current && !isGreetingPlayingRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = window.setTimeout(createAndStartRecognition, 200);
      }
    };

    recognition.onend = () => {
      if (isGreetingPlayingRef.current) return;

      if (accumulatedSpeechRef.current.trim().length >= 2) {
        const fullPhrase = accumulatedSpeechRef.current.trim();
        accumulatedSpeechRef.current = "";
        if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
        if (!isDeviceAudioEcho(fullPhrase)) {
          handleExecuteCommandRef.current(fullPhrase, false);
        }
      }

      if (keepListeningRef.current && !isGreetingPlayingRef.current) {
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

  // Execute and process command in active language
  const handleExecuteCommand = useCallback(
    (commandText: string, isManual: boolean = false) => {
      const currentLang = languageRef.current;
      const result = processVoiceCommand(commandText, state, actions, isManual, currentLang);

      // If missing the mandatory wake word, skip input silently
      if (result.skipped) {
        console.debug("[VoiceAssistant] Skipping input without wake word:", commandText);
        setTranscript("");
        return;
      }

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
          },
          currentLang
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

  // Language Switch Handler
  const handleLanguageChange = (newLang: AssistantLanguage) => {
    if (newLang === language) return;
    if (propOnLanguageChange) {
      propOnLanguageChange(newLang);
    } else {
      setInternalLanguage(newLang);
    }
    languageRef.current = newLang;
    const newGreeting = LANGUAGE_CONFIG[newLang].greeting;
    setAssistantReply(newGreeting);

    // Restart speech recognition with new language acoustic model
    if (keepListeningRef.current && !isGreetingPlayingRef.current) {
      try {
        recognitionRef.current?.abort();
      } catch {}
      setTimeout(() => {
        if (keepListeningRef.current) {
          createAndStartRecognition();
        }
      }, 150);
    }

    if (voiceEnabled) {
      speakResponse(newGreeting, true, undefined, undefined, newLang);
    }
  };

  // Sync external language changes from SettingsWidget
  useEffect(() => {
    if (propLanguage && propLanguage !== languageRef.current) {
      languageRef.current = propLanguage;
      const newGreeting = LANGUAGE_CONFIG[propLanguage].greeting;
      setAssistantReply(newGreeting);

      if (keepListeningRef.current && !isGreetingPlayingRef.current) {
        try {
          recognitionRef.current?.abort();
        } catch {}
        setTimeout(() => {
          if (keepListeningRef.current) {
            createAndStartRecognition();
          }
        }, 150);
      }
    }
  }, [propLanguage, createAndStartRecognition]);

  // Watchdog timer: keep continuous recognition alive
  useEffect(() => {
    const watchdog = setInterval(() => {
      if (keepListeningRef.current && !isGreetingPlayingRef.current) {
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
    if (isSpeakingRef.current || isGreetingPlayingRef.current || (typeof window !== "undefined" && window.speechSynthesis?.speaking)) {
      warningRepeatTimerRef.current = window.setTimeout(announceWarningsLoop, 500);
      return;
    }

    const currentLang = languageRef.current;
    const spokenText = currentWarnings.map((w) => formatWarningForSpeech(w, currentLang)).join(" ");
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
        },
        currentLang
      );
    } else {
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
        const clearedMsg =
          languageRef.current === "hi"
            ? "✅ सभी चेतावनियाँ हट गईं। सिस्टम सामान्य है।"
            : languageRef.current === "mr"
            ? "✅ सर्व चेतावण्या साफ झाल्या. यंत्रणा सुरळीत आहे."
            : "✅ All warnings cleared. System status normal.";

        setAssistantReply(clearedMsg);
        if (voiceEnabledRef.current) {
          speakResponse(clearedMsg, true, undefined, undefined, languageRef.current);
        }
      }
      return;
    }

    hadWarningsRef.current = true;
    const spokenText = (state.warnings || []).map((w) => formatWarningForSpeech(w, languageRef.current)).join(" ");
    setAssistantReply(`🚨 ${spokenText}`);

    if (!warningRepeatTimerRef.current && !isSpeakingRef.current && !isGreetingPlayingRef.current) {
      warningRepeatTimerRef.current = window.setTimeout(announceWarningsLoop, 100);
    }
  }, [warningsKey, announceWarningsLoop]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      keepListeningRef.current = false;
      isGreetingPlayingRef.current = false;
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
    if (isOpen && (keepListeningRef.current || isGreetingPlayingRef.current)) {
      // User explicitly wants to turn off assistant
      keepListeningRef.current = false;
      isGreetingPlayingRef.current = false;
      isSpeakingRef.current = false;
      setIsOpen(false);
      setIsSpeaking(false);
      accumulatedSpeechRef.current = "";
      setTranscript("");
      if (warningRepeatTimerRef.current) clearTimeout(warningRepeatTimerRef.current);
      if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try {
        window.speechSynthesis?.cancel();
        recognitionRef.current?.abort();
      } catch {}
      return;
    }

    // Turn ON assistant:
    const greeting = LANGUAGE_CONFIG[language].greeting;
    setIsOpen(true);
    setTranscript("");
    accumulatedSpeechRef.current = "";
    setAssistantReply(greeting);

    keepListeningRef.current = false;
    isGreetingPlayingRef.current = true;
    try {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.abort();
      }
    } catch {}

    if (voiceEnabled) {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      currentTTSUtteranceTextRef.current = greeting.toLowerCase();

      let greetingFinished = false;
      const startListeningNow = () => {
        if (greetingFinished) return;
        greetingFinished = true;
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        isGreetingPlayingRef.current = false;
        currentTTSUtteranceTextRef.current = "";
        setTranscript("");
        accumulatedSpeechRef.current = "";

        setTimeout(() => {
          keepListeningRef.current = true;
          createAndStartRecognition();
        }, 120);
      };

      speakResponse(
        greeting,
        true,
        startListeningNow,
        () => {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
          isGreetingPlayingRef.current = true;
        },
        language
      );

      // Safety fallback: if speech ends silently or is delayed, ensure listening starts
      setTimeout(startListeningNow, 2200);
    } else {
      isGreetingPlayingRef.current = false;
      keepListeningRef.current = true;
      createAndStartRecognition();
    }
  };

  const handleClosePanel = () => {
    keepListeningRef.current = false;
    isGreetingPlayingRef.current = false;
    isSpeakingRef.current = false;
    setIsOpen(false);
    setIsSpeaking(false);
    accumulatedSpeechRef.current = "";
    setTranscript("");
    if (warningRepeatTimerRef.current) clearTimeout(warningRepeatTimerRef.current);
    if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    try {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort();
    } catch {}
  };

  const hasWarnings = Boolean(state.warnings && state.warnings.length > 0);
  const currentLangConfig = LANGUAGE_CONFIG[language];

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
            ? `${currentLangConfig.name} SIA Copilot Listening (Click to turn off)`
            : `3D SIA AI Voice Assistant — Click to speak`
        }
        aria-label="3D SIA Voice Assistant"
      >
        <div className="voice-assistant__avatar-container">
          <img
            src="/ai_robot.png"
            alt="3D AI Assistant SIA"
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
            <span className="voice-assistant__name">SIA Copilot</span>
          </div>
          <span className="voice-assistant__callout">
            {hasWarnings
              ? "🚨 Active Warning!"
              : isSpeaking
              ? "Speaking... 🔊"
              : isOpen
              ? `${currentLangConfig.nativeName} Listening 🎙️`
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
              <span>SIA Control</span>
            </div>

            <div className="voice-assistant__actions">
              {/* Language Switcher: English, Hindi, Marathi */}
              <div className="voice-assistant__lang-switcher">
                {(["en", "hi", "mr"] as AssistantLanguage[]).map((l) => (
                  <button
                    key={l}
                    className={`voice-assistant__lang-btn ${
                      language === l ? "voice-assistant__lang-btn--active" : ""
                    }`}
                    onClick={() => handleLanguageChange(l)}
                    title={`Switch to ${LANGUAGE_CONFIG[l].name} (${LANGUAGE_CONFIG[l].nativeName})`}
                  >
                    {l === "en" ? "EN" : l === "hi" ? "हिन्दी" : "मराठी"}
                  </button>
                ))}
              </div>

              <button
                className={`voice-assistant__btn-icon ${voiceEnabled ? "voice-assistant__btn-icon--active" : ""}`}
                onClick={() =>
                  propOnVoiceToggle ? propOnVoiceToggle(!voiceEnabled) : setInternalVoiceEnabled(!voiceEnabled)
                }
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

          {/* Quick Voice Suggestions in Selected Language */}
          <div className="voice-assistant__footer">
            <div className="voice-assistant__suggestions-title">
              {language === "hi"
                ? "कभी भी बोलें या टैप करें:"
                : language === "mr"
                ? "कधीही बोला किंवा टॅप करा:"
                : "Say anytime or tap:"}
            </div>
            <div className="voice-assistant__chips">
              {currentLangConfig.suggestions.map((cmd) => (
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
