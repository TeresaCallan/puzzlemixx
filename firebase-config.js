// PuzzleMixx online settings.
// Paste the firebaseConfig from the Firebase console between the braces below
// (Project settings › Your apps › Web app). These keys are meant to be public;
// the security rules in firestore.rules are what protect players' data.
window.PM_FIREBASE_CONFIG = {
  apiKey: "AIzaSyARk-pqJkru0y_PBiITLzBX8ePjZEMWJdM",
  authDomain: "puzzlemixx-7e014.firebaseapp.com",
  projectId: "puzzlemixx-7e014",
  storageBucket: "puzzlemixx-7e014.firebasestorage.app",
  messagingSenderId: "598431934249",
  appId: "1:598431934249:web:cf002f10a4c36a8122b938"
};

// Who can approve +100 stretch bonuses, and where reports and claims are emailed.
window.PM_ADMIN_EMAIL = 'puzzlemixx@gmail.com';

// Practice opens 16 Nov 2026; the competition (Round 1, 90 days) starts 26 Nov 2026 00:00 UTC
// and ends 23 Feb 2027 (midnight GMT). Rounds are worked out in pm-points.js.
window.PM_CONTEST_START = Date.UTC(2026, 10, 16, 0, 0, 0);
window.PM_ROUND_ONE_END = Date.UTC(2026, 10, 26, 0, 0, 0);
window.PM_CONTEST_END = Date.UTC(2027, 1, 23, 23, 59, 59);

// The address shared in success posts so friends can join the game.
window.PM_JOIN_URL = 'https://www.puzzlemixx.com';
// Firebase App Check (reCAPTCHA / Google Cloud Fraud Defense site key — public, safe to publish).
window.PM_APPCHECK_SITE_KEY = '6LfEqiguAAAAAK8la76YDNQgEs6b2l1DcD4lkADb';
