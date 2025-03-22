import axios, { AxiosRequestConfig } from "axios";
import { auth } from "../firebaseConfig";

const axiosInstance = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true,
});

// Request interceptor: attach Firebase token to every request (if available).
axiosInstance.interceptors.request.use(
  async (config: any) => {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      // Cast headers as any to avoid type errors.
      config.headers = {
        ...(config.headers as any),
        Authorization: `Bearer ${token}`,
      };
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: if a 401 error is received with a session error, force logout.
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response &&
      error.response.status === 401 &&
      (error.response.data.error === "Session terminated" ||
        error.response.data.error === "Session expired")
    ) {
      alert("Your session has expired. Please log in again.");
      // Force logout; you could also call a logout function here.
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
