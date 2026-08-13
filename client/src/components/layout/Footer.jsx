import { Link } from "react-router-dom";

export function Footer() {
  return (
    <>
      <div className="container-fluid crownify4 d-flex justify-content-center align-items-center">
        <img src="/assets/images/logo/Crownify_logo_text.png" className="custom-logo" alt="" />
      </div>

      <footer id="footer" className="footer-5">
        <div className="site-footer">
          <div className="container">
            <div className="footer-top">
              <div className="row">
                <div className="col-12 col-sm-12 col-md-3 col-lg-3 footer-links">
                  <h4 className="h4">Informations</h4>
                  <ul>
                    <li>
                      <Link to="/About">About us</Link>
                    </li>
                    <li>
                      <a href="#">Careers</a>
                    </li>
                    <li>
                      <a href="#">Privacy policy</a>
                    </li>
                    <li>
                      <a href="#">Terms &amp; condition</a>
                    </li>
                    <li>
                      <a href="#">My Account</a>
                    </li>
                  </ul>
                </div>
                <div className="col-12 col-sm-12 col-md-3 col-lg-3 footer-links">
                  <h4 className="h4">Customer Services</h4>
                  <ul>
                    <li>
                      <a href="#">Request Personal Data</a>
                    </li>
                    <li>
                      <Link to="/faq">FAQ's</Link>
                    </li>
                    <li>
                      <Link to="/contact">Contact Us</Link>
                    </li>
                    <li>
                      <a href="#">Orders and Returns</a>
                    </li>
                    <li>
                      <Link to="/contact">Support Center</Link>
                    </li>
                  </ul>
                </div>
                <div className="col-12 col-sm-12 col-md-3 col-lg-3">
                  <div className="display-table">
                    <div className="display-table-cell footer-newsletter">
                      <form action="#" method="post" onSubmit={(e) => e.preventDefault()}>
                        <label className="h4">Newsletter</label>
                        <p style={{ lineHeight: 1.6 }}>Be the first to hear about new trending and offers and see how you've helped.</p>
                        <div className="input-group">
                          <input
                            type="email"
                            className="input-group__field newsletter__input"
                            name="EMAIL"
                            placeholder="Email address"
                            required
                          />
                          <span className="input-group__btn">
                            <button type="submit" className="btn newsletter__submit" name="commit" id="Subscribe">
                              <span className="newsletter__submit-text--large">Subscribe</span>
                            </button>
                          </span>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
                <div className="col-12 col-sm-12 col-md-3 col-lg-3 contact-box">
                  <h4 className="h4">About Us</h4>
                  <p style={{ lineHeight: 1.6 }}>
                    Crownify – Your go-to store for premium headwear, blending style, comfort, and quality for every occasion.
                  </p>
                  <ul className="addressFooter">
                    <li className="email">
                      <i className="icon anm anm-envelope-l"></i>
                      <p>crownify24@gmail.com</p>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <hr />
            <div className="footer-bottom">
              <div className="row">
                <div className="col-12 col-sm-12 col-md-6 col-lg-6 order-1 order-md-0 order-lg-0 order-sm-1 copyright text-sm-center text-md-left text-lg-left"></div>
                <div className="col-12 col-sm-12 col-md-6 col-lg-6 order-0 order-md-1 order-lg-1 order-sm-0 payment-icons text-right text-md-center">
                  <img src="/assets/images/safepayment.png" alt="Payment" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <span
        id="site-scroll"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        style={{ cursor: "pointer" }}
      >
        <i className="icon anm anm-angle-up-r"></i>
      </span>
    </>
  );
}
