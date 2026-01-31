import axios, { AxiosRequestConfig, Method } from 'axios';

export type ServiceType = 'IAM' | 'TUTOR' | 'TESTS';

const getBaseUrl = (service: ServiceType): string => {
  switch (service) {
    case 'IAM':
      return import.meta.env.VITE_IAM_API_URL || 'http://localhost:3000/iam';
    case 'TUTOR':
      return import.meta.env.VITE_TUTOR_API_URL || 'http://localhost:3000/tutor';
    case 'TESTS':
      return import.meta.env.VITE_TEST_API_URL || 'http://localhost:3000/tests';
    default:
      return '';
  }
};

interface RequestOptions extends AxiosRequestConfig {
  authenticated?: boolean;
}

class ApiClient {
  private async request<T>(
    service: ServiceType,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const baseUrl = getBaseUrl(service);
    const url = `${baseUrl}${endpoint}`;

    const config: AxiosRequestConfig = {
      url,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
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
      const response = await axios(config);
      return response.data;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Handle 401 Unauthorized globally if needed
          if (error.response.status === 401) {
            console.warn('Unauthorized access. Token might be invalid or expired.');
            localStorage.removeItem('msai_educator_token');
            window.location.href = '/login';
          }
           // Throw an error with status and text to mimic previous behavior if needed, 
           // or just propagate the axios error. 
           // The previous implementation threw: Error(`API Error: ${response.status} ${response.statusText}`)
           throw new Error(`API Error: ${error.response.status} ${error.response.statusText}`);
        } else if (error.request) {
           // The request was made but no response was received
           throw new Error('API Error: No response received');
        }
      }
      throw error;
    }
  }

  // HTTP Wrapper Methods
  async get<T>(service: ServiceType, endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(service, endpoint, { ...options, method: 'GET' });
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

  async delete<T>(service: ServiceType, endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(service, endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
