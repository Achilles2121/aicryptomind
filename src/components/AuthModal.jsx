import { useState } from "react";
import PropTypes from "prop-types";

/**
 * AuthModal - Full-screen authentication modal
 * 
 * Features:
 * - Email/Password Login & Signup
 * - Google Sign-In
 * - Form validation
 * - Responsive design
 */
export default function AuthModal({
  isOpen,
  onClose,
  onLogin,
  onSignup,
  onGoogleSignIn,
  lang = "de",
}) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const t = (key) => {
    const translations = {
      de: {
        login: "Anmelden",
        signup: "Registrieren",
        email: "E-Mail-Adresse",
        password: "Passwort",
        confirmPassword: "Passwort bestätigen",
        forgotPassword: "Passwort vergessen?",
        noAccount: "Noch kein Konto?",
        hasAccount: "Bereits registriert?",
        orContinueWith: "Oder fortfahren mit",
        google: "Mit Google anmelden",
        welcomeBack: "Willkommen zurück",
        createAccount: "Konto erstellen",
        welcomeSubtitle: "Melde dich an, um auf alle Features zuzugreifen",
        signupSubtitle: "Erstelle ein Konto und starte deine 7-Tage Elite-Testversion",
        emailRequired: "Bitte E-Mail eingeben",
        invalidEmail: "Ungültiges E-Mail-Format",
        passwordRequired: "Bitte Passwort eingeben",
        passwordTooShort: "Passwort muss mindestens 6 Zeichen haben",
        passwordMismatch: "Passwörter stimmen nicht überein",
        signupSuccess: "✅ Registrierung erfolgreich! Du kannst jetzt den Elite-Trial starten.",
        close: "Schließen",
      },
      en: {
        login: "Sign In",
        signup: "Sign Up",
        email: "Email Address",
        password: "Password",
        confirmPassword: "Confirm Password",
        forgotPassword: "Forgot password?",
        noAccount: "Don't have an account?",
        hasAccount: "Already have an account?",
        orContinueWith: "Or continue with",
        google: "Sign in with Google",
        welcomeBack: "Welcome back",
        createAccount: "Create Account",
        welcomeSubtitle: "Sign in to access all features",
        signupSubtitle: "Create an account and start your 7-day Elite trial",
        emailRequired: "Please enter email",
        invalidEmail: "Invalid email format",
        passwordRequired: "Please enter password",
        passwordTooShort: "Password must be at least 6 characters",
        passwordMismatch: "Passwords do not match",
        signupSuccess: "✅ Registration successful! You can now start the Elite trial.",
        close: "Close",
      },
    };
    return translations[lang]?.[key] || translations.en[key] || key;
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!email.trim()) {
      setError(t("emailRequired"));
      return;
    }
    if (!validateEmail(email.trim())) {
      setError(t("invalidEmail"));
      return;
    }
    if (!password) {
      setError(t("passwordRequired"));
      return;
    }
    if (password.length < 6) {
      setError(t("passwordTooShort"));
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await onLogin(email.trim(), password);
        onClose();
      } else {
        await onSignup(email.trim(), password);
        setSuccess(t("signupSuccess"));
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err) {
      let msg = err?.message || "Error";
      // Translate common Firebase errors
      if (msg.includes("email-already-in-use")) {
        msg = lang === "de" ? "Diese E-Mail ist bereits registriert" : "This email is already registered";
      } else if (msg.includes("user-not-found")) {
        msg = lang === "de" ? "Benutzer nicht gefunden" : "User not found";
      } else if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        msg = lang === "de" ? "Falsches Passwort" : "Wrong password";
      } else if (msg.includes("too-many-requests")) {
        msg = lang === "de" ? "Zu viele Versuche. Bitte später erneut." : "Too many attempts. Try again later.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await onGoogleSignIn();
      onClose();
    } catch (err) {
      let msg = err?.message || "Google sign-in failed";
      if (msg.includes("popup-closed-by-user")) {
        msg = lang === "de" ? "Anmeldung abgebrochen" : "Sign-in cancelled";
      } else if (msg.includes("operation-not-allowed")) {
        msg = lang === "de" 
          ? "Google-Anmeldung ist noch nicht aktiviert. Bitte nutze Email/Passwort." 
          : "Google sign-in is not enabled yet. Please use email/password.";
      } else if (msg.includes("popup-blocked")) {
        msg = lang === "de" 
          ? "Popup wurde blockiert. Bitte erlaube Popups für diese Seite." 
          : "Popup was blocked. Please allow popups for this site.";
      } else if (msg.includes("network-request-failed")) {
        msg = lang === "de" ? "Netzwerkfehler. Bitte prüfe deine Verbindung." : "Network error. Please check your connection.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
  };

  const switchMode = (newMode) => {
    resetForm();
    setMode(newMode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-slate-400 hover:text-white transition-colors"
          aria-label={t("close")}
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal Card */}
        <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500/20 via-amber-600/10 to-transparent p-6 border-b border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <span className="text-xl">👁️</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {mode === "login" ? t("welcomeBack") : t("createAccount")}
                </h2>
                <p className="text-sm text-slate-400">
                  {mode === "login" ? t("welcomeSubtitle") : t("signupSubtitle")}
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                {t("email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                {t("password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                disabled={loading}
              />
            </div>

            {/* Confirm Password (Signup only) */}
            {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  {t("confirmPassword")}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
                {success}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-semibold hover:from-amber-400 hover:to-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : mode === "login" ? (
                t("login")
              ) : (
                t("signup")
              )}
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-800 text-slate-500">{t("orContinueWith")}</span>
              </div>
            </div>

            {/* Google Sign-In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-white text-slate-900 font-medium hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t("google")}
            </button>
          </form>

          {/* Footer - Switch Mode */}
          <div className="px-6 pb-6 text-center space-y-4">
            {/* 7-Day Trial Banner */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 border border-cyan-500/30">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-lg">🎁</span>
                <span className="text-sm font-semibold text-cyan-100">
                  {lang === "de" ? "7 Tage Elite gratis!" : "7 Days Elite Free!"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {lang === "de" 
                  ? "Registriere dich jetzt und erhalte 7 Tage vollen Elite-Zugang kostenlos."
                  : "Sign up now and get 7 days of full Elite access for free."}
              </p>
            </div>
            
            <p className="text-slate-400 text-sm">
              {mode === "login" ? t("noAccount") : t("hasAccount")}{" "}
              <button
                type="button"
                onClick={() => switchMode(mode === "login" ? "signup" : "login")}
                className="text-amber-400 hover:text-amber-300 font-medium"
              >
                {mode === "login" ? t("signup") : t("login")}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

AuthModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onLogin: PropTypes.func.isRequired,
  onSignup: PropTypes.func.isRequired,
  onGoogleSignIn: PropTypes.func.isRequired,
  lang: PropTypes.string,
};
