import { LLMRouter } from '../src/services/LLMRouter';

describe('LLMRouter', () => {
  let router: LLMRouter;

  beforeEach(() => {
    router = new LLMRouter();
  });

  describe('route', () => {
    it('should route short messages to gemini', () => {
      const decision = router.route('Hello world', 'auto');
      expect(decision.provider).toBe('gemini');
    });

    it('should route long messages to openai', () => {
      const longMessage = 'a'.repeat(150);
      const decision = router.route(longMessage, 'auto');
      expect(decision.provider).toBe('openai');
    });

    it('should handle exact threshold boundary', () => {
      const exactMessage = 'a'.repeat(100);
      const decision = router.route(exactMessage, 'auto');
      expect(decision.provider).toBe('openai');
    });

    it('should respect explicit provider override', () => {
      const decision = router.route('Short message', 'anthropic');
      expect(decision.provider).toBe('anthropic');
      expect(decision.metadata.wasOverridden).toBe(true);
    });

    it('should handle empty messages', () => {
      const decision = router.route('', 'auto');
      expect(decision.provider).toBe('gemini');
    });

    it('should handle very long messages', () => {
      const veryLongMessage = 'a'.repeat(10000);
      const decision = router.route(veryLongMessage, 'auto');
      expect(decision.provider).toBe('openai');
    });
  });

  describe('getRoutingInfo', () => {
    it('should return correct routing info for short message', () => {
      const info = router.getRoutingInfo('Hello');
      expect(info.wouldRouteToShort).toBe(true);
      expect(info.shortProvider).toBe('gemini');
    });

    it('should return correct routing info for long message', () => {
      const longMessage = 'a'.repeat(150);
      const info = router.getRoutingInfo(longMessage);
      expect(info.wouldRouteToLong).toBe(true);
      expect(info.longProvider).toBe('openai');
    });
  });
});
