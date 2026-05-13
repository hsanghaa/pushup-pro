import { useEffect } from "react";

export function useStreakNotification(
  todayReps: number | undefined,
  currentStreak: number | undefined,
  topRivalName?: string,
) {
  useEffect(() => {
    if (!("Notification" in window)) return;
    if ((todayReps ?? 0) > 0) return;
    if ((currentStreak ?? 0) === 0) return;

    const today = new Date().toISOString().split("T")[0];
    const lastNotified = localStorage.getItem("pushupProLastStreakNotif");
    if (lastNotified === today) return;

    const hour = new Date().getHours();
    if (hour < 10) return;

    const show = async () => {
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      if (permission === "granted") {
        localStorage.setItem("pushupProLastStreakNotif", today);
        new Notification("Don't break your streak! 🔥", {
          body: topRivalName
            ? `${topRivalName} already trained today. Your ${currentStreak}-day streak is at risk!`
            : `You have a ${currentStreak}-day streak at risk. Do at least one set today!`,
          tag: "streak-reminder",
        });
      }
    };

    show();
  }, [todayReps, currentStreak, topRivalName]);
}
