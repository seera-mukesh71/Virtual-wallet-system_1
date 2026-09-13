import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function ScanQRModal({ onClose, onScanned }) {
  const readerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader');
    readerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          scanner.stop().then(() => onScanned(decodedText));
        },
        () => {} // ignore per-frame scan failures
      )
      .catch(() => {
        // Camera unavailable/denied — user can still cancel and enter wallet ID manually
      });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>Scan a wallet QR code</h3>
        <div id="qr-reader" style={{ borderRadius: 10, overflow: 'hidden' }} />
        <button onClick={onClose} className="btn btn-secondary btn-block" style={{ marginTop: 14 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}