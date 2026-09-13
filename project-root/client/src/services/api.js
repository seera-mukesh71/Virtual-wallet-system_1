import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true // sends/receives the httpOnly JWT cookie automatically
});

export default api;
