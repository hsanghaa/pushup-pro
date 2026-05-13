import { Router, type IRouter } from "express";

const router: IRouter = Router();

const VARIATIONS = [
  // Beginner
  {
    id: "wall_pushup",
    name: "Wall Push-Up",
    level: "beginner",
    description: "Stand arm's length from a wall, place hands at shoulder height, and push in and out. Great for building foundational strength.",
    musclesWorked: "Chest, shoulders, triceps",
    suggestedReps: "3 sets of 10-15 reps",
    safetyNote: "Keep your body straight. Don't arch your back.",
  },
  {
    id: "incline_pushup",
    name: "Incline Push-Up",
    level: "beginner",
    description: "Hands elevated on a bench or table. A step up from wall push-ups that builds toward floor push-ups.",
    musclesWorked: "Chest, shoulders, triceps, core",
    suggestedReps: "3 sets of 8-12 reps",
    safetyNote: "Ensure your surface is stable before starting.",
  },
  {
    id: "knee_pushup",
    name: "Knee Push-Up",
    level: "beginner",
    description: "Standard push-up position with knees on the floor. Reduces bodyweight load while building strength.",
    musclesWorked: "Chest, shoulders, triceps",
    suggestedReps: "3 sets of 10-15 reps",
    safetyNote: "Keep hips aligned — don't let them drop or rise.",
  },
  {
    id: "pushup_negative",
    name: "Push-Up Negative",
    level: "beginner",
    description: "Slow lowering phase from the top position. Builds eccentric strength that carries into full push-ups.",
    musclesWorked: "Chest, shoulders, triceps, core",
    suggestedReps: "3 sets of 5-8 reps (3-5 seconds down)",
    safetyNote: "Lower slowly and controlled. Don't collapse to the floor.",
  },
  // Intermediate
  {
    id: "standard_pushup",
    name: "Standard Push-Up",
    level: "intermediate",
    description: "The classic. Full body on the floor, hands shoulder-width, full range of motion from top to chest near floor.",
    musclesWorked: "Chest, shoulders, triceps, core",
    suggestedReps: "3-4 sets of 15-20 reps",
    safetyNote: "Keep your body rigid. Don't let your hips sag.",
  },
  {
    id: "wide_grip_pushup",
    name: "Wide-Grip Push-Up",
    level: "intermediate",
    description: "Hands placed wider than shoulder-width. Shifts emphasis to the outer chest and front deltoids.",
    musclesWorked: "Outer chest, front deltoids, triceps",
    suggestedReps: "3 sets of 12-15 reps",
    safetyNote: "Avoid flaring elbows too wide — keep a slight bend inward.",
  },
  {
    id: "close_grip_pushup",
    name: "Close-Grip Push-Up",
    level: "intermediate",
    description: "Hands closer than shoulder-width. Greater tricep activation and inner chest engagement.",
    musclesWorked: "Triceps, inner chest, shoulders",
    suggestedReps: "3 sets of 10-15 reps",
    safetyNote: "Keep elbows close to your body throughout the movement.",
  },
  {
    id: "tempo_pushup",
    name: "Tempo Push-Up",
    level: "intermediate",
    description: "Controlled tempo (3 seconds down, 1 second hold, 2 seconds up) maximizes time under tension.",
    musclesWorked: "Chest, shoulders, triceps, core",
    suggestedReps: "3 sets of 8-10 reps",
    safetyNote: "Never rush the movement. Control every inch.",
  },
  {
    id: "pause_pushup",
    name: "Pause Push-Up",
    level: "intermediate",
    description: "Hold at the bottom position for 2-3 seconds before pressing up. Eliminates momentum and builds raw strength.",
    musclesWorked: "Chest, shoulders, triceps",
    suggestedReps: "3 sets of 8-12 reps",
    safetyNote: "Maintain tension at the bottom. Don't rest your chest on the floor.",
  },
  // Advanced
  {
    id: "diamond_pushup",
    name: "Diamond Push-Up",
    level: "advanced",
    description: "Hands form a diamond shape under your chest. One of the best tricep isolation moves in bodyweight training.",
    musclesWorked: "Triceps, inner chest, shoulders",
    suggestedReps: "3 sets of 10-15 reps",
    safetyNote: "Wrist discomfort is common — adjust hand angle as needed.",
  },
  {
    id: "decline_pushup",
    name: "Decline Push-Up",
    level: "advanced",
    description: "Feet elevated on a chair or bench. Shifts load to upper chest and front deltoids. Harder than it looks.",
    musclesWorked: "Upper chest, front deltoids, triceps",
    suggestedReps: "3 sets of 10-15 reps",
    safetyNote: "Ensure your feet are stable. Keep your core tight.",
  },
  {
    id: "archer_pushup",
    name: "Archer Push-Up",
    level: "advanced",
    description: "One arm bends while the other stays straight as you push to each side. A progression toward one-arm push-ups.",
    musclesWorked: "Chest, triceps, shoulders (unilateral focus)",
    suggestedReps: "3 sets of 5-8 reps per side",
    safetyNote: "Move slowly and maintain control throughout.",
  },
  {
    id: "explosive_pushup",
    name: "Explosive Push-Up",
    level: "advanced",
    description: "Push with enough force to lift hands off the floor at the top. Develops power and fast-twitch muscle.",
    musclesWorked: "Chest, shoulders, triceps, core",
    suggestedReps: "3 sets of 5-8 reps",
    safetyNote: "Land softly. Stop if wrists or shoulders feel stressed.",
  },
  {
    id: "pike_pushup",
    name: "Pike Push-Up",
    level: "advanced",
    description: "Hips high in an inverted V. Targets the shoulders heavily — a stepping stone to handstand push-ups.",
    musclesWorked: "Shoulders, triceps, upper chest",
    suggestedReps: "3 sets of 8-12 reps",
    safetyNote: "Keep your neck neutral. Don't shrug your shoulders.",
  },
  // Athlete
  {
    id: "plyometric_pushup",
    name: "Plyometric Push-Up",
    level: "athlete",
    description: "Maximum explosive push to full arm extension off the floor. Pure power development.",
    musclesWorked: "Chest, shoulders, triceps, core",
    suggestedReps: "3 sets of 5-6 reps",
    safetyNote: "Only attempt when fully warmed up. Prioritize quality over quantity.",
  },
  {
    id: "clap_pushup",
    name: "Clap Push-Up",
    level: "athlete",
    description: "Explode up and clap hands at the top before landing. A classic power test.",
    musclesWorked: "Chest, shoulders, triceps",
    suggestedReps: "3 sets of 4-6 reps",
    safetyNote: "Land with bent elbows to absorb impact. Stop if form breaks.",
  },
  {
    id: "one_arm_progression",
    name: "One-Arm Progression",
    level: "athlete",
    description: "Progressive work toward a full one-arm push-up. Use archer push-ups and elevated one-arm negatives to build.",
    musclesWorked: "Full chest, triceps, shoulders, core (unilateral)",
    suggestedReps: "3 sets of 3-5 reps per side (or progressions)",
    safetyNote: "This takes months to develop. Don't rush it.",
  },
  {
    id: "deficit_pushup",
    name: "Deficit Push-Up",
    level: "athlete",
    description: "Hands on elevated platforms (books, blocks) allows greater depth below floor level. Maximum chest stretch.",
    musclesWorked: "Chest, shoulders, triceps (extended range)",
    suggestedReps: "3 sets of 8-12 reps",
    safetyNote: "Increase depth gradually. Shoulder health first.",
  },
  {
    id: "weighted_pushup",
    name: "Weighted Backpack Push-Up",
    level: "athlete",
    description: "Standard push-up with a loaded backpack on your back. Progressive overload in bodyweight training.",
    musclesWorked: "Chest, shoulders, triceps, core",
    suggestedReps: "3 sets of 8-12 reps",
    safetyNote: "Start light. Make sure the backpack is secure before starting.",
  },
];

router.get("/variations", async (req, res): Promise<void> => {
  const level = req.query.level as string | undefined;

  const filtered = level
    ? VARIATIONS.filter(v => v.level === level)
    : VARIATIONS;

  res.json(filtered);
});

export default router;
