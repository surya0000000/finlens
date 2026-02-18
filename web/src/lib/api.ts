import axios from "axios";

import { authStorage } from "./auth";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

export const api = axios.create({
  baseURL,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = authStorage.getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const extractApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const errorMessage = error.response?.data?.error;
    if (typeof errorMessage === "string" && errorMessage.length > 0) {
      return errorMessage;
    }

    if (typeof error.message === "string") {
      return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error occurred.";
};

