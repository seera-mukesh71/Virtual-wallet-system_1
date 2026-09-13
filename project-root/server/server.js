import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDB } from './src/config/db.js';
import authRoutes from './src/routes/auth.js';
import walletRoutes from './src/routes/wallet.js';
import headRoutes from './src/routes/head.js';
import { initSockets } from './src/sockets/index.js';

const app = express();
const httpServer = createServer(app);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/head', headRoutes);

const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL, credentials: true }
});
app.set('io', io);
initSockets(io);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    code: err.code || 'SERVER_ERROR'
  });
});

const PORT = process.env.SERVER_PORT || 5000;

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
