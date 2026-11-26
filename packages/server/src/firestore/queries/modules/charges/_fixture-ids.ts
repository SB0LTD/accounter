/**
 * Ids from scripts/firestore/fixtures/070-charges-ledger.sql (and the demo seed), for the cases of
 * the charges / ledger / transactions / bank-deposits / manual-automations ports.
 */
const id = (n: number) => `0f070000-0000-4000-8000-${n.toString().padStart(12, '0')}`;

export const FX = {
  // businesses
  globex: id(101),
  initech: id(102),
  acmeConsulting: '87916ff6-a3f1-5d39-b6e0-7b5d7e155426',
  acmeRetail: '51955ea0-2d3d-5393-bd8f-e537dbd6f5f2',
  // tax categories (financial entities)
  consulting: 'c389e2a2-b2bf-5d6c-87d1-6eca9fc5e3ed',
  inputVat: '7f290789-5c1a-5aa1-81e8-927039f89fa0',
  serviceIncome: 'f6d03f4c-1529-5050-86b6-c3bb12b4e65e',
  incomeFx: '0284cd22-b9af-5fde-930e-045799fd842c',
  revaluation: 'ea82e666-35ce-5ad6-a231-ec8ffab0251f',
  dividend: '8fd191a4-a654-5627-89f8-f7dea9b31b95',
  // accounts
  bank1: '01a217ef-ee3d-7bfd-afab-07ad7db14c77',
  bank2: '01a217ef-eea1-7b96-a93d-b9cf2f56cfb9',
  cc1: id(201),
  cc2: id(202),
  depositAccount: id(203),
  bank3: id(204),
  // charges
  officeSupplies: id(301),
  retainer: id(302),
  hardware: id(303),
  stockDistribution: id(304),
  emptyCharge: id(305),
  visaDebit: id(306),
  cardPurchases: id(307),
  maxDebit: id(308),
  wireFee: id(309),
  wireAbroad: id(310),
  securitiesBuy: id(311),
  securitiesSettle: id(312),
  deposit2024: id(313),
  depositClose: id(314),
  oldDepositFees: id(315),
  revaluation2023: id(316),
  revaluation2024: id(317),
  deleteMeToo: id(318),
  demoJanuary: '4481df29-1a91-532b-a68d-20471594df24',
  demoNovemberRefund: '18064efe-c5d5-5bc9-8c38-dc4d2d5af984',
  // transactions
  tx: (n: number) => id(500 + n),
  demoTransaction: '9fcb19c1-abde-5c37-b2a8-1b0eb7831aeb',
  // documents
  doc: (n: number) => id(600 + n),
  // ledger records
  ledger: (n: number) => id(700 + n),
  // bank deposits
  deposit1: id(801),
  oldDeposit: id(802),
  emptyDeposit: id(803),
  // business trip
  trip: id(901),
  // tags (000-base)
  tagOperations: '0f0f0000-0000-4000-8000-000000000001',
  tagCloud: '0f0f0000-0000-4000-8000-000000000002',
  tagGpu: '0f0f0000-0000-4000-8000-000000000003',
  tagMarketing: '0f0f0000-0000-4000-8000-000000000004',
  tagEvents: '0f0f0000-0000-4000-8000-000000000005',
} as const;
