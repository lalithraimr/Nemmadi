const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function normalizeLinear(value, inMin, inMax) {
  if (value <= inMin) return 0;
  if (value >= inMax) return 100;
  return ((value - inMin) / (inMax - inMin)) * 100;
}

function computeFocusScore(game1) {
  const errorRisk = clamp((game1.mean_error_rate || 0) * 100, 0, 100);
  const rtRisk = normalizeLinear(game1.median_rt_ms || 400, 300, 1500);
  const rtVarRisk = normalizeLinear(game1.rt_sd_ms || 0, 0, 600);
  const dropoffRisk = clamp((game1.dropoff_rate || 0) * 100, 0, 100);
  const score = errorRisk*0.45 + rtRisk*0.30 + rtVarRisk*0.15 + dropoffRisk*0.10;
  return clamp(Math.round(score), 0, 100);
}

function computeEmotionScore(game2) {
  const negativeCorrect = game2.negative_correct_rate || 0;
  const positiveCorrect = game2.positive_correct_rate || 0;
  const negativeBiasPP = (negativeCorrect - positiveCorrect) * 100;
  const negRisk = clamp(negativeBiasPP * 2, 0, 100);
  const avoidanceRisk = clamp(game2.avoidance_index || 0, 0, 100);
  const score = negRisk*0.6 + avoidanceRisk*0.4;
  return clamp(Math.round(score), 0, 100);
}

function computeMoodScore(phq4, pss4, burnout) {
  const moodRisk = (phq4 / 12) * 100;
  const stressRisk = (pss4 / 16) * 100;
  const burnoutRisk = (burnout / 4) * 100;
  const score = moodRisk*0.5 + stressRisk*0.35 + burnoutRisk*0.15;
  return clamp(Math.round(score), 0, 100);
}

function computeStressScore(moodScore, focusScore, emotionScore) {
  const score = moodScore*0.5 + focusScore*0.2 + emotionScore*0.3;
  return clamp(Math.round(score), 0, 100);
}

function computeWellnessScore(S_stress, S_mood, S_focus, S_emotion) {
  const riskIndex = S_stress*0.30 + S_mood*0.30 + S_focus*0.25 + S_emotion*0.15;
  return Math.round(clamp(100 - riskIndex, 0, 100));
}

function decideTier(params) {
  const { emergencyFlag, phq4_total, wellnessScore, S_focus, S_mood, S_emotion } = params;
  if (emergencyFlag) return 3;
  if (phq4_total >= 9) return 3;
  const highPillars = [S_focus, S_mood, S_emotion].filter(x => x > 70).length;
  if (wellnessScore < 30 && highPillars >= 2) return 3;
  if (phq4_total >= 6 && phq4_total <= 8) return 2;
  if (wellnessScore >= 75 && phq4_total <= 5 && S_focus <= 40 && S_emotion <= 40) return 1;
  return 2;
}

// Callable function: client calls with raw data and function returns computed result and writes screening_results doc
exports.scoreAndSave = functions.https.onCall(async (data, context) => {
  const uid = (context.auth && context.auth.uid) || null;

  const {
    phq4_total = 0,
    pss4_total = 0,
    burnout = 0,
    game1 = {},
    game2 = {},
    emergency_flag = false,
    userProfile = {}
  } = data;

  const S_focus = computeFocusScore(game1);
  const S_emotion = computeEmotionScore(game2);
  const S_mood = computeMoodScore(phq4_total, pss4_total, burnout);
  const S_stress = computeStressScore(S_mood, S_focus, S_emotion);
  const wellnessScore = computeWellnessScore(S_stress, S_mood, S_focus, S_emotion);
  const tier = decideTier({ emergencyFlag: emergency_flag, phq4_total, wellnessScore, S_focus, S_mood, S_emotion });

  const doc = {
    userId: uid ? `auth:${uid}` : null,
    createdAt: new Date().toISOString(),
    phq4_total,
    pss4_total,
    burnout,
    game1,
    game2,
    subscores: {
      stress: S_stress,
      mood: S_mood,
      focus: S_focus,
      emotion: S_emotion
    },
    wellnessScore,
    tier,
    emergency_flag
  };

  const db = admin.firestore();
  const ref = await db.collection('screening_results').add(doc);

  return { id: ref.id, doc };
});
