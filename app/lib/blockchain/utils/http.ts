// src/utils/http.ts

import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { APIError, APIRateLimitError } from '@/lib/blockchain/clients/base';

interface RetryConfig {
  maxRetries: number;
  retryDelay: number; // milliseconds
  retryableStatusCodes: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableStatusCodes: [429, 500, 502, 503, 504]
};

/**
 * HTTP client with automatic retry logic
 * Handles rate limits and transient errors
 */
export class HTTPClient {
  private requestCount = 0;
  
  /**
   * Make an HTTP GET request with retry logic
   * @param url - The URL to fetch
   * @param config - Axios config options
   * @param retryConfig - Retry configuration
   * @returns Response data
   */
  async get<T>(
    url: string,
    config?: AxiosRequestConfig,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
  ): Promise<T> {
    this.requestCount++;
    let lastError: AxiosError | null = null;
    
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const response = await axios.get<T>(url, {
          timeout: 30000, // 30 second timeout
          ...config
        });
        
        return response.data;
      } catch (error) {
        if (!axios.isAxiosError(error)) {
          throw error;
        }
        
        lastError = error;
        const statusCode = error.response?.status;
        
        // Check if we should retry
        if (
          attempt < retryConfig.maxRetries &&
          statusCode &&
          retryConfig.retryableStatusCodes.includes(statusCode)
        ) {
          // Handle rate limiting with exponential backoff
          const delay = statusCode === 429 
            ? retryConfig.retryDelay * Math.pow(2, attempt)
            : retryConfig.retryDelay;
          
          console.warn(
            `Request failed with status ${statusCode}, retrying in ${delay}ms (attempt ${attempt + 1}/${retryConfig.maxRetries})`
          );
          
          await this.sleep(delay);
          continue;
        }
        
        // Not retryable, throw appropriate error
        if (statusCode === 429) {
          const retryAfter = error.response?.headers['retry-after'];
          throw new APIRateLimitError('unknown', retryAfter ? parseInt(retryAfter) : undefined);
        }
        
        throw new APIError(
          'unknown',
          error.message || 'HTTP request failed',
          statusCode
        );
      }
    }
    
    // All retries exhausted
    throw new APIError(
      'unknown',
      lastError?.message || 'HTTP request failed after retries',
      lastError?.response?.status
    );
  }
  
  /**
   * Make an HTTP POST request with retry logic
   * @param url - The URL to post to
   * @param data - Request body
   * @param config - Axios config options
   * @param retryConfig - Retry configuration
   * @returns Response data
   */
  async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
  ): Promise<T> {
    this.requestCount++;
    let lastError: AxiosError | null = null;
    
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const response = await axios.post<T>(url, data, {
          timeout: 30000,
          ...config
        });
        
        return response.data;
      } catch (error) {
        if (!axios.isAxiosError(error)) {
          throw error;
        }
        
        lastError = error;
        const statusCode = error.response?.status;
        
        if (
          attempt < retryConfig.maxRetries &&
          statusCode &&
          retryConfig.retryableStatusCodes.includes(statusCode)
        ) {
          const delay = statusCode === 429 
            ? retryConfig.retryDelay * Math.pow(2, attempt)
            : retryConfig.retryDelay;
          
          await this.sleep(delay);
          continue;
        }
        
        if (statusCode === 429) {
          const retryAfter = error.response?.headers['retry-after'];
          throw new APIRateLimitError('unknown', retryAfter ? parseInt(retryAfter) : undefined);
        }
        
        throw new APIError(
          'unknown',
          error.message || 'HTTP request failed',
          statusCode
        );
      }
    }
    
    throw new APIError(
      'unknown',
      lastError?.message || 'HTTP request failed after retries',
      lastError?.response?.status
    );
  }
  
  /**
   * Get total number of HTTP requests made
   */
  getRequestCount(): number {
    return this.requestCount;
  }
  
  /**
   * Reset request counter
   */
  resetRequestCount(): void {
    this.requestCount = 0;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global HTTP client instance
export const httpClient = new HTTPClient();