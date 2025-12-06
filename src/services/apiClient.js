import axios from "axios";

const base = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const apiClient = axios.create({
  baseURL: base,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach token from localStorage
apiClient.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem("authToken");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // ignore
    }
    return config;
  },
  (err) => Promise.reject(err)
);

// Handle 401 globally (clear storage so UI can react)
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      try {
        localStorage.removeItem("authToken");
        localStorage.removeItem("authUser");
      } catch (e) {}
      // Note: don't redirect here; let UI handle navigation
    }
    return Promise.reject(err);
  }
);

export default apiClient;
