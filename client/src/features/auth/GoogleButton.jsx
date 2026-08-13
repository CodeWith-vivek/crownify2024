import { googleLoginUrl } from "./authApi";

export function GoogleButton({ from = "login" }) {
  return (
    <a href={googleLoginUrl(from)} className="social-icon google d-flex align-items-center justify-content-center">
      <span className="fa fa-google"></span>
    </a>
  );
}
