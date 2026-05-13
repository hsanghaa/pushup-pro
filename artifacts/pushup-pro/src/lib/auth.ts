import { useLocation } from "wouter";

export const USER_ID_KEY = "pushupProUserId";

export function getUserId(): number | null {
  const stored = localStorage.getItem(USER_ID_KEY);
  if (!stored) return null;
  const parsed = parseInt(stored, 10);
  return isNaN(parsed) ? null : parsed;
}

export function setUserId(id: number) {
  localStorage.setItem(USER_ID_KEY, id.toString());
}

export function clearUserId() {
  localStorage.removeItem(USER_ID_KEY);
}

export function useRequireAuth() {
  const [, setLocation] = useLocation();
  const userId = getUserId();
  
  if (!userId) {
    setLocation("/onboarding");
  }
  
  return userId;
}
