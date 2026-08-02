import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

export type ServiceType = 'IAM' | 'TUTOR' | 'TESTS' | 'NOTIFICATIONS';

const getBaseUrl = (service: ServiceType): string => {
  switch (service) {
    case 'IAM':
      return import.meta.env.VITE_IAM_API_URL || 'http://localhost:3000/iam';
    case 'TUTOR':
      return import.meta.env.VITE_TUTOR_API_URL || 'http://localhost:3000/tutor';
    case 'TESTS':
      return import.meta.env.VITE_TEST_API_URL || 'http://localhost:3000/tests';
    case 'NOTIFICATIONS':
      return import.meta.env.VITE_NOTIFICATIONS_API_URL || 'http://localhost:8691';
    default:
      return '';
  }
};

interface RequestOptions extends AxiosRequestConfig {
  authenticated?: boolean;
}

type ApiRequestError = Error & {
  status?: number;
};

/**
 * A 401 from these services means the dashboard session itself is gone, so we
 * clear it and bounce to /login. The notification service is excluded: it
 * rejects tokens for its own reasons (bearer auth not enabled there, caller
 * lacks the superadmin role), and signing the operator out of the whole
 * dashboard over that would be wrong.
 */
const SESSION_OWNING_SERVICES: ServiceType[] = ['IAM', 'TUTOR', 'TESTS'];

class ApiClient {
  private async requestRaw<T>(
    service: ServiceType,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<AxiosResponse<T>> {
    const baseUrl = getBaseUrl(service);
    const url = `${baseUrl}${endpoint}`;
    const isFormData =
      typeof FormData !== 'undefined' && options.data instanceof FormData;

    // `headers` must come after `...options`, or spreading options overwrites
    // the merged headers with the caller's raw ones and drops Content-Type.
    const config: AxiosRequestConfig = {
      url,
      method: options.method || 'GET',
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
    };

    // Handle authentication manually for each request to support dynamic exclusion
    if (options.authenticated !== false) {
      const token = localStorage.getItem('msai_educator_token');
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
      }
    }

    try {
      return await axios<T>(config);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Handle 401 Unauthorized globally if needed
          if (error.response.status === 401 && SESSION_OWNING_SERVICES.includes(service)) {
            console.warn('Unauthorized access. Token might be invalid or expired.');
            localStorage.removeItem('msai_educator_token');
            window.location.href = '/login';
          }
          const responseData = error.response.data as
            | { error?: string; message?: string }
            | undefined;
          const backendMessage =
            responseData?.message?.trim() || responseData?.error?.trim();
          const requestError: ApiRequestError = new Error(
            backendMessage || `API Error: ${error.response.status} ${error.response.statusText}`,
          );
          requestError.status = error.response.status;
          throw requestError;
        } else if (error.request) {
           // The request was made but no response was received
           throw new Error('API Error: No response received');
        }
      }
      throw error;
    }
  }

  private async request<T>(
    service: ServiceType,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const response = await this.requestRaw<T>(service, endpoint, options);
    return response.data;
  }

  // HTTP Wrapper Methods
  async get<T>(service: ServiceType, endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(service, endpoint, { ...options, method: 'GET' });
  }

  /**
   * GET that also exposes response headers, for endpoints that return a bare
   * array and carry the total match count in `X-Total-Count`.
   */
  async getWithHeaders<T>(
    service: ServiceType,
    endpoint: string,
    options?: RequestOptions
  ): Promise<{ data: T; headers: AxiosResponse<T>['headers'] }> {
    const response = await this.requestRaw<T>(service, endpoint, { ...options, method: 'GET' });
    return { data: response.data, headers: response.headers };
  }

  async post<T>(service: ServiceType, endpoint: string, body: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(service, endpoint, {
      ...options,
      method: 'POST',
      data: body,
    });
  }

  async put<T>(service: ServiceType, endpoint: string, body: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(service, endpoint, {
      ...options,
      method: 'PUT',
      data: body,
    });
  }

  async patch<T>(service: ServiceType, endpoint: string, body: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(service, endpoint, {
      ...options,
      method: 'PATCH',
      data: body,
    });
  }

  async delete<T>(service: ServiceType, endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(service, endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
