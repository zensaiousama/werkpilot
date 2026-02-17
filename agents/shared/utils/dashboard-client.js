/**
 * Dashboard API Client
 * Simple HTTP client wrapper for communicating with the dashboard backend
 */

const https = require('https');
const http = require('http');

class DashboardClient {
  constructor() {
    this.baseUrl = process.env.DASHBOARD_URL || 'http://localhost:3002';
    this.timeout = 10000; // 10 seconds
    this.maxRetries = 3;
  }

  /**
   * Make HTTP request with retry logic
   * @private
   */
  async _request(method, path, body = null, retryCount = 0) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const options = {
        method,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Werkpilot-Agent/1.0'
        },
        timeout: this.timeout
      };

      if (body && (method === 'POST' || method === 'PATCH')) {
        const bodyString = JSON.stringify(body);
        options.headers['Content-Length'] = Buffer.byteLength(bodyString);
      }

      const req = httpModule.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = data ? JSON.parse(data) : {};
              resolve(parsed);
            } catch (err) {
              console.error('[DashboardClient] Failed to parse response:', err.message);
              resolve({ success: true, data });
            }
          } else if (res.statusCode >= 500 && retryCount < this.maxRetries) {
            // Retry on server errors
            console.warn(`[DashboardClient] Server error (${res.statusCode}), retrying... (${retryCount + 1}/${this.maxRetries})`);
            setTimeout(() => {
              this._request(method, path, body, retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, Math.pow(2, retryCount) * 1000); // Exponential backoff
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        if (retryCount < this.maxRetries) {
          console.warn(`[DashboardClient] Request error: ${err.message}, retrying... (${retryCount + 1}/${this.maxRetries})`);
          setTimeout(() => {
            this._request(method, path, body, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, Math.pow(2, retryCount) * 1000);
        } else {
          console.error('[DashboardClient] Request failed after retries:', err.message);
          reject(err);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        const timeoutErr = new Error(`Request timeout after ${this.timeout}ms`);
        if (retryCount < this.maxRetries) {
          console.warn(`[DashboardClient] Timeout, retrying... (${retryCount + 1}/${this.maxRetries})`);
          setTimeout(() => {
            this._request(method, path, body, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, Math.pow(2, retryCount) * 1000);
        } else {
          console.error('[DashboardClient] Request timeout after retries');
          reject(timeoutErr);
        }
      });

      if (body && (method === 'POST' || method === 'PATCH')) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * GET request
   */
  async get(path) {
    return this._request('GET', path);
  }

  /**
   * POST request
   */
  async post(path, body) {
    return this._request('POST', path, body);
  }

  /**
   * PATCH request
   */
  async patch(path, body) {
    return this._request('PATCH', path, body);
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.get('/api/health');
      return true;
    } catch (err) {
      console.error('[DashboardClient] Health check failed:', err.message);
      return false;
    }
  }
}

// Singleton instance
const client = new DashboardClient();

module.exports = client;
