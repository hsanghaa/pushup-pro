const TRASH_TALK: Record<string, string[]> = {
  machine: [
    "Let's make this interesting. I haven't skipped a single day in months.",
    "Nice to meet you. Fair warning — I don't lose.",
    "I've been training while you were sleeping. Let's see what you've got.",
  ],
  grinder: [
    "Volume beats talent every time. Show me your volume.",
    "I did a hundred reps before breakfast. Just warming up.",
    "Hope you brought your work ethic. I brought mine.",
  ],
  competitor: [
    "I already looked up your stats. I'm not impressed... yet.",
    "I adapt to whoever I compete with. You should be a little worried.",
    "Your move. I'll be watching.",
  ],
  comeback_kid: [
    "I take days off so I can come back twice as hard. Watch what happens next.",
    "You think a streak matters? I peak when it actually counts.",
    "Rest is part of my plan. What's your plan?",
  ],
  underdog: [
    "You're supposed to be better than me. Prove it.",
    "I've got nothing to lose. That makes me dangerous.",
    "Everyone underestimates me. That's always their mistake.",
  ],
  consistent: [
    "Consistency beats intensity. Ask me how I know.",
    "I show up every single day. Do you?",
    "Five days a week, no exceptions. Ready to match that?",
  ],
  weekend_warrior: [
    "I save my best for when it matters. The weekend's coming.",
    "Don't count me out. I go really hard when I go.",
    "Save your strength. You'll need it when I peak.",
  ],
};

const WORKOUT_TAUNTS: Record<number, string[]> = {
  5:  ["Five reps? I warm up with fifty.", "That's a start. Keep going.", "Five down. How many more you got?"],
  10: ["Ten reps. I did that before I got out of bed.", "Double digits. Not bad... for now.", "Ten. I'm barely paying attention yet."],
  15: ["Fifteen. Getting warmer.", "Not bad. But not good enough yet.", "Fifteen reps. I feel a threat coming on."],
  20: ["Twenty reps. Now you're starting to impress me. A little.", "Twenty. Okay. Keep that up.", "Nice — twenty. Don't stop now."],
  25: ["Twenty-five. That's a quarter of my warm-up.", "You've got some fire in you. Show me more.", "Twenty-five. Respect. Now push harder."],
  30: ["Thirty reps. Okay. Now we're actually competing.", "Thirty strong. I might have to take this seriously.", "Thirty. You're not going to quit now, are you?"],
  40: ["Forty reps. I'm starting to sweat a little. A little.", "Forty. My kind of rival. Don't slow down.", "Forty reps — that's elite territory. Keep it there."],
  50: ["Fifty reps. That is seriously impressive. Well done.", "Half a century of push-ups. I respect that.", "Fifty. Okay. You've earned some respect today."],
  75: ["Seventy-five. You're an animal. Absolutely relentless.", "Seventy-five reps? I might need to train harder.", "Seventy-five. I didn't think you had it. I was wrong."],
  100: ["One hundred reps. That is legendary. I bow to you.", "A hundred push-ups. You are an absolute machine.", "One hundred. I have no more trash talk. You've won today."],
};

function getVoiceParams(personality: string): { pitch: number; rate: number } {
  switch (personality) {
    case "machine":    return { pitch: 0.75, rate: 0.88 };
    case "grinder":    return { pitch: 1.1,  rate: 1.05 };
    case "competitor": return { pitch: 0.95, rate: 0.92 };
    case "comeback_kid": return { pitch: 1.05, rate: 1.0 };
    case "underdog":   return { pitch: 1.15, rate: 1.0 };
    case "consistent": return { pitch: 0.9,  rate: 0.95 };
    case "weekend_warrior": return { pitch: 1.2, rate: 1.1 };
    default:           return { pitch: 1.0,  rate: 1.0 };
  }
}

export function speakRivalGenerated(personality: string, name: string): void {
  if (!("speechSynthesis" in window)) return;
  const lines = TRASH_TALK[personality] ?? TRASH_TALK["competitor"]!;
  const line = lines[Math.floor(Math.random() * lines.length)]!;
  speakLine(`${name.split(" ")[0]} says: ${line}`, personality);
}

export function speakWorkoutTaunt(reps: number, personality: string, rivalName: string): void {
  if (!("speechSynthesis" in window)) return;
  const lines = WORKOUT_TAUNTS[reps];
  if (!lines) return;
  const line = lines[Math.floor(Math.random() * lines.length)]!;
  speakLine(`${rivalName.split(" ")[0]}: ${line}`, personality);
}

function speakLine(text: string, personality: string): void {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const { pitch, rate } = getVoiceParams(personality);
  utterance.pitch = pitch;
  utterance.rate = rate;
  utterance.volume = 0.9;
  window.speechSynthesis.speak(utterance);
}
