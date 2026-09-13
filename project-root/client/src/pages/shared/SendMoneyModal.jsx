import { useState } from 'react';
import api from '../../services/api';

export default function SendMoneyModal({ onClose, onSuccess, prefillWalletId }) {
  const [walletId, setWalletId] = useState(prefillWalletId || '');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const lookupRecipient = async () => {
    setError('');
    try {
      const res = await api.get(`/wallet/lookup/${walletId}`);
      setRecipient(res.data.data);
      setConfirming(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Recipient not found');
    }
  };

  const confirmTransfer = async () => {
    setError('');
    try {
      await api.post('/wallet/transfer', { receiverWalletId: walletId, amount: Number(amount) });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Transaction failed. Your balance has not been changed.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>Send money</h3>

        {!confirming && (
          <>
            <input
              type="text" placeholder="Recipient wallet ID"
              value={walletId} onChange={(e) => setWalletId(e.target.value)}
              className="field"
            />
            <input
              type="number" placeholder="Amount" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="field" min="1"
            />
            {error && <p className="error-text">{error}</p>}
            <button
              onClick={lookupRecipient}
              disabled={!walletId || !amount}
              className="btn btn-primary btn-block"
            >
              Review transfer
            </button>
          </>
        )}

        {confirming && recipient && (
          <>
            <div className="card-plain" style={{ marginBottom: 16 }}>
              <p style={{ margin: '4px 0' }}><strong>Recipient:</strong> {recipient.name}</p>
              {recipient.rollNumber && <p style={{ margin: '4px 0' }}><strong>Roll no:</strong> {recipient.rollNumber}</p>}
              <p style={{ margin: '4px 0' }} className="money"><strong>Amount:</strong> ₹{amount}</p>
            </div>
            {error && <p className="error-text">{error}</p>}
            <button onClick={confirmTransfer} className="btn btn-primary btn-block" style={{ marginBottom: 8 }}>
              Confirm transfer
            </button>
            <button onClick={() => setConfirming(false)} className="btn btn-secondary btn-block">
              Back
            </button>
          </>
        )}

        <button onClick={onClose} className="btn btn-ghost btn-block" style={{ marginTop: 12 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}