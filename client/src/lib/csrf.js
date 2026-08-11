const COOKIE_NAME = "XSRF-TOKEN";

export function getCsrfToken() {
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + COOKIE_NAME + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}
