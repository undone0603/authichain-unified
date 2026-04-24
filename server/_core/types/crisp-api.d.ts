declare module "crisp-api" {
  class Crisp {
    authenticateTier(tier: string, identifier: string, key: string): void;
    website: {
      sendMessageInConversation(
        websiteId: string,
        sessionId: string,
        message: Record<string, unknown>,
      ): Promise<void>;
      updatePeopleProfile(
        websiteId: string,
        email: string,
        data: Record<string, unknown>,
      ): Promise<void>;
      updatePeopleData(
        websiteId: string,
        email: string,
        data: Record<string, unknown>,
      ): Promise<void>;
    };
  }
  export = Crisp;
}
