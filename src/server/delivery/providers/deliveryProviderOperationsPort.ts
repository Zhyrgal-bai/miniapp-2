export interface DeliveryProviderOperationsPort {
  readonly providerId: string;
  getProviderPortalUrl(providerClaimId: string): string | null;
}
