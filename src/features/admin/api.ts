// Transitional adapter: Stage 19 moves these operations to role-protected Fastify endpoints.
export {
  adminListAuditLog,
  adminListLists,
  adminListMerchants,
  adminListReports,
  adminListUsers,
  adminModerate,
  adminSaveMerchant,
  adminTestAffiliateLink,
  getAdminStats,
} from "@/lib/admin.functions";

export {
  adjustWallet,
  getRewardSettings,
  getRewardStats,
  listCommissions,
  listOffersAdmin,
  listRedemptions,
  listReferralsForReview,
  listWallets,
  recordAffiliateCommission,
  reviewReferral,
  setCommissionStatus,
  setRedemptionStatus,
  setWalletFlag,
  simulateRewardShare,
  updateMerchantRewardConfig,
  updateRewardSettings,
  upsertOffer,
} from "@/lib/rewards-admin.functions";
