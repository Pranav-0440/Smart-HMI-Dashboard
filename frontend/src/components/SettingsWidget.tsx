/**
 * Settings Widget & Panel
 * Floating on the right side of the dashboard.
 * Allows driver to toggle between Dark / Light theme,
 * switch SIA voice language between English, Hindi, and Marathi,
 * and adjust voice assistant settings with instant audio preview.
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
      {/* Floating Settings Button on Right Side */}
      <button
        id="settings-toggle-btn"
        className={`settings-widget__btn ${isOpen ? "settings-widget__btn--active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Dashboard & SIA Voice Settings"
        aria-label="Dashboard Settings"
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

      {/* Expandable Settings Modal / Drawer Card */}
      {isOpen && (
        <div className="settings-widget__panel">
          <div className="settings-widget__header">
            <div className="settings-widget__header-title">
              <span className="settings-widget__badge">Preferences</span>
              <span>Vehicle & Voice Settings</span>
            </div>
            <button
              className="settings-widget__close-btn"
              onClick={() => setIsOpen(false)}
              title="Close Settings"
            >
              ✕
            </button>
          </div>

          <div className="settings-widget__body">
            {/* SECTION 1: DASHBOARD THEME */}
            <div className="settings-widget__section">
              <div className="settings-widget__section-header">
                <span className="settings-widget__section-icon">🎨</span>
                <div>
                  <div className="settings-widget__section-label">Dashboard Theme</div>
                  <div className="settings-widget__section-desc">Switch between high-contrast light & neon cyber dark mode</div>
                </div>
              </div>

              <div className="settings-widget__theme-grid">
                <button
                  type="button"
                  className={`settings-widget__theme-card ${
                    theme === "dark" ? "settings-widget__theme-card--active" : ""
                  }`}
                  onClick={() => onThemeChange("dark")}
                >
                  <div className="settings-widget__theme-preview settings-widget__theme-preview--dark">
                    <span className="preview-dot preview-dot--cyan" />
                    <span className="preview-bar" />
                  </div>
                  <div className="settings-widget__theme-info">
                    <span className="settings-widget__theme-name">🌙 Dark Mode</span>
                    <span className="settings-widget__theme-hint">Neon Cockpit (Night)</span>
                  </div>
                  {theme === "dark" && <span className="settings-widget__check">✓</span>}
                </button>

                <button
                  type="button"
                  className={`settings-widget__theme-card ${
                    theme === "light" ? "settings-widget__theme-card--active" : ""
                  }`}
                  onClick={() => onThemeChange("light")}
                >
                  <div className="settings-widget__theme-preview settings-widget__theme-preview--light">
                    <span className="preview-dot preview-dot--blue" />
                    <span className="preview-bar preview-bar--light" />
                  </div>
                  <div className="settings-widget__theme-info">
                    <span className="settings-widget__theme-name">☀️ Light Mode</span>
                    <span className="settings-widget__theme-hint">High Contrast (Daytime)</span>
                  </div>
                  {theme === "light" && <span className="settings-widget__check">✓</span>}
                </button>
              </div>
            </div>

            {/* SECTION 2: SIA VOICE ASSISTANT LANGUAGE */}
            <div className="settings-widget__section">
              <div className="settings-widget__section-header">
                <span className="settings-widget__section-icon">🗣️</span>
                <div>
                  <div className="settings-widget__section-label">SIA Copilot Language</div>
                  <div className="settings-widget__section-desc">
                    Input recognition & verbal speech output language
                  </div>
                </div>
              </div>

              <div className="settings-widget__lang-grid">
                {(["en", "hi", "mr"] as AssistantLanguage[]).map((l) => {
                  const meta = LANGUAGE_CONFIG[l];
                  const isActive = language === l;
                  return (
                    <button
                      key={l}
                      type="button"
                      className={`settings-widget__lang-card ${
                        isActive ? "settings-widget__lang-card--active" : ""
                      }`}
                      onClick={() => onLanguageChange(l)}
                    >
                      <div className="settings-widget__lang-top">
                        <span className="settings-widget__lang-flag">{meta.flag}</span>
                        <span className="settings-widget__lang-code">{l.toUpperCase()}</span>
                      </div>
                      <div className="settings-widget__lang-native">{meta.nativeName}</div>
                      <div className="settings-widget__lang-en">{meta.name}</div>
                      <div className="settings-widget__lang-desc">
                        {l === "en"
                          ? "Siri Voice • English / Hinglish"
                          : l === "hi"
                          ? "हिन्दी आवाज़ • बोलें और सुनें"
                          : "मराठी आवाज़ • बोला आणि ऐका"}
                      </div>
                      {isActive && <span className="settings-widget__check">✓ Active</span>}
                    </button>
                  );
                })}
              </div>

              {/* Live Preview Test Button */}
              <div className="settings-widget__preview-row">
                <button
                  type="button"
                  className={`settings-widget__preview-btn ${
                    previewPlaying ? "settings-widget__preview-btn--playing" : ""
                  }`}
                  onClick={handleTestVoice}
                  disabled={previewPlaying}
                >
                  {previewPlaying ? "🔊 Playing Voice Sample..." : `▶️ Test ${currentLangMeta.nativeName} Voice`}
                </button>
                <button
                  type="button"
                  className={`settings-widget__mute-toggle ${
                    voiceEnabled ? "settings-widget__mute-toggle--on" : ""
                  }`}
                  onClick={() => onVoiceToggle(!voiceEnabled)}
                  title={voiceEnabled ? "Mute Voice Output" : "Enable Voice Output"}
                >
                  {voiceEnabled ? "🔊 Voice On" : "🔇 Voice Muted"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
