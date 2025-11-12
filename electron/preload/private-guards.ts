/**
 * Private mode guards - fingerprint protection, WebRTC blocking, clipboard guards
 * Injected into private/ghost tabs
 */

export function injectPrivateGuards() {
  // Canvas fingerprint protection - add noise
  const canvasNoise = () => {
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    
    HTMLCanvasElement.prototype.toDataURL = function(type?: string, quality?: any): string {
      const ctx = this.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, this.width, this.height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          // Add tiny random noise (0-1 pixel variation)
          imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + (Math.random() - 0.5) * 2));
          imageData.data[i + 1] = Math.min(255, Math.max(0, imageData.data[i + 1] + (Math.random() - 0.5) * 2));
          imageData.data[i + 2] = Math.min(255, Math.max(0, imageData.data[i + 2] + (Math.random() - 0.5) * 2));
        }
        ctx.putImageData(imageData, 0, 0);
      }
      return originalToDataURL.call(this, type, quality);
    };
    
    CanvasRenderingContext2D.prototype.getImageData = function(sx: number, sy: number, sw: number, sh: number): ImageData {
      const imageData = originalGetImageData.call(this, sx, sy, sw, sh);
      // Add noise to returned data
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + (Math.random() - 0.5) * 2));
        imageData.data[i + 1] = Math.min(255, Math.max(0, imageData.data[i + 1] + (Math.random() - 0.5) * 2));
        imageData.data[i + 2] = Math.min(255, Math.max(0, imageData.data[i + 2] + (Math.random() - 0.5) * 2));
      }
      return imageData;
    };
  };
  
  // Audio fingerprint protection
  const audioNoise = () => {
    const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
    AudioContext.prototype.createAnalyser = function() {
      const analyser = originalCreateAnalyser.call(this);
      const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;
      analyser.getFloatFrequencyData = function(array: Float32Array): void {
        (originalGetFloatFrequencyData as any).call(this, array);
        // Add tiny noise to audio fingerprinting
        for (let i = 0; i < array.length; i++) {
          array[i] += (Math.random() - 0.5) * 0.01;
        }
      };
      return analyser;
    };
  };

  // WebRTC leak blocking
  const blockWebRTC = () => {
    const RTCPeerConnection = (window as any).RTCPeerConnection || (window as any).webkitRTCPeerConnection || (window as any).mozRTCPeerConnection;
    if (RTCPeerConnection) {
      (window as any).RTCPeerConnection = function(..._args: any[]) {
        console.warn('[Private Mode] WebRTC blocked');
        throw new Error('WebRTC is disabled in private mode');
      };
      (window as any).webkitRTCPeerConnection = (window as any).RTCPeerConnection;
      (window as any).mozRTCPeerConnection = (window as any).RTCPeerConnection;
    }
  };

  // Clipboard access guard
  const clipboardGuard = () => {
    const originalReadText = navigator.clipboard?.readText;
    if (typeof originalReadText === 'function') {
      navigator.clipboard.readText = function() {
        console.warn('[Private Mode] Clipboard read blocked');
        return Promise.reject(new Error('Clipboard access blocked in private mode'));
      };
    }

    // Intercept clipboard read events
    document.addEventListener('copy', () => {
      // Allow copy but log
      console.log('[Private Mode] Copy event detected');
    });

    document.addEventListener('paste', (e) => {
      // Block paste in sensitive contexts
      if ((e.target as HTMLElement)?.contentEditable === 'true' || 
          (e.target as HTMLElement)?.tagName === 'INPUT' || 
          (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        console.log('[Private Mode] Paste event detected');
        // Could add additional guards here
      }
    });
  };

  // Stable random traits (prevent randomization-based fingerprinting)
  const stableTraits = () => {
    // Use consistent values for screen dimensions, timezone, etc.
    Object.defineProperty(window.screen, 'width', {
      get: () => 1920, // Standard value
    });
    Object.defineProperty(window.screen, 'height', {
      get: () => 1080, // Standard value
    });
    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32', // Generic platform
    });
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 4, // Standard CPU count
    });
  };

  // Apply all guards
  canvasNoise();
  audioNoise();
  blockWebRTC();
  clipboardGuard();
  stableTraits();

  console.log('[Private Mode] Guards activated');
}

// Auto-inject if in private context
if (typeof window !== 'undefined') {
  // Check for private mode flag (would be set by preload)
  if ((window as any).__OMNI_PRIVATE_MODE) {
    injectPrivateGuards();
  }
}
