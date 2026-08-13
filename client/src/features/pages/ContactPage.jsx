import { useState } from "react";
import { toast } from "sonner";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";
import { contactApi } from "./contactApi";

const NAME_PATTERN = /^[A-Za-z]+(?: [A-Za-z]+){1,2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{10}$/;

function validateField(field, value) {
  const trimmed = value.trim();
  switch (field) {
    case "name":
      if (trimmed === "") return "Name cannot be empty.";
      if (!NAME_PATTERN.test(trimmed)) return "Enter a valid full name.";
      return "";
    case "email":
      if (trimmed === "") return "Email cannot be empty.";
      if (!EMAIL_PATTERN.test(trimmed)) return "Enter a valid email address.";
      return "";
    case "phone":
      if (trimmed === "") return "Phone number cannot be empty.";
      if (!PHONE_PATTERN.test(trimmed)) return "Phone number must be 10 digits.";
      return "";
    case "message":
      if (trimmed === "") return "Message cannot be empty.";
      if (trimmed.length < 10) return "Message must be at least 10 characters.";
      return "";
    default:
      return "";
  }
}

export function ContactPage() {
  usePageAssets("user", "headershop", userProfiles);

  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (touched[field]) {
      setErrors((e) => ({ ...e, [field]: validateField(field, value) }));
    }
  };

  const handleBlur = (field) => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((e) => ({ ...e, [field]: validateField(field, form[field]) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {
      name: validateField("name", form.name),
      email: validateField("email", form.email),
      phone: validateField("phone", form.phone),
      message: validateField("message", form.message),
    };
    setErrors(nextErrors);
    setTouched({ name: true, email: true, phone: true, message: true });

    if (Object.values(nextErrors).some(Boolean)) {
      toast.error("Please correct the errors in the form.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await contactApi.submit(form);
      if (res?.success !== false) {
        toast.success(res?.message || "Your message has been submitted!");
        setForm({ name: "", email: "", phone: "", message: "" });
        setTouched({});
        setErrors({});
      } else {
        toast.error(res?.message || "Failed to submit your message. Please try again.");
      }
    } catch (err) {
      toast.error("There was an error submitting your form.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="breadcrumb-option">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="breadcrumb__text">
                <h4>Shop</h4>
                <div className="breadcrumb__links">
                  <a href="/">Home</a>
                  <span>Contact</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="container-fluid crownify d-flex justify-content-center align-items-center" style={{ marginTop: 0 }}>
        <img src="/assets/images/logo/Crownify_logo_text.webp" className="custom-logo" alt="" />
      </div>

      <div className="map">
        <iframe src="https://www.google.com/maps?q=9.938290,76.321862&z=15&output=embed" height="500" style={{ border: 0 }} allowFullScreen="" aria-hidden="false" tabIndex="0"></iframe>
      </div>

      <section className="contact spad" style={{ backgroundColor: "#fdeaea" }}>
        <div className="container">
          <div className="row">
            <div className="col-lg-6 col-md-6">
              <div className="contact__text">
                <div className="section-title">
                  <span>Information</span>
                  <h2>Contact Us</h2>
                  <p>At Crownify, we're dedicated to providing exceptional service and support. Reach out to us for any inquiries or assistance – we're here to help!</p>
                </div>
                <ul>
                  <li>
                    <h4>Kochi</h4>
                    <p>
                      Maradu, Ernakulam, Kochi, Kerala 682016 <br />
                      +91 974-635-1234
                    </p>
                  </li>
                  <li>
                    <h4>Thiruvananthapuram</h4>
                    <p>
                      Statue Junction, Palayam, Thiruvananthapuram, Kerala 695001 <br />
                      +91 854-712-5678
                    </p>
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-lg-6 col-md-6">
              <div className="contact__form">
                <form onSubmit={handleSubmit}>
                  <div className="row">
                    <div className="col-lg-12">
                      <div className="error-message">{errors.name}</div>
                      <input type="text" placeholder="Full Name" value={form.name} onChange={(e) => handleChange("name", e.target.value)} onBlur={() => handleBlur("name")} />
                    </div>
                    <div className="col-lg-12">
                      <div className="error-message">{errors.email}</div>
                      <input type="text" placeholder="Email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} onBlur={() => handleBlur("email")} />
                    </div>
                    <div className="col-lg-12">
                      <div className="error-message">{errors.phone}</div>
                      <input type="text" placeholder="Phone" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} onBlur={() => handleBlur("phone")} />
                    </div>
                    <div className="col-lg-12">
                      <div className="error-message">{errors.message}</div>
                      <textarea placeholder="Message" value={form.message} onChange={(e) => handleChange("message", e.target.value)} onBlur={() => handleBlur("message")}></textarea>
                      <button type="submit" className="site-btn" disabled={submitting}>
                        {submitting ? "Sending..." : "Send Message"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
