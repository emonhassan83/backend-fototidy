export const isFreeTrialActive = (user: any) => {
  if (!user.isEnabledFreeTrial || !user.freeTrialExpiry) {
    return false
  }

  const now = new Date()
  return new Date(user.freeTrialExpiry) > now
}
