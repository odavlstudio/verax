import React, { useState } from 'react';
import { submitSettings, checkFeatureFlag } from '../api/mockApi';
import { useFeatureFlags } from '../context/FeatureFlagContext';

function Settings() {
  const [settings, setSettings] = useState({
    theme: 'light',
    notifications: true,
    language: 'en',
  });
  const [saving, setSaving] = useState(false);
  const flags = useFeatureFlags();

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSaveSettings = async () => {
    setSaving(true);

    // INTENTIONAL SILENT FAILURE: Form submission success
    // The API call resolves successfully, but we never provide visual feedback
    // No success message, no redirect, no state update to indicate completion
    const result = await submitSettings(settings);

    // BUG: result is received but ignored, setSaving(false) never called
    // User clicks "Save", sees button disabled briefly, then... nothing happens
    // But the request DID complete successfully in the background
    // (Uncomment to fix: setSaving(false);)
  };

  const handleAdvancedSettingClick = () => {
    // INTENTIONAL SILENT FAILURE: Feature flag is false, but button still shows and is clickable
    // Clicking does nothing because the feature is disabled, but there's no visual indication
    // The button appears functional but performs no action
    if (flags.advancedSettings) {
      console.log('Advanced settings enabled');
    }
  };

  return (
    <div className="page">
      <h1>Settings</h1>

      <form onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="theme">Theme:</label>
        <select
          id="theme"
          name="theme"
          value={settings.theme}
          onChange={handleInputChange}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="auto">Auto</option>
        </select>

        <label htmlFor="language">Language:</label>
        <select
          id="language"
          name="language"
          value={settings.language}
          onChange={handleInputChange}
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
        </select>

        <label htmlFor="notifications">
          <input
            id="notifications"
            type="checkbox"
            name="notifications"
            checked={settings.notifications}
            onChange={handleInputChange}
          />
          Enable Notifications
        </label>

        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={saving}
          className={saving ? 'disabled' : ''}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      <div className="comment">
        INTENTIONAL SILENT FAILURE: Form submission completes successfully in the background, but
        no visual feedback is provided. Click "Save Settings" and observe the button become
        disabled briefly, but the saving state never completes. The API succeeds, but the UI
        never tells you.
      </div>

      <h2>Feature Flags</h2>

      <button type="button" onClick={handleAdvancedSettingClick}>
        Advanced Settings
      </button>

      <div className="comment">
        INTENTIONAL SILENT FAILURE: Feature flag "advancedSettings" is false, but the button
        still appears and is clickable. Clicking the button does nothing - no error, no message,
        no visual change. The feature is silently disabled.
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <h3>Current Settings:</h3>
        <div className="user-data">
          <pre>{JSON.stringify(settings, null, 2)}</pre>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <h3>Feature Flags Status:</h3>
        <div className="user-data">
          <pre>{JSON.stringify(flags, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}

export default Settings;
