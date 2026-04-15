const PASSPORT_TOKEN_KEY = 'zayvora_passport_session_token';
const WORKSPACE_PATH = '/workspace/';

const statusEl = document.getElementById('status');
const manualSection = document.getElementById('manualSection');
const uidInput = document.getElementById('uidInput');
const startNfcBtn = document.getElementById('startNfc');
const manualVerifyBtn = document.getElementById('manualVerify');
const logoutBtn = document.getElementById('logoutBtn');

function setStatus(message, type = 'info') {
  statusEl.textContent = message;
  if (type === 'error') {
    statusEl.style.color = '#b00020';
    return;
  }
  if (type === 'success') {
    statusEl.style.color = '#127c32';
    return;
  }
  statusEl.style.color = '#22313f';
}

function showManualFallback(reasonMessage) {
  setStatus(reasonMessage, 'error');
  manualSection.classList.remove('hidden');
  uidInput.focus();
}

function storeSessionToken(token) {
  localStorage.setItem(PASSPORT_TOKEN_KEY, token);
}

async function verifyUid(uid) {
  setStatus('Verifying passport UID...');
  const response = await fetch('/passport/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Verification failed.');
  }

  if (!data.token) {
    throw new Error('Passport verification returned no session token.');
  }

  storeSessionToken(data.token);
  setStatus('Passport verified. Redirecting to workspace...', 'success');
  window.location.href = WORKSPACE_PATH;
}

async function startNfcFlow() {
  if (!('NDEFReader' in window)) {
    showManualFallback('Web NFC is not available on this browser/device. Use manual UID entry.');
    return;
  }

  try {
    const ndef = new NDEFReader();
    setStatus('Hold your passport card near your device...');
    await ndef.scan();

    ndef.onreadingerror = () => {
      showManualFallback('Unable to read this NFC tag. Enter UID manually.');
    };

    ndef.onreading = async (event) => {
      const uid = event.serialNumber;
      if (!uid) {
        showManualFallback('NFC tag read without UID. Enter UID manually.');
        return;
      }

      setStatus(`UID read: ${uid}. Creating session...`);
      try {
        await verifyUid(uid);
      } catch (error) {
        showManualFallback(error.message || 'NFC verification failed. Enter UID manually.');
      }
    };
  } catch (error) {
    showManualFallback(`NFC scan unavailable: ${error.message || 'permission denied'}. Enter UID manually.`);
  }
}

async function handleManualVerify() {
  const uid = uidInput.value.trim();
  if (!uid) {
    setStatus('Please enter a UID before verifying.', 'error');
    return;
  }

  try {
    await verifyUid(uid);
  } catch (error) {
    setStatus(error.message || 'Manual UID verification failed.', 'error');
  }
}

async function handleLogout() {
  const token = localStorage.getItem(PASSPORT_TOKEN_KEY);
  try {
    await fetch('/passport/logout', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (_) {
    // ignore network errors; we still clear local session
  }

  localStorage.removeItem(PASSPORT_TOKEN_KEY);
  setStatus('Session cleared. You are logged out.', 'success');
}

startNfcBtn.addEventListener('click', startNfcFlow);
manualVerifyBtn.addEventListener('click', handleManualVerify);
logoutBtn.addEventListener('click', handleLogout);

if (localStorage.getItem(PASSPORT_TOKEN_KEY)) {
  setStatus('Existing passport session found in localStorage.', 'success');
}
