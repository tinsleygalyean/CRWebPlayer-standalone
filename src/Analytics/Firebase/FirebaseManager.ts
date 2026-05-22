import { initializeApp, FirebaseApp } from "firebase/app";
import { getAnalytics, logEvent, Analytics } from "firebase/analytics";
import { firebaseConfig } from "./config";

export class FirebaseAnalyticsManager {
  public static instance: FirebaseAnalyticsManager;
  public firebaseApp: FirebaseApp;
  public firebaseAnalytics: Analytics;

  public constructor() {
    try {
      this.firebaseApp = initializeApp(firebaseConfig);
      this.firebaseAnalytics = getAnalytics(this.firebaseApp);
    } catch (error) {
      console.error("Error while initializing Firebase:", error);
    }
  }

  public static getInstance(): FirebaseAnalyticsManager {
    if (!FirebaseAnalyticsManager.instance) {
      FirebaseAnalyticsManager.instance = new FirebaseAnalyticsManager();
    }
    return FirebaseAnalyticsManager.instance;
  }

  /**
   * §2f — All log methods are synchronous wrappers around Firebase logEvent.
   * They are intentionally NOT async — callers must never await them.
   */
  public logEventWithPayload(eventName: string, payload: object): void {
    try {
      logEvent(this.firebaseAnalytics, eventName, payload as Record<string, unknown>);
    } catch (error) {
      // §2f — swallow; analytics must never block or reject the calling flow
    }
  }

  public logSessionStartWithPayload(payload: object): void {
    try {
      logEvent(this.firebaseAnalytics, "session_start", payload as Record<string, unknown>);
    } catch (error) {
      // §2f — swallow
    }
  }

  public logDownloadProgressWithPayload(eventName: string, payload: object): void {
    try {
      logEvent(this.firebaseAnalytics, eventName, payload as Record<string, unknown>);
    } catch (error) {
      // §2f — swallow
    }
  }
}
