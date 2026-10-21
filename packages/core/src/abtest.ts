// KEY FILE: the A/B test.
//
// The question: version A converted 100 of 1,000 people (10%) and version B converted 120 of 1,000
// (12%). Is B really better, or could a gap that size happen by pure luck?
//
// The method (a two-proportion z-test):
//   1. Pretend there is no difference. Then every person, in A or B, converts with the same chance:
//      the pooled rate = all conversions / all people.
//   2. With that chance, the gap between two groups of this size would wobble by a typical amount,
//      the standard error.
//   3. z = (rate B - rate A) / standard error: how many "typical wobbles" the real gap is.
//   4. The p-value is how often luck alone gives a gap at least that big, in either direction:
//      p = 2 x (1 - normalCdf(|z|)).
//
// A small p (under 0.05) means luck is an unlikely explanation. It does NOT say how big or how
// important the difference is, and it is not the chance that B is better.

export type Group = { visitors: number; conversions: number };

export type Comparison = {
  rateA: number;
  rateB: number;
  /** rate B minus rate A, as a fraction (0.02 means 2 percentage points) */
  difference: number;
  z: number;
  pValue: number;
};

export type Verdict =
  | { kind: "no_data" }
  | { kind: "small_sample" }
  | { kind: "different"; better: "A" | "B" }
  | { kind: "not_enough_evidence" };

/** The area under the standard bell curve to the left of z: 0.5 at 0, about 0.975 at 1.96. */
export function normalCdf(z: number): number {
  // Complementary error function, Chebyshev fit (absolute error under 1.2e-7).
  const erfc = (x: number): number => {
    const t = 1 / (1 + 0.5 * Math.abs(x));
    const poly =
      -x * x -
      1.26551223 +
      t *
        (1.00002368 +
          t *
            (0.37409196 +
              t *
                (0.09678418 +
                  t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))));
    const r = t * Math.exp(poly);
    return x >= 0 ? r : 2 - r;
  };
  return 0.5 * erfc(-z / Math.SQRT2);
}

/** Compares two groups. Counts are clamped so conversions never exceed visitors. */
export function compareProportions(a: Group, b: Group): Comparison {
  const va = Math.max(0, Math.floor(a.visitors));
  const vb = Math.max(0, Math.floor(b.visitors));
  const ca = Math.min(Math.max(0, Math.floor(a.conversions)), va);
  const cb = Math.min(Math.max(0, Math.floor(b.conversions)), vb);

  const rateA = va === 0 ? 0 : ca / va;
  const rateB = vb === 0 ? 0 : cb / vb;
  const difference = rateB - rateA;

  if (va === 0 || vb === 0) return { rateA, rateB, difference, z: 0, pValue: 1 };

  const pooled = (ca + cb) / (va + vb);
  const standardError = Math.sqrt(pooled * (1 - pooled) * (1 / va + 1 / vb));
  // Everyone converted, or nobody did: there is nothing to compare, so no evidence of a difference.
  if (standardError === 0) return { rateA, rateB, difference, z: 0, pValue: 1 };

  const z = difference / standardError;
  const pValue = Math.min(1, 2 * (1 - normalCdf(Math.abs(z))));
  return { rateA, rateB, difference, z, pValue };
}

/** The plain-English call. Never says "B wins" unless p is under 0.05 and the sample is big enough. */
export function abVerdict(a: Group, b: Group): Verdict {
  if (a.visitors <= 0 || b.visitors <= 0) return { kind: "no_data" };

  // The z-test leans on a bell-curve approximation that is only trustworthy when each group has
  // at least 5 people who did the thing and at least 5 who did not.
  const clamp = (g: Group) => Math.min(Math.max(0, Math.floor(g.conversions)), Math.floor(g.visitors));
  const small = [a, b].some((g) => Math.min(clamp(g), Math.floor(g.visitors) - clamp(g)) < 5);
  if (small) return { kind: "small_sample" };

  const { pValue, difference } = compareProportions(a, b);
  if (pValue < 0.05 && difference !== 0) return { kind: "different", better: difference > 0 ? "B" : "A" };
  return { kind: "not_enough_evidence" };
}
