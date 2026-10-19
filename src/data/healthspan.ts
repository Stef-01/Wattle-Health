// Healthspan query (Discover, 2026-10-18). A person types what they want more good years for; this
// reads it lexically (no model) into areas, and for each area says what a doctor would usually
// measure, what a consumer wearable can and can't tell you, and which Discover services fit.
// General information to take to a GP, not advice; wearable numbers are estimates.

export type Device = "none" | "oura" | "apple" | "whoop" | "garmin" | "cgm";
export const DEVICES: { id: Device; label: string }[] = [
  { id: "none", label: "No wearable" },
  { id: "apple", label: "Apple Watch" },
  { id: "oura", label: "Oura Ring" },
  { id: "whoop", label: "Whoop" },
  { id: "garmin", label: "Garmin" },
  { id: "cgm", label: "Glucose monitor (CGM)" },
];

export type Area = {
  id: string;
  title: string;
  why: string;
  cues: RegExp;
  measure: string[];
  wearable: Partial<Record<Device, string>>;
  categories: ("biomarkers" | "wearables" | "menopause")[];
};

export const AREAS: Area[] = [
  {
    id: "heart",
    title: "Heart and arteries",
    why: "Heart disease is the leading cause of death in Australia, and most of its risk can be measured years ahead.",
    cues: /heart|cholesterol|blood pressure|cardio|stroke|artery|arteries|family history/i,
    measure: ["Blood pressure", "Lipids including ApoB", "Lipoprotein(a), once in a lifetime", "HbA1c"],
    wearable: { apple: "Resting heart rate, heart rate variability, irregular rhythm alerts", oura: "Resting heart rate and HRV trends overnight", whoop: "Resting heart rate and HRV each morning", garmin: "Resting heart rate, HRV status" },
    categories: ["biomarkers"],
  },
  {
    id: "fitness",
    title: "Fitness and VO2 max",
    why: "Cardiorespiratory fitness is one of the strongest predictors of how long and how well people live.",
    cues: /fit|fitness|vo2|run|running|hike|hiking|energy|stamina|exercise|active|play with|grandkids|keep up/i,
    measure: ["VO2 max, estimated or tested on a treadmill or bike", "Grip strength", "Resting heart rate"],
    wearable: { apple: "Cardio Fitness (a VO2 max estimate) from outdoor walks and runs", garmin: "VO2 max estimate from runs and rides", oura: "Cardio Capacity (a VO2 max estimate)", whoop: "Strain and recovery; no VO2 max estimate" },
    categories: ["biomarkers", "wearables"],
  },
  {
    id: "metabolic",
    title: "Blood sugar and metabolism",
    why: "Insulin resistance builds quietly for years before diabetes, and responds well to early change.",
    cues: /sugar|glucose|diabetes|insulin|weight|metabolic|metabolism|belly|waist|energy crash/i,
    measure: ["HbA1c and fasting glucose", "Fasting insulin", "Triglycerides", "Waist measurement"],
    wearable: { cgm: "Glucose after meals and overnight, the most direct signal here", apple: "Activity and step trends only" },
    categories: ["biomarkers", "wearables"],
  },
  {
    id: "sleep",
    title: "Sleep",
    why: "Short or broken sleep raises the risk of heart disease, diabetes and low mood, and snoring can be a sign of sleep apnoea.",
    cues: /sleep|tired|fatigue|snor|insomnia|wake|rest|apnoea|apnea/i,
    measure: ["A sleep history with your GP", "A home sleep study if snoring or daytime sleepiness"],
    wearable: { oura: "Sleep timing, regularity and stage estimates", apple: "Sleep stages and possible sleep apnoea notifications", whoop: "Sleep performance and consistency", garmin: "Sleep score and breathing variations" },
    categories: ["wearables"],
  },
  {
    id: "brain",
    title: "Memory and thinking",
    why: "Several risks for later-life dementia can be changed, including blood pressure, hearing, inactivity and diabetes.",
    cues: /brain|memory|dementia|alzheimer|cognit|sharp|focus|thinking/i,
    measure: ["Blood pressure", "HbA1c", "A hearing check", "Mood and sleep"],
    wearable: { apple: "Activity, sleep and noise exposure", oura: "Sleep regularity", garmin: "Activity and sleep" },
    categories: ["biomarkers"],
  },
  {
    id: "hormones",
    title: "Perimenopause and hormones",
    why: "Perimenopause can start in the early 40s. Over 45 it's usually diagnosed from symptoms, and treatment choices are best made with a doctor.",
    cues: /menopaus|perimenopaus|hormone|hot flush|flushes|period|cycle|hrt|mht/i,
    measure: ["Your symptoms over time", "Blood pressure and lipids", "Bone density if you have risk factors"],
    wearable: { oura: "Skin temperature trends and cycle insights", apple: "Cycle tracking with temperature on recent models", whoop: "Cycle and recovery trends" },
    categories: ["menopause"],
  },
  {
    id: "strength",
    title: "Muscle and bones",
    why: "Muscle and bone are lost from midlife; strength and balance keep people independent later on.",
    cues: /muscle|strength|strong|bone|osteopor|fall|balance|mobility|independent|lift/i,
    measure: ["Grip strength and a sit-to-stand test", "Bone density (DEXA) if you have risk factors", "Vitamin D if at risk"],
    wearable: { garmin: "Strength workouts logged", apple: "Walking steadiness on iPhone", whoop: "Strength trainer workouts" },
    categories: ["biomarkers", "menopause"],
  },
];

export const EXAMPLES = ["Keep up with my kids and stay fit into my 70s", "My dad had a heart attack at 55", "Sleep better and stop crashing in the afternoon", "Get ahead of perimenopause"];

/** Areas the sentence mentions, in AREAS order. A vague sentence ("live longer") gets heart, fitness and metabolism. */
export function readHealthspan(text: string): Area[] {
  const hit = AREAS.filter((a) => a.cues.test(text));
  return hit.length ? hit : AREAS.filter((a) => ["heart", "fitness", "metabolic"].includes(a.id));
}
