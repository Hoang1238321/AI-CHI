// Device fingerprinting utility for login tracking
export interface DeviceInfo {
  fingerprint: string;
  deviceName: string;
  deviceInfo: string;
}

export function generateDeviceFingerprint(): DeviceInfo {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Generate canvas fingerprint
  let canvasFingerprint = '';
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Device fingerprint test 123!', 2, 2);
    canvasFingerprint = canvas.toDataURL();
  }

  // Collect device characteristics
  const deviceData = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: (navigator.languages && navigator.languages.join(',')) || '',
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    
    // Screen characteristics
    screenWidth: screen.width,
    screenHeight: screen.height,
    screenAvailWidth: screen.availWidth,
    screenAvailHeight: screen.availHeight,
    screenColorDepth: screen.colorDepth,
    screenPixelDepth: screen.pixelDepth,
    
    // Timezone and time
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    
    // Canvas fingerprint
    canvas: canvasFingerprint.slice(-50), // Last 50 chars
    
    // WebGL fingerprint
    webgl: getWebGLFingerprint(),
    
    // Audio context fingerprint  
    audio: getAudioFingerprint(),
  };

  // Create unique fingerprint hash
  const fingerprint = createHash(JSON.stringify(deviceData));
  
  // Generate human-readable device name
  const deviceName = generateDeviceName();
  
  // Create device info summary
  const deviceInfo = JSON.stringify({
    browser: getBrowserInfo(),
    os: getOSInfo(),
    screen: `${screen.width}x${screen.height}`,
    timezone: deviceData.timezone,
    language: deviceData.language,
  });

  return {
    fingerprint,
    deviceName,
    deviceInfo,
  };
}

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
    
    if (!gl) return 'no-webgl';
    
    const renderer = gl.getParameter(gl.RENDERER);
    const vendor = gl.getParameter(gl.VENDOR);
    
    return `${vendor}-${renderer}`.slice(0, 50);
  } catch {
    return 'webgl-error';
  }
}

function getAudioFingerprint(): string {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const analyser = audioContext.createAnalyser();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
    
    const fingerprint = `${audioContext.sampleRate}-${analyser.frequencyBinCount}`;
    audioContext.close();
    
    return fingerprint;
  } catch {
    return 'audio-error';
  }
}

function getBrowserInfo(): string {
  const ua = navigator.userAgent;
  
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('Opera')) return 'Opera';
  
  return 'Unknown';
}

function getOSInfo(): string {
  const platform = navigator.platform.toLowerCase();
  const ua = navigator.userAgent.toLowerCase();
  
  if (platform.includes('win')) return 'Windows';
  if (platform.includes('mac')) return 'macOS';
  if (platform.includes('linux')) return 'Linux';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
  
  return 'Unknown';
}

function generateDeviceName(): string {
  const browser = getBrowserInfo();
  const os = getOSInfo();
  const screen = `${window.screen.width}x${window.screen.height}`;
  
  return `${browser} on ${os} (${screen})`;
}

function createHash(input: string): string {
  let hash = 0;
  
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive hex string
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// Check if device characteristics have changed significantly
export function hasDeviceChanged(storedFingerprint: string): boolean {
  const currentDevice = generateDeviceFingerprint();
  return currentDevice.fingerprint !== storedFingerprint;
}

// Get IP address (requires server-side support)
export async function getClientIP(): Promise<string> {
  try {
    const response = await fetch('/api/auth/client-ip');
    const data = await response.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
}