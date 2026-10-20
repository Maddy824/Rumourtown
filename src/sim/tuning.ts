// All behavioral weights and timing live here. These are illustrative, not fitted.
export const TUNING = {
  ticks: 120, minutesPerTick: 6, startHour: 8,
  takeTick: 4, deliveryTick: 8, returnTick: 12, squareTick: 22,
  morningEnd: 14, breakfastEnd: 6, middayEnd: 60, eveningStart: 90,
  hearsayStrength: 1.238, firsthandMultiplier: 3,
  familiarityCap: 0.4, familiarityRate: 0.15,
  motivatedDiscount: 0.3, motivatedBoost: 0.3,
  correctionTrust: 0.45, correctionMin: 0.5, correctionMax: 0.9,
  memoryHops: 3, logOddsLimit: 8,
  gossipThreshold: 0.55, confrontThreshold: 0.62, reconcileThreshold: 0.6,
  closeAffinity: 0.35, harmAffinity: 0.65, defenseAffinity: 0.12,
  cooldown: 9, responseExpiry: 4,
  routineScore: 0.2, gossipScore: 0.4, angerScore: 1.8,
  confrontScore: 1.5, defenseScore: 2.8, explanationScore: 2.4,
  reconcileScore: 2, evidenceScore: 0.8,
  neutralTrust: 0.5, strangerTrust: { mira: 0.6, tom: 0.4, ben: 0.2 },
  initialTrust: {
    mira: { mira: 1, tom: 0.6, ben: 0.5 },
    tom: { mira: 0.6, tom: 1, ben: 0.85 },
    ben: { mira: 0.5, tom: 0.95, ben: 1 },
  },
  initialAffinity: {
    mira: { mira: 1, tom: 0.15, ben: 0 },
    tom: { mira: 0.3, tom: 1, ben: 0.8 },
    ben: { mira: 0, tom: 0.9, ben: 1 },
  },
} as const;
