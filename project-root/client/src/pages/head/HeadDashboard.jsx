import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function HeadDashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [topupAmount, setTopupAmount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [sendAmount, setSendAmount] = useState({});
  const [notice, setNotice] = useState('');

  const loadDashboard = async () => {
    const res = await api.get('/head/dashboard');
    setStats(res.data.data);
  };

  useEffect(() => { loadDashboard(); }, []);

  const handleTopup = async (e) => {
    e.preventDefault();
    setNotice('');
    try {
      const res = await api.post('/head/topup', { amount: Number(topupAmount) });
      setNotice(res.data.message);
      setTopupAmount('');
      loadDashboard();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Top-up failed');
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const res = await api.get('/head/search', { params: { q: searchQuery } });
    setSearchResults(res.data.data);
  };

  const handleDistribute = async (walletId) => {
    const amount = Number(sendAmount[walletId]);
    if (!amount || amount <= 0) return;
    try {
      const res = await api.post('/head/distribute', { receiverWalletId: walletId, amount });
      setNotice(res.data.message);
      loadDashboard();
      handleSearch({ preventDefault: () => {} });
    } catch (err) {
      setNotice(err.response?.data?.message || 'Distribution failed');
    }
  };

  if (!stats) {
    return (
      <div className="theme-head app-shell">
        <div className="page-wide empty-state">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="theme-head app-shell">
      <div className="page-wide">
        <div className="topbar">
          <div>
            <h1>Head console</h1>
            <div className="subtitle">Signed in as {user.name}</div>
          </div>
          <button onClick={logout} className="btn btn-secondary">Log out</button>
        </div>

        {notice && <div className="notice">{notice}</div>}

        <div className="stat-grid">
          <StatCard label="Total introduced" value={`₹${stats.totalIntroduced}`} />
          <StatCard label="Held by students" value={`₹${stats.heldByStudents}`} />
          <StatCard label="Held by vendors" value={`₹${stats.heldByVendors}`} />
          <StatCard label="Held by head" value={`₹${stats.heldByHead}`} />
          <StatCard label="Students" value={stats.studentCount} />
          <StatCard label="Vendors" value={stats.vendorCount} />
          <StatCard label="Total transactions" value={stats.totalTransactions} />
        </div>

        <div className="section">
          <h2>Top up virtual money</h2>
          <div className="card-plain">
            <form onSubmit={handleTopup} className="field-row">
              <input
                type="number" placeholder="Amount" value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                className="field" required min="1"
              />
              <button type="submit" className="btn btn-primary">Confirm top up</button>
            </form>
          </div>
        </div>

        <div className="section">
          <h2>Search and send money</h2>
          <div className="card-plain">
            <form onSubmit={handleSearch} className="field-row" style={{ marginBottom: searchResults.length ? 12 : 0 }}>
              <input
                type="text" placeholder="Roll number, name, or email"
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="field"
              />
              <button type="submit" className="btn btn-secondary">Search</button>
            </form>

            {searchResults.map((r) => (
              <div key={r._id} className="result-row">
                <div className="result-info">
                  <span className="name">{r.name}</span> · {r.role} · {r.rollNumber || r.email}
                  <div className="meta money">Balance ₹{r.walletBalance}</div>
                </div>
                <input
                  type="number" placeholder="Amount" className="field result-amount-field"
                  value={sendAmount[r.walletId] || ''}
                  onChange={(e) => setSendAmount({ ...sendAmount, [r.walletId]: e.target.value })}
                />
                <button onClick={() => handleDistribute(r.walletId)} className="btn btn-primary">Send</button>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <h2>Vendor-wise received</h2>
          <div className="card-plain">
            {stats.vendorWiseReceived.length === 0 && <div className="empty-state">No vendor payments yet.</div>}
            {stats.vendorWiseReceived.map((v) => (
              <div key={v._id} className="txn-row">
                <span>{v.name}</span>
                <span className="txn-amount money">₹{v.total}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <h2>Recent transactions</h2>
          <div className="card-plain">
            {stats.recentTransactions.length === 0 && <div className="empty-state">No transactions yet.</div>}
            {stats.recentTransactions.map((t) => (
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
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value money">{value}</div>
    </div>
  );
}