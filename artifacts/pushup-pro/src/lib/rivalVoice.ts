const TRASH_TALK: Record<string, string[]> = {
  machine: [
    "Hey, I'm glad you're here. Just know — I haven't missed a single day in months.",
    "Welcome. Fair warning though — I take this seriously.",
    "Good to meet you. I've been training while most people sleep. Let's see what you've got.",
  ],
  grinder: [
    "Volume is everything. Show me you can keep up.",
    "I did a hundred reps before breakfast. I'm just getting started.",
    "Hope you brought your work ethic today. I always bring mine.",
  ],
  competitor: [
    "I already looked at your numbers. I'm not worried — yet.",
    "I adapt to whoever I'm up against. You might want to train a little harder.",
    "Your move. I'll be watching.",
  ],
  comeback_kid: [
    "I take rest days so I can come back twice as strong. Watch what happens.",
    "A streak? That's cute. I peak when it actually matters.",
    "Rest is part of my plan. Do you even have a plan?",
  ],
  underdog: [
    "You're supposed to be better than me. Go ahead and prove it.",
    "I've got nothing to lose. That actually makes me pretty dangerous.",
    "Everyone underestimates me. That tends to be their mistake.",
  ],
  consistent: [
    "Consistency beats intensity — I've got the data to prove it.",
    "I show up every single day, no exceptions. Can you say the same?",
    "Five days a week, every week. Ready to match that?",
  ],
  weekend_warrior: [
    "I save my best for when it actually counts. The weekend is coming.",
    "Don't write me off. When I go, I really go.",
    "Save your energy. You'll need it when I hit my stride.",
  ],
};

const WORKOUT_TAUNTS: Record<number, string[]> = {
  5:  ["Five reps. That's a start — keep going.", "Alright, five down. Let's see how many more you've got.", "Five. Not bad for a warm-up."],
  10: ["Ten reps. Now we're talking.", "Double digits. You're just getting started.", "Ten down. I like the energy — don't stop now."],
  15: ["Fifteen. You're finding your rhythm.", "Not bad at all. Keep that pace going.", "Fifteen reps. I'm starting to pay attention."],
  20: ["Twenty reps. Now you're actually impressing me.", "Twenty. Okay — keep that up and we have a real competition.", "Nice work — twenty. Don't slow down now."],
  25: ["Twenty five. You've got some fire in you.", "Twenty five reps. Show me more of that.", "That's twenty five. Respect. Now push harder."],
  30: ["Thirty reps. Now we're actually competing.", "Thirty strong. I might need to take this seriously.", "Thirty. You're not going to quit on me now, are you?"],
  40: ["Forty reps. Okay — I'm impressed. Keep going.", "Forty. My kind of competitor. Don't slow down.", "Forty reps — that's serious work. Stay with it."],
  50: ["Fifty reps. That is genuinely impressive. Well done.", "Half a century of push-ups. I respect that.", "Fifty. You've earned some real respect today."],
  75: ["Seventy five. You are absolutely relentless.", "Seventy five reps? I may need to step up my training.", "Seventy five. I underestimated you. I won't make that mistake again."],
  100: ["One hundred reps. That is legendary. I have nothing but respect for you.", "A hundred push-ups. You are a machine. Well done.", "One hundred. I'm out of trash talk. You won today."],
};

// Voice priority: most natural-sounding first
const VOICE_PRIORITY_PATTERNS = [
  "Google US English",
  "Microsoft Aria Online (Natural)",
  "Microsoft Jenny Online (Natural)",
  "Microsoft Guy Online (Natural)",
  "Microsoft Davis Online (Natural)",
  "Microsoft Ana Online (Natural)",
  "Aria",
  "Jenny",
  "Microsoft Aria",
  "Microsoft Jenny",
  "Microsoft Guy",
  "Microsoft",
  "Google",
  "en-US",
  "en_US",
];

let _voiceCache: SpeechSynthesisVoice | null | undefined = undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (_voiceCache !== undefined) return _voiceCache;
  const voices = window.speechSynthesis.getVoices().filter(v =>
    v.lang.startsWith("en") || v.lang.startsWith("en-") || v.lang.startsWith("en_")
  );
  if (!voices.length) return null;

  for (const pattern of VOICE_PRIORITY_PATTERNS) {
    const match = voices.find(v => v.name.includes(pattern));
    if (match) { _voiceCache = match; return match; }
  }
  // Prefer online/network voices as they tend to be higher quality
  const onlineVoice = voices.find(v => !v.localService);
  if (onlineVoice) { _voiceCache = onlineVoice; return onlineVoice; }
  _voiceCache = voices[0] ?? null;
  return _voiceCache;
}

// Natural-sounding params — all close to baseline for clarity
function getVoiceParams(personality: string): { pitch: number; rate: number } {
  switch (personality) {
    case "machine":         return { pitch: 0.95, rate: 0.90 };
    case "grinder":         return { pitch: 1.02, rate: 1.00 };
    case "competitor":      return { pitch: 0.98, rate: 0.93 };
    case "comeback_kid":    return { pitch: 1.01, rate: 0.97 };
    case "underdog":        return { pitch: 1.03, rate: 1.00 };
    case "consistent":      return { pitch: 0.97, rate: 0.95 };
    case "weekend_warrior": return { pitch: 1.01, rate: 1.02 };
    default:                return { pitch: 1.0,  rate: 1.0  };
  }
}

function speakLine(text: string, personality: string): void {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);

  const voice = pickVoice();
  if (voice) utterance.voice = voice;

  const { pitch, rate } = getVoiceParams(personality);
  utterance.pitch = pitch;
  utterance.rate  = rate;
  utterance.volume = 0.95;

  utterance.onerror = () => { _voiceCache = undefined; };
  window.speechSynthesis.speak(utterance);
}

// Warm-up: load voice list on module import
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    _voiceCache = undefined;
  };
}

export function speakRivalGenerated(personality: string, name: string): void {
  if (!("speechSynthesis" in window)) return;
  const lines = TRASH_TALK[personality] ?? TRASH_TALK["competitor"]!;
  const line = lines[Math.floor(Math.random() * lines.length)]!;
  speakLine(line, personality);
}

export function speakWorkoutTaunt(reps: number, personality: string, rivalName: string): void {
  if (!("speechSynthesis" in window)) return;
  const lines = WORKOUT_TAUNTS[reps];
  if (!lines) return;
  const line = lines[Math.floor(Math.random() * lines.length)]!;
  speakLine(line, personality);
}
