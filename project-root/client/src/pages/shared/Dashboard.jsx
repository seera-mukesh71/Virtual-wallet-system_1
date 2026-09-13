import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import SendMoneyModal from './SendMoneyModal';
import ScanQRModal from './ScanQRModal';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showSend, setShowSend] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [toast, setToast] = useState(null);

  const themeClass = user.role === 'VENDOR' ? 'theme-vendor' : 'theme-student';
  const roleLabel = user.role === 'VENDOR' ? 'Vendor wallet' : 'Student wallet';

  const loadWalletData = async () => {
    const [walletRes, txnRes] = await Promise.all([
      api.get('/wallet'),
      api.get('/wallet/transactions')
    ]);
    setWallet(walletRes.data.data);
    setTransactions(txnRes.data.data);
  };

  useEffect(() => { loadWalletData(); }, []);

  useEffect(() => {
    if (!socket) return;

    const handlePayment = (payload) => {
      setToast(payload);
      loadWalletData();
      setTimeout(() => setToast(null), 5000);
    };

    socket.on('payment_received', handlePayment);
    socket.on('connect', loadWalletData);
    socket.on('reconnect', loadWalletData);

    return () => {
      socket.off('payment_received', handlePayment);
      socket.off('connect', loadWalletData);
      socket.off('reconnect', loadWalletData);
    };
  }, [socket]);

  if (!wallet) {
    return (
      <div className={`${themeClass} app-shell`}>
        <div className="page-narrow empty-state">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`${themeClass} app-shell`}>
      <div className="page-narrow">
        <div className="topbar">
          <div>
            <h1>Welcome, {user.name}</h1>
            <div className="subtitle">{roleLabel}</div>
          </div>
          <button onClick={logout} className="btn btn-secondary">Log out</button>
        </div>

        {toast && (
          <div className="payment-toast">
            <div className="toast-label">PAYMENT RECEIVED</div>
            <div className="toast-amount money">₹{toast.amount}</div>
            <div className="toast-meta">From {toast.senderName}</div>
            <div className="toast-meta">Txn {toast.transactionId}</div>
          </div>
        )}

        <div className="balance-hero">
          <div className="label">Balance</div>
          <div className="amount money">₹{wallet.walletBalance}</div>
        </div>

        {user.role === 'STUDENT' && (
          <div className="btn-row" style={{ marginBottom: 24 }}>
            <button onClick={() => setShowSend(true)} className="btn btn-primary">Send money</button>
            <button onClick={() => setShowScan(true)} className="btn btn-secondary">Scan QR</button>
          </div>
        )}

        <div className="qr-block">
          <h3>Your QR code</h3>
          <div className="qr-frame">
            <QRCodeSVG value={wallet.walletId} size={160} />
          </div>
          <div className="wallet-id">{wallet.walletId}</div>
        </div>

        <div className="section">
          <h2>Transaction history</h2>
          <div className="card-plain">
            {transactions.length === 0 && <div className="empty-state">No transactions yet.</div>}
            {transactions.map((t) => (
              <div key={t._id} className="txn-row">
                <div className="txn-main">
                  <span className="txn-type">{t.type}</span>
                  {t.senderName} → {t.receiverName}
                  <div className="txn-time">{new Date(t.createdAt).toLocaleString()}</div>
                </div>
                <div className="txn-amount money">₹{t.amount}</div>
              </div>
            ))}
          </div>
        </div>

        {showSend && (
          <SendMoneyModal
            onClose={() => setShowSend(false)}
            onSuccess={() => { setShowSend(false); loadWalletData(); }}
          />
        )}
        {showScan && (
          <ScanQRModal
            onClose={() => setShowScan(false)}
            onScanned={() => { setShowScan(false); setShowSend(true); }}
          />
        )}
      </div>
    </div>
  );
}