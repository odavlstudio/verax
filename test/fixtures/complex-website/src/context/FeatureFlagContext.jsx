import React, { createContext } from 'react';

export const FeatureFlagContext = createContext();

export function FeatureFlagProvider({ children }) {
  // INTENTIONAL SILENT FAILURE: Feature flag is false by default
  // The UI will still show the button even though the feature is disabled
  const flags = {
    advancedSettings: false,
    betaFeatures: false,
    experimentalMode: false,
  };

  return (
    <FeatureFlagContext.Provider value={flags}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = React.useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagProvider');
  }
  return context;
}
