/**
 * Simple & Clean Settings Panel
 * Allows driver to toggle between Dark / Light theme
 * and switch SIA voice assistant language (English, Hindi, Marathi).
 */
import { useState } from "react";
import {
  LANGUAGE_CONFIG,
  speakResponse,
  type AssistantLanguage,
} from "../services/voiceAssistant";

export type DashboardTheme = "dark" | "light";

interface SettingsWidgetProps {
  theme: DashboardTheme;
  onThemeChange: (theme: DashboardTheme) => void;
  language: AssistantLanguage;
  onLanguageChange: (lang: AssistantLanguage) => void;
  voiceEnabled: boolean;
  onVoiceToggle: (enabled: boolean) => void;
}

export default function SettingsWidget({
  theme,
  onThemeChange,
  language,
  onLanguageChange,
  voiceEnabled,
  onVoiceToggle,
}: SettingsWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const currentLangMeta = LANGUAGE_CONFIG[language];

  // Live audio test in selected language
  const handleTestVoice = () => {
    if (previewPlaying) return;
    setPreviewPlaying(true);
    const testPhrase =
      language === "hi"
        ? "नमस्ते! मैं सिया हूँ। आपकी ईवी प्रणाली पूरी तरह तैयार है।"
        : language === "mr"
        ? "नमस्कार! मी सिया आहे. तुमची ईव्ही प्रणाली पूर्णपणे तयार आहे."
        : "Hello! I am SIA. All vehicle systems are operational.";

    speakResponse(
      testPhrase,
      true,
      () => setPreviewPlaying(false),
      () => setPreviewPlaying(true),
      language
    );
  };

  return (
    <div className={`settings-widget ${isOpen ? "settings-widget--open" : ""}`}>
      {/* Floating Capsule Button on Right Side */}
      <button
        id="settings-toggle-btn"
        className={`settings-widget__btn ${isOpen ? "settings-widget__btn--active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Settings"
        aria-label="Settings"
      >
        <div className="settings-widget__icon-wrap">
          <span className="settings-widget__gear-icon">⚙️</span>
        </div>
        <div className="settings-widget__meta">
          <span className="settings-widget__title">Settings</span>
          <span className="settings-widget__sub">
            {theme === "dark" ? "🌙 Dark" : "☀️ Light"} • {currentLangMeta.nativeName}
          </span>
        </div>
      </button>

      {/* Clean Simple Settings Panel */}
      {isOpen && (
        <div className="settings-widget__panel">
          <div className="settings-widget__header">
            <span className="settings-widget__header-title">⚙️ Settings</span>
            <button
              className="settings-widget__close-btn"
              onClick={() => setIsOpen(false)}
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="settings-widget__body">
            {/* 1. THEME */}
            <div className="settings-widget__section">
              <div className="settings-widget__section-label">Theme</div>
              <div className="settings-widget__simple-grid">
                <button
                  type="button"
                  className={`settings-widget__simple-btn ${
                    theme === "dark" ? "settings-widget__simple-btn--active" : ""
                  }`}
                  onClick={() => onThemeChange("dark")}
                >
                  🌙 Dark
                </button>
                <button
                  type="button"
                  className={`settings-widget__simple-btn ${
                    theme === "light" ? "settings-widget__simple-btn--active" : ""
                  }`}
                  onClick={() => onThemeChange("light")}
                >
                  ☀️ Light
                </button>
              </div>
            </div>

            {/* 2. LANGUAGE */}
            <div className="settings-widget__section">
              <div className="settings-widget__section-label">Language</div>
              <div className="settings-widget__simple-grid settings-widget__simple-grid--3">
                <button
                  type="button"
                  className={`settings-widget__simple-btn ${
                    language === "en" ? "settings-widget__simple-btn--active" : ""
                  }`}
                  onClick={() => onLanguageChange("en")}
                >
                  🇬🇧 English
                </button>
                <button
                  type="button"
                  className={`settings-widget__simple-btn ${
                    language === "hi" ? "settings-widget__simple-btn--active" : ""
                  }`}
                  onClick={() => onLanguageChange("hi")}
                >
                  🇮🇳 हिन्दी
                </button>
                <button
                  type="button"
                  className={`settings-widget__simple-btn ${
                    language === "mr" ? "settings-widget__simple-btn--active" : ""
                  }`}
                  onClick={() => onLanguageChange("mr")}
                >
                  🇮🇳 मराठी
                </button>
              </div>
            </div>

            {/* 3. TEST VOICE & MUTE */}
            <div className="settings-widget__preview-row">
              <button
                type="button"
                className={`settings-widget__preview-btn ${
                  previewPlaying ? "settings-widget__preview-btn--playing" : ""
                }`}
                onClick={handleTestVoice}
                disabled={previewPlaying}
              >
                {previewPlaying ? "🔊 Playing..." : "▶️ Test Voice"}
              </button>
              <button
                type="button"
                className={`settings-widget__mute-toggle ${
                  voiceEnabled ? "settings-widget__mute-toggle--on" : ""
                }`}
                onClick={() => onVoiceToggle(!voiceEnabled)}
              >
                {voiceEnabled ? "🔊 Voice On" : "🔇 Muted"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
