// Minimal Supabase REST client for k6. Sends the same HTTP requests that
// supabase-js sends from the browser, signed in as one test account.
import http from "k6/http";
import { sleep } from "k6";

export const OBJECT = "application/vnd.pgrst.object+json";

/** Build a query string the way supabase-js does: key=value&key=value */
export function qs(params) {
  return Object.keys(params)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");
}

export function between(min, max) {
  return min + Math.random() * (max - min);
}

/** Pause like a person would (seconds). */
export function think(range) {
  sleep(between(range[0], range[1]));
}

export class Api {
  /**
   * @param project { url, anonKey }
   * @param account { email, access_token, refresh_token }
   * @param canRefresh false for a session shared by several VUs (refresh
   *        tokens are single-use, so only one VU may rotate them)
   */
  constructor(project, account, { canRefresh = true } = {}) {
    this.base = project.url;
    this.anonKey = project.anonKey;
    this.email = account.email;
    this.token = account.access_token;
    this.refreshToken = account.refresh_token;
    this.expiresAt = account.expires_at || 0; // unix seconds
    this.canRefresh = canRefresh;
  }

  headers(extra) {
    return Object.assign(
      {
        apikey: this.anonKey,
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "X-Client-Info": "k6-stress-test",
      },
      extra || {},
    );
  }

  request(method, path, body, name, extra, params) {
    // Like supabase-js: refresh shortly before the token expires, not after.
    if (this.canRefresh && this.expiresAt && Date.now() / 1000 > this.expiresAt - 60) this.refresh();
    const payload = body === undefined ? null : JSON.stringify(body);
    const send = () =>
      http.request(method, this.base + path, payload, Object.assign({
        headers: this.headers(extra),
        tags: { name },
        timeout: "60s",
      }, params || {}));
    let res = send();
    if (res.status === 401 && this.canRefresh && this.refresh()) res = send();
    return res;
  }

  get(path, name, extra) { return this.request("GET", path, undefined, name, extra); }
  post(path, body, name, extra) { return this.request("POST", path, body, name, extra); }
  patch(path, body, name, extra) { return this.request("PATCH", path, body, name, extra); }
  del(path, name, extra) { return this.request("DELETE", path, undefined, name, extra); }
  rpc(fn, args, name, params) { return this.request("POST", `/rest/v1/rpc/${fn}`, args, name, undefined, params); }

  refresh() {
    if (!this.refreshToken) return false;
    const res = http.post(
      `${this.base}/auth/v1/token?grant_type=refresh_token`,
      JSON.stringify({ refresh_token: this.refreshToken }),
      { headers: { apikey: this.anonKey, "Content-Type": "application/json" }, tags: { name: "auth_refresh" } },
    );
    if (res.status !== 200) {
      this.expiresAt = 0; // stop trying before every request; a 401 will retry once
      return false;
    }
    const s = res.json();
    this.token = s.access_token;
    this.refreshToken = s.refresh_token;
    this.expiresAt = s.expires_at || 0;
    return true;
  }
}

/** JSON body of a response, or null if it isn't JSON. */
export function json(res) {
  try {
    return res.json();
  } catch (e) {
    return null;
  }
}

export function ok(res) {
  return res.status >= 200 && res.status < 300;
}
