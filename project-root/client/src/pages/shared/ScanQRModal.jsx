import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

// Scan box sized relative to the ACTUAL camera video dimensions, not a fixed
// pixel size. A fixed size (e.g. 220x220) can end up positioned outside the
// real decodable video frame on many phone cameras, so nothing ever scans
// even though the camera visibly opens. Sizing it as a fraction of whichever
// dimension is smaller keeps the box inside the real frame on any device.
function adaptiveQrbox(viewfinderWidth, viewfinderHeight) {
  const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
  const size = Math.floor(minEdge * 0.7);
  return { width: size, height: size };
}

export default function ScanQRModal({ onClose, onScanned }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: adaptiveQrbox,
          aspectRatio: 1.0
        },
        (decodedText) => {
          scanner.stop().then(() => onScanned(decodedText));
        },
        () => {} // per-frame "no QR found yet" callback — expected constantly, not an error
      )
      .then(() => setStarting(false))
      .catch((err) => {
        setStarting(false);
        setError('Could not access camera. Check permissions, or enter the wallet ID manually.');
      });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>Scan a wallet QR code</h3>

        {starting && <p style={{ fontSize: 13, color: '#888' }}>Starting camera...</p>}
        {error && <p className="error-text">{error}</p>}

        <div id="qr-reader" style={{ borderRadius: 10, overflow: 'hidden' }} />

        <p style={{ fontSize: 12, color: '#888', marginTop: 10 }}>
          Hold the QR code steady, well-lit, and fill most of the frame for best results.
        </p>

        <button onClick={onClose} className="btn btn-secondary btn-block" style={{ marginTop: 14 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}