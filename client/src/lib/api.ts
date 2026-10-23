export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: ApiErrorDetail[];

  constructor(statusCode: number, code: string, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

export const api = {
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers = {}, ...customConfig } = options;

    let url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
          searchParams.append(key, String(val));
        }
      });
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes("?") ? "&" : "?") + qs;
      }
    }

    const defaultHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    };

    const customHeaders = (headers as Record<string, string>) || {};

    // Tab-isolated session token support with persistent Remember Me fallback
    if (typeof window !== "undefined") {
      const tabToken =
        window.sessionStorage.getItem("teamflow_token") ||
        window.localStorage.getItem("teamflow_token");
      if (tabToken && !customHeaders["Authorization"] && !customHeaders["authorization"]) {
        defaultHeaders["Authorization"] = `Bearer ${tabToken}`;
      }
    }

    const config: RequestInit = {
      ...customConfig,
      headers: {
        ...defaultHeaders,
        ...customHeaders,
      },
      credentials: "include",
    };

    let response: Response;
    try {
      response = await fetch(url, config);
    } catch {
      throw new ApiClientError(0, "NETWORK_ERROR", "Failed to connect to TeamFlow API server");
    }

    if (response.status === 204) {
      return {} as T;
    }

    let json: { data?: T; error?: { code?: string; message?: string; details?: ApiErrorDetail[] } };
    try {
      json = await response.json();
    } catch {
      throw new ApiClientError(
        response.status,
        "PARSE_ERROR",
        `Server returned status ${response.status} with non-JSON body`
      );
    }

    if (!response.ok || json.error) {
      const error = json.error || {
        code: "HTTP_ERROR",
        message: response.statusText || "Request failed",
      };
      throw new ApiClientError(
        response.status,
        error.code || "UNKNOWN_ERROR",
        error.message || "An unexpected error occurred",
        error.details
      );
    }

    // If response is a paginated list with both data and pagination, preserve the envelope
    if (json.data !== undefined && (json as Record<string, unknown>).pagination !== undefined) {
      return json as T;
    }

    return (json.data !== undefined ? json.data : json) as T;
  },

  get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined | null>) {
    return this.request<T>(endpoint, { method: "GET", params });
  },

  post<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "DELETE" });
  },

  /**
   * Upload file with true XMLHttpRequest progress tracking
   */
  uploadWithProgress<T>(
    endpoint: string,
    formData: FormData,
    onProgress?: (percent: number) => void
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

      xhr.open("POST", url, true);
      xhr.withCredentials = true;
      xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");

      if (typeof window !== "undefined") {
        const tabToken =
          window.sessionStorage.getItem("teamflow_token") ||
          window.localStorage.getItem("teamflow_token");
        if (tabToken) {
          xhr.setRequestHeader("Authorization", `Bearer ${tabToken}`);
        }
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve((json.data !== undefined ? json.data : json) as T);
          } else {
            const err = json.error || {
              code: "UPLOAD_ERROR",
              message: `Upload failed with status ${xhr.status}`,
            };
            reject(
              new ApiClientError(
                xhr.status,
                err.code || "UPLOAD_FAILED",
                err.message || "Upload failed",
                err.details
              )
            );
          }
        } catch {
          reject(
            new ApiClientError(
              xhr.status,
              "RESPONSE_PARSE_ERROR",
              "Server did not return a valid JSON response"
            )
          );
        }
      };

      xhr.onerror = () => {
        reject(
          new ApiClientError(
            0,
            "NETWORK_ERROR",
            "Network connection lost during media upload"
          )
        );
      };

      xhr.send(formData);
    });
  },

  setToken(token: string, rememberMe = false) {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("teamflow_token", token);
      if (rememberMe) {
        window.localStorage.setItem("teamflow_token", token);
      } else {
        window.localStorage.removeItem("teamflow_token");
      }
    }
  },

  getToken(): string | null {
    if (typeof window !== "undefined") {
      return (
        window.sessionStorage.getItem("teamflow_token") ||
        window.localStorage.getItem("teamflow_token")
      );
    }
    return null;
  },

  clearToken() {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("teamflow_token");
      window.localStorage.removeItem("teamflow_token");
    }
  },
};
