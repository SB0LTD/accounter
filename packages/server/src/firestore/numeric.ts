/**
 * Postgres `numeric` arithmetic on decimal strings.
 *
 * `pg` hands `numeric` (and `bigint`) columns to the server as strings, and the queries do money math
 * on them in SQL: SUM, ABS, ROUND, `amount * rate`, `a / b`. The ported queries must produce the same
 * strings, digit for digit, so this follows Postgres's rules for the result's display scale:
 *
 * - add, subtract: the larger of the two scales
 * - multiply: the sum of the scales
 * - divide: `select_div_scale` (at least 16 significant digits, never fewer decimals than an input)
 * - round(x, n): half away from zero, scale n
 *
 * Values are an unscaled bigint plus a scale, so nothing goes through binary floating point.
 */

export class Numeric {
  private constructor(
    /** The value times 10^scale. */
    readonly unscaled: bigint,
    /** Digits after the decimal point, as Postgres displays them. */
    readonly scale: number,
  ) {}

  static readonly ZERO = new Numeric(0n, 0);

  static of(value: NumericInput): Numeric {
    if (value instanceof Numeric) return value;
    if (typeof value === 'bigint') return new Numeric(value, 0);
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new RangeError(`Cannot convert ${value} to numeric`);
      return Number.isInteger(value) ? new Numeric(BigInt(value), 0) : Numeric.fromFloat8(value);
    }
    return Numeric.parse(value);
  }

  static parse(text: string): Numeric {
    const trimmed = text.trim();
    const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(trimmed);
    if (!match || (match[2] === '' && (match[3] ?? '') === '')) {
      throw new SyntaxError(`invalid input syntax for type numeric: "${text}"`);
    }
    const [, sign, intPart, fracPart = '', exponent] = match;
    let digits = (intPart || '0') + fracPart;
    let scale = fracPart.length;
    if (exponent) {
      scale -= Number(exponent);
      if (scale < 0) {
        digits += '0'.repeat(-scale);
        scale = 0;
      }
    }
    const unscaled = BigInt(digits);
    return new Numeric(sign === '-' ? -unscaled : unscaled, scale);
  }

  /**
   * float8 → numeric the way Postgres casts it: 15 significant digits (`DBL_DIG`), then the shortest
   * decimal that keeps them.
   */
  static fromFloat8(value: number): Numeric {
    return Numeric.parse(normalizeExponent(value.toPrecision(15)));
  }

  withScale(scale: number): Numeric {
    if (scale === this.scale) return this;
    if (scale > this.scale) {
      return new Numeric(this.unscaled * 10n ** BigInt(scale - this.scale), scale);
    }
    return new Numeric(divRound(this.unscaled, 10n ** BigInt(this.scale - scale)), scale);
  }

  add(other: NumericInput): Numeric {
    const b = Numeric.of(other);
    const scale = Math.max(this.scale, b.scale);
    return new Numeric(this.withScale(scale).unscaled + b.withScale(scale).unscaled, scale);
  }

  sub(other: NumericInput): Numeric {
    return this.add(Numeric.of(other).neg());
  }

  mul(other: NumericInput): Numeric {
    const b = Numeric.of(other);
    return new Numeric(this.unscaled * b.unscaled, this.scale + b.scale);
  }

  /** Division with Postgres's result scale. Throws on division by zero, as Postgres does. */
  div(other: NumericInput): Numeric {
    const b = Numeric.of(other);
    if (b.unscaled === 0n) throw new RangeError('division by zero');
    return this.divToScale(b, selectDivScale(this, b));
  }

  /** Division rounded (half away from zero) to an explicit scale. */
  divToScale(other: NumericInput, scale: number): Numeric {
    const b = Numeric.of(other);
    if (b.unscaled === 0n) throw new RangeError('division by zero');
    // this / b = (ua / 10^sa) / (ub / 10^sb); scaled by 10^scale:
    // ua * 10^(scale + sb - sa) / ub
    const shift = scale + b.scale - this.scale;
    let numerator = this.unscaled;
    let denominator = b.unscaled;
    if (shift >= 0) numerator *= 10n ** BigInt(shift);
    else denominator *= 10n ** BigInt(-shift);
    return new Numeric(divRound(numerator, denominator), scale);
  }

  neg(): Numeric {
    return new Numeric(-this.unscaled, this.scale);
  }

  abs(): Numeric {
    return this.unscaled < 0n ? this.neg() : this;
  }

  /** `round(x, n)`: half away from zero. A negative `n` rounds left of the point, scale 0. */
  round(places = 0): Numeric {
    if (places >= 0) return this.withScale(places);
    const factor = 10n ** BigInt(this.scale - places);
    return new Numeric(divRound(this.unscaled, factor) * 10n ** BigInt(-places), 0);
  }

  /** `trunc(x, n)`: toward zero. */
  trunc(places = 0): Numeric {
    if (places >= this.scale) return this.withScale(places);
    const factor = 10n ** BigInt(this.scale - Math.max(places, 0));
    const truncated = new Numeric(this.unscaled / factor, Math.max(places, 0));
    return places >= 0 ? truncated : truncated.round(places);
  }

  /** `floor(x)`, `ceil(x)`: scale 0, as Postgres returns them. */
  floor(): Numeric {
    const factor = 10n ** BigInt(this.scale);
    let q = this.unscaled / factor;
    if (this.unscaled < 0n && q * factor !== this.unscaled) q -= 1n;
    return new Numeric(q, 0);
  }

  ceil(): Numeric {
    return this.neg().floor().neg();
  }

  sign(): -1 | 0 | 1 {
    return this.unscaled === 0n ? 0 : this.unscaled < 0n ? -1 : 1;
  }

  isZero(): boolean {
    return this.unscaled === 0n;
  }

  cmp(other: NumericInput): -1 | 0 | 1 {
    const b = Numeric.of(other);
    const scale = Math.max(this.scale, b.scale);
    const x = this.withScale(scale).unscaled;
    const y = b.withScale(scale).unscaled;
    return x === y ? 0 : x < y ? -1 : 1;
  }

  eq(other: NumericInput): boolean {
    return this.cmp(other) === 0;
  }

  lt(other: NumericInput): boolean {
    return this.cmp(other) < 0;
  }

  gt(other: NumericInput): boolean {
    return this.cmp(other) > 0;
  }

  /** `numeric::float8` */
  toNumber(): number {
    return Number(this.toString());
  }

  /** Postgres's text output: exactly `scale` digits after the point, no exponent. */
  toString(): string {
    const negative = this.unscaled < 0n;
    const digits = (negative ? -this.unscaled : this.unscaled).toString();
    if (this.scale === 0) return (negative ? '-' : '') + digits;
    const padded = digits.padStart(this.scale + 1, '0');
    const intPart = padded.slice(0, padded.length - this.scale);
    const fracPart = padded.slice(padded.length - this.scale);
    return `${negative ? '-' : ''}${intPart}.${fracPart}`;
  }

  /** A canonical form for equality keys: `1.50` and `1.5` are the same value. */
  key(): string {
    let { unscaled, scale } = this;
    while (scale > 0 && unscaled % 10n === 0n) {
      unscaled /= 10n;
      scale--;
    }
    return new Numeric(unscaled, scale).toString();
  }

  toJSON(): string {
    return this.toString();
  }
}

