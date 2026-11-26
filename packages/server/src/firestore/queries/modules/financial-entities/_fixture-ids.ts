/** Ids of the rows in scripts/firestore/fixtures/020-financial-entities.sql, for cases. */
const id = (n: number) => `0f020000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const FX = {
  /** business, sort code 100, matched to TC_ALPHA, client (braced upper-case green-invoice id), owns FA */
  alpha: id(1),
  /** business, sort code 200, inactive, USA, matched to TC_ALPHA, client with array integrations */
  beta: id(2),
  /** business, GBR, unreferenced (deletable), recognition email Exact@Gamma.example */
  gamma: id(3),
  /** business, client (green-invoice id 41), matched to TC_BETA */
  delta: id(4),
  /** business with wildcard recognition emails, client with NULL integrations */
  epsilon: id(5),
  /** business, the replace target */
  zeta: id(6),
  /** business referenced by ledger, misc expenses, dividends, a pension fund, a client, ... */
  eta: id(7),
  /** financial entity without a businesses row */
  theta: id(8),
  /** business with a businesses_admin row owned by the tenant */
  iota: id(9),
  tcAlpha: id(11),
  tcBeta: id(12),
  /** unreferenced tax category (deletable) */
  tcGamma: id(13),
  tcDelta: id(14),
  ledgerSelf: id(21),
  ledgerSecond: id(22),
  ledgerOther: id(23),
  miscSelf: id(31),
  miscDebtor: id(32),
  miscCreditor: id(33),
  greenDelta: id(41),
  greenAlpha: id(42),
  greenEta: id(43),
  greenEpsilon: id(44),
  greenBeta: id(45),
  account: id(61),
  /** an id in the fixture range that no row has */
  unused: id(999),
};
