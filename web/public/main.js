const errorInput = document.getElementById('errorInput');
const diagnoseButton = document.getElementById('diagnoseButton');
const statusMessage = document.getElementById('statusMessage');
const resultsBody = document.getElementById('resultsBody');
const resultTitle = document.getElementById('resultTitle');
const resultSubtitle = document.getElementById('resultSubtitle');
const copyJsonButton = document.getElementById('copyJsonButton');
const copyQuickFixButton = document.getElementById('copyQuickFixButton');
const copyBestFixButton = document.getElementById('copyBestFixButton');
const proStatus = document.getElementById('proStatus');
const feedbackSection = document.getElementById('feedbackSection');
const feedbackWorkedBtn = document.getElementById('feedbackWorked');
const feedbackDidntWorkBtn = document.getElementById('feedbackDidntWork');
const feedbackMessage = document.getElementById('feedbackMessage');
const onboardingHint = document.getElementById('onboardingHint');
const quickFeedback = document.getElementById('quickFeedback');
const quickFeedbackYes = document.getElementById('quickFeedbackYes');
const quickFeedbackNo = document.getElementById('quickFeedbackNo');
const quickFeedbackMessage = document.getElementById('quickFeedbackMessage');

const MAX_INPUT_CHARS = 20000;
const PRO_TOKEN_KEY = 'doctorErrorProToken';
let currentDiagnosis = null;

function getProToken() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('pro');
  if (urlToken) {
    localStorage.setItem(PRO_TOKEN_KEY, urlToken);
    window.history.replaceState({}, '', window.location.pathname);
    return urlToken;
  }
  return localStorage.getItem(PRO_TOKEN_KEY) || '';
}

function isPro() {
  return !!getProToken();
}

function updateProStatus() {
  if (isPro()) {
    proStatus.innerHTML = '<span class="pro-badge">✓ Pro Active</span>';
  } else {
    proStatus.innerHTML = `
      <div class="pro-upgrade-block">
        <button id="unlockProButton" class="unlock-btn">Unlock Pro</button>
        <p class="pro-value-summary">See all ranked causes. Get the best fix. Verify with confidence.</p>
        <ul class="pro-benefits">
          <li>All ranked causes (not just the most likely)</li>
          <li>Best Fix + Verify steps for complete resolution</li>
          <li>Diagnostic questions when available</li>
        </ul>
        <p class="pro-pricing">One-time unlock. No subscription. Instant access.</p>
        <p class="free-vs-pro-hint">Free shows the most likely cause. Pro shows the full diagnosis.</p>
      </div>
    `;
    const unlockBtn = document.getElementById('unlockProButton');
    if (unlockBtn) {
      unlockBtn.addEventListener('click', handleUnlockPro);
    }
  }
}

function setStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type === 'error' ? 'error' : type === 'success' ? 'success' : ''}`;
}

function clearResults() {
  resultsBody.innerHTML = '<p class="muted">No diagnosis yet. Paste an error and press Diagnose.</p>';
  resultTitle.textContent = 'Diagnosis';
  resultSubtitle.textContent = '';
  currentDiagnosis = null;
  hideFeedback();
  hideQuickFeedback();
  hideTrustSection();
}

function showTrustSection() {
  const trustSection = document.getElementById('trustSection');
  if (trustSection) {
    trustSection.style.display = 'block';
  }
}

function hideTrustSection() {
  const trustSection = document.getElementById('trustSection');
  if (trustSection) {
    trustSection.style.display = 'none';
  }
}

function showQuickFeedback() {
  quickFeedback.style.display = 'block';
  quickFeedbackYes.disabled = false;
  quickFeedbackNo.disabled = false;
  quickFeedbackMessage.innerHTML = '';
}

function hideQuickFeedback() {
  quickFeedback.style.display = 'none';
  quickFeedbackMessage.innerHTML = '';
}

function showFeedback() {
  feedbackSection.style.display = 'block';
  feedbackWorkedBtn.disabled = false;
  feedbackDidntWorkBtn.disabled = false;
  feedbackMessage.innerHTML = '';
}

function hideFeedback() {
  feedbackSection.style.display = 'none';
  feedbackMessage.innerHTML = '';
}

function createListItem(title, bodyText, metaText) {
  const li = document.createElement('li');
  li.className = 'list-item';

  const strong = document.createElement('strong');
  strong.textContent = title;
  li.appendChild(strong);

  if (bodyText) {
    const body = document.createElement('div');
    body.textContent = bodyText;
    li.appendChild(body);
  }

  if (metaText) {
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = metaText;
    li.appendChild(meta);
  }

  return li;
}

function createProGate(feature) {
  const gate = document.createElement('div');
  gate.className = 'pro-gate';
  gate.innerHTML = `
    <p class="pro-gate__text">🔒 ${feature} available in Pro</p>
    <button class="pro-gate__btn" onclick="document.getElementById('unlockProButton')?.click()">Unlock Pro</button>
  `;
  return gate;
}

function renderDiagnosis(diagnosis) {
  currentDiagnosis = diagnosis;
  resultTitle.textContent = diagnosis.errorTitle;
  const confidencePct = Math.round((diagnosis.confidence || 0) * 100);
  resultSubtitle.textContent = `Confidence: ${confidencePct}%`;

  const fragments = [];
  const isProUser = diagnosis.isPro === true;

  // Causes
  if (diagnosis.rankedCauses?.length) {
    const section = document.createElement('div');
    section.className = 'section';
    const heading = document.createElement('h3');
    heading.textContent = 'Likely causes';
    
    if (!isProUser && diagnosis.rankedCauses.length === 1) {
      const note = document.createElement('span');
      note.className = 'pro-label';
      note.textContent = ' (showing top 1 — unlock Pro for all)';
      heading.appendChild(note);
    }
    
    section.appendChild(heading);

    const list = document.createElement('ul');
    list.className = 'list';
    diagnosis.rankedCauses.forEach((cause) => {
      const meta = `Why: ${cause.whyLikely} | Quick check: ${cause.quickCheck}`;
      list.appendChild(createListItem(cause.title, null, meta));
    });
    section.appendChild(list);
    fragments.push(section);
  }

  // Diagnostic questions (Pro only)
  if (isProUser && diagnosis.diagnosticQuestions?.length) {
    const section = document.createElement('div');
    section.className = 'section';
    const heading = document.createElement('h3');
    heading.textContent = 'Diagnostic questions (to confirm)';
    section.appendChild(heading);

    const list = document.createElement('ul');
    list.className = 'list';
    diagnosis.diagnosticQuestions.forEach((q) => {
      const choicesText = q.choices.map((c) => `${c.title}: ${c.meaning}`).join(' \u2022 ');
      list.appendChild(createListItem(q.question, null, choicesText));
    });
    section.appendChild(list);
    fragments.push(section);
  }

  // Fix paths
  const fixSection = document.createElement('div');
  fixSection.className = 'section';
  const fixHeading = document.createElement('h3');
  fixHeading.textContent = 'Fix paths';
  fixSection.appendChild(fixHeading);

  const fixPaths = [
    { key: 'quickFix', label: 'Quick Fix', isPro: false },
    { key: 'bestFix', label: 'Best Fix', isPro: true },
    { key: 'verify', label: 'Verify', isPro: true }
  ];

  fixPaths.forEach((path) => {
    const steps = diagnosis.fixPaths?.[path.key]?.steps || [];
    const wrapper = document.createElement('div');
    wrapper.className = 'section';

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = path.label;
    if (path.isPro) {
      badge.classList.add('pro-badge-inline');
    }
    wrapper.appendChild(badge);

    if (path.isPro && !isProUser) {
      wrapper.appendChild(createProGate(path.label));
    } else {
      const list = document.createElement('ul');
      list.className = 'list';

      if (steps.length === 0) {
        list.appendChild(createListItem('No steps provided', null, null));
      } else {
        steps.forEach((step) => list.appendChild(createListItem(step, null, null)));
      }

      wrapper.appendChild(list);
    }

    fixSection.appendChild(wrapper);
  });

  fragments.push(fixSection);

  // Add contextual upgrade prompt for Free users
  if (!isProUser) {
    const upgradePrompt = document.createElement('div');
    upgradePrompt.className = 'contextual-upgrade';
    upgradePrompt.innerHTML = `
      <p class="contextual-upgrade__text">Want to see the remaining causes and the best fix?</p>
      <button class="contextual-upgrade__btn" onclick="document.getElementById('unlockProButton')?.click()">Unlock Pro</button>
    `;
    fragments.push(upgradePrompt);
  }

  resultsBody.replaceChildren(...fragments);
  showQuickFeedback();
  showFeedback();
  showTrustSection();
}

async function handleDiagnose() {
  const text = errorInput.value.trim();

  if (!text) {
    setStatus('Paste an error first.', 'error');
    return;
  }
  if (text.length > MAX_INPUT_CHARS) {
    setStatus('Error text is too long (max 20000 chars).', 'error');
    return;
  }

  setStatus('Diagnosing…');
  diagnoseButton.disabled = true;

  try {
    const headers = { 'Content-Type': 'application/json' };
    const proToken = getProToken();
    if (proToken) {
      headers['X-Doctor-Pro'] = proToken;
    }

    const response = await fetch('/api/diagnose', {
      method: 'POST',
      headers,
      body: JSON.stringify({ rawErrorText: text })
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody.error || 'Unable to diagnose this error.';
      throw new Error(message);
    }

    const payload = await response.json();
    const diagnosis = payload.diagnosis || null;

    if (!diagnosis) {
      setStatus('No matching signature. Try pasting the full stack trace.', 'info');
      clearResults();
      return;
    }

    setStatus('Diagnosis ready.', 'success');
    renderDiagnosis(diagnosis);
  } catch (err) {
    setStatus(err.message || 'Something went wrong.', 'error');
  } finally {
    diagnoseButton.disabled = false;
  }
}

async function handleUnlockPro() {
  setStatus('Redirecting to checkout…');
  try {
    const response = await fetch('/api/checkout', { method: 'POST' });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Checkout failed');
    }
    const data = await response.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error('No checkout URL returned');
    }
  } catch (err) {
    setStatus(err.message || 'Failed to start checkout.', 'error');
  }
}

async function submitFeedback(outcome) {
  if (!currentDiagnosis) return;

  feedbackWorkedBtn.disabled = true;
  feedbackDidntWorkBtn.disabled = true;

  try {
    const payload = {
      errorSignature: currentDiagnosis.errorSignature,
      errorTitle: currentDiagnosis.errorTitle,
      isPro: currentDiagnosis.isPro === true,
      outcome,
      timestamp: Date.now()
    };

    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (outcome === 'worked') {
      feedbackMessage.innerHTML = '<p class="feedback-thanks">✓ Thank you! Glad it helped.</p>';
    } else {
      const isProUser = currentDiagnosis.isPro === true;
      let nextSteps = '<p class="feedback-next"><strong>Next steps to try:</strong></p><ul class="feedback-list">';
      nextSteps += '<li>Paste the full stack trace with file paths and line numbers</li>';
      
      if (currentDiagnosis.rankedCauses?.length > 1) {
        nextSteps += '<li>Check the secondary causes listed above</li>';
      }
      
      if (!isProUser) {
        nextSteps += '<li>Unlock Pro for full diagnostic questions and best fix guidance</li>';
      }
      
      nextSteps += '</ul>';
      feedbackMessage.innerHTML = nextSteps;
    }
  } catch (err) {
    console.error('Feedback submission failed:', err);
  }
}

async function copyToClipboard(text, label) {
  if (!text) {
    setStatus(`Nothing to copy for ${label}.`, 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus(`${label} copied.`, 'success');
  } catch (err) {
    setStatus(`Failed to copy ${label}.`, 'error');
  }
}

async function submitQuickFeedback(outcome) {
  if (!currentDiagnosis) return;

  try {
    const payload = {
      errorSignature: currentDiagnosis.errorSignature,
      errorTitle: currentDiagnosis.errorTitle,
      isPro: currentDiagnosis.isPro === true,
      outcome,
      timestamp: Date.now()
    };

    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Quick feedback submission failed:', err);
  }
}

copyJsonButton.addEventListener('click', () => {
  if (!currentDiagnosis) {
    setStatus('Run a diagnosis before copying.', 'error');
    return;
  }
  copyToClipboard(JSON.stringify(currentDiagnosis, null, 2), 'JSON');
});

copyQuickFixButton.addEventListener('click', () => {
  if (!currentDiagnosis) {
    setStatus('Run a diagnosis before copying.', 'error');
    return;
  }
  const steps = currentDiagnosis.fixPaths?.quickFix?.steps || [];
  copyToClipboard(steps.join('\n'), 'Quick Fix');
});

copyBestFixButton.addEventListener('click', () => {
  if (!currentDiagnosis) {
    setStatus('Run a diagnosis before copying.', 'error');
    return;
  }
  const steps = currentDiagnosis.fixPaths?.bestFix?.steps || [];
  copyToClipboard(steps.join('\n'), 'Best Fix');
});

feedbackWorkedBtn.addEventListener('click', () => submitFeedback('worked'));
feedbackDidntWorkBtn.addEventListener('click', () => submitFeedback('didnt_work'));

// Quick feedback buttons
quickFeedbackYes.addEventListener('click', () => {
  quickFeedbackYes.disabled = true;
  quickFeedbackNo.disabled = true;
  submitQuickFeedback('worked');
});

quickFeedbackNo.addEventListener('click', () => {
  quickFeedbackYes.disabled = true;
  quickFeedbackNo.disabled = true;
  quickFeedbackMessage.innerHTML = '<span style="color: var(--muted);">Thanks — paste the full stack trace or try another cause.</span>';
  submitQuickFeedback('didnt_work');
});

diagnoseButton.addEventListener('click', handleDiagnose);
errorInput.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'enter') {
    handleDiagnose();
  }
});

// Onboarding hint: hide when user starts typing
errorInput.addEventListener('input', () => {
  if (errorInput.value.trim().length > 0) {
    onboardingHint.classList.add('hidden');
  } else {
    onboardingHint.classList.remove('hidden');
  }
});

updateProStatus();
hideFeedback();
clearResults();
setStatus('Paste an error to start.');