export type NumericInput = Numeric | string | number | bigint;

/** Round half away from zero. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) return quotient;
  const twice = (remainder < 0n ? -remainder : remainder) * 2n;
  if (twice >= denominator) return numerator < 0n ? quotient - 1n : quotient + 1n;
  return quotient;
}

const NUMERIC_MIN_SIG_DIGITS = 16;
const NUMERIC_MAX_DISPLAY_SCALE = 1000;
const DEC_DIGITS = 4;

/** Weight and first digit of a value in Postgres's base-10000 representation. */
function baseTenThousand(value: Numeric): { weight: number; firstDigit: number } {
  const abs = value.unscaled < 0n ? -value.unscaled : value.unscaled;
  if (abs === 0n) return { weight: 0, firstDigit: 0 };
  // Align the digit string to 4-digit groups around the decimal point.
  const digits = abs.toString();
  const intLen = digits.length - value.scale;
  // Groups to the left of the point (may be <= 0 when |value| < 1).
  const intGroups = Math.ceil(intLen / DEC_DIGITS);
  const leftPad = intGroups * DEC_DIGITS - intLen;
  const fracLen = value.scale;
  const rightPad = (DEC_DIGITS - (fracLen % DEC_DIGITS)) % DEC_DIGITS;
  const aligned = '0'.repeat(Math.max(leftPad, 0)) + digits + '0'.repeat(rightPad);
  // When intLen is negative the leading zero groups are implied by `intGroups`.
  const startWeight = intGroups - 1;
  for (let i = 0; i * DEC_DIGITS < aligned.length; i++) {
    const group = Number(aligned.slice(i * DEC_DIGITS, (i + 1) * DEC_DIGITS));
    if (group !== 0) return { weight: startWeight - i, firstDigit: group };
  }
  return { weight: 0, firstDigit: 0 };
}

/** Postgres's `select_div_scale` (numeric.c). */
export function selectDivScale(dividend: Numeric, divisor: Numeric): number {
  const a = baseTenThousand(dividend);
  const b = baseTenThousand(divisor);
  let qweight = a.weight - b.weight;
  if (a.firstDigit <= b.firstDigit) qweight--;
  let rscale = NUMERIC_MIN_SIG_DIGITS - qweight * DEC_DIGITS;
  rscale = Math.max(rscale, dividend.scale, divisor.scale, 0);
  return Math.min(rscale, NUMERIC_MAX_DISPLAY_SCALE);
}

function normalizeExponent(text: string): string {
  // toPrecision may return "1.23456789012345e+21"; Numeric.parse handles the exponent, but trailing
  // zeros in the mantissa are not significant for a float8 cast, so strip them first.
  const [mantissa, exponent] = text.split('e');
  const trimmed = mantissa!.includes('.') ? mantissa!.replace(/\.?0+$/, '') : mantissa!;
  return exponent ? `${trimmed}e${exponent}` : trimmed;
}

/** Shorthand for `Numeric.of`. */
export const num = (value: NumericInput): Numeric => Numeric.of(value);

/** `SUM(numeric)`: null for no non-null inputs, as in SQL. */
export function sumNumeric(values: Iterable<NumericInput | null | undefined>): Numeric | null {
  let total: Numeric | null = null;
  for (const value of values) {
    if (value == null) continue;
    total = total ? total.add(value) : Numeric.of(value);
  }
  return total;
}

/** `AVG(numeric)` */
export function avgNumeric(values: Iterable<NumericInput | null | undefined>): Numeric | null {
  let total: Numeric | null = null;
  let count = 0n;
  for (const value of values) {
    if (value == null) continue;
    total = total ? total.add(value) : Numeric.of(value);
    count++;
  }
  return total ? total.div(Numeric.of(count)) : null;
}
