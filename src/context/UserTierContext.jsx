import React, { createContext, useContext } from "react";
import PropTypes from "prop-types";
import useAuthStatus from "../lib/useAuthStatus";

const defaultValue = {
  user: null,
  loading: true,
  tier: "basic",
  effectiveTier: "basic",
  trialStart: null,
  trialEndsAt: null,
  trialUsed: false,
  isTrialActive: false,
  trialExpired: false,
  trialRemainingMs: 0,
  trialRemainingDays: 0,
  refreshUserTier: () => Promise.resolve(),
};

const UserTierContext = createContext(defaultValue);

export const UserTierProvider = ({ children }) => {
  const authState = useAuthStatus();
  return <UserTierContext.Provider value={authState}>{children}</UserTierContext.Provider>;
};

export const useUserTier = () => useContext(UserTierContext);

UserTierProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
