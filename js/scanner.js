import { toast } from './toast.js';

let activeStream = null;

export async function startScan(targetInputId) {
  if (!('BarcodeDetector' in window)) {
    toast('Camera scanning not supported on this browser — type IMEI manually', 'error');
    return;
  }
  const modal = document.getElementById('scannerModal');
  const video = document.getElementById('scannerVideo');
  try {
    activeStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
    });
    video.srcObject = activeStream;
    modal.style.display = 'flex';
    await new Promise(r => { video.onloadedmetadata = r; });
    video.play();
    const detector = new BarcodeDetector({
      formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'],
    });
    const scan = async () => {
      if (!activeStream) return;
      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length) {
          const value = barcodes[0].rawValue;
          closeScanner();
          const input = document.getElementById(targetInputId);
          if (input) {
            input.value = value;
            input.dispatchEvent(new Event('input'));
            if (targetInputId === 'imeiInput' && window.selectIMEIFromInput) {
              window.selectIMEIFromInput();
            }
          }
          return;
        }
      } catch {}
      if (activeStream) requestAnimationFrame(scan);
    };
    requestAnimationFrame(scan);
  } catch {
    toast('Camera access denied — allow camera permission and try again', 'error');
  }
}

export function closeScanner() {
  if (activeStream) {
    activeStream.getTracks().forEach(t => t.stop());
    activeStream = null;
  }
  const modal = document.getElementById('scannerModal');
  if (modal) modal.style.display = 'none';
}

window.startScan = startScan;
window.closeScanner = closeScanner;
