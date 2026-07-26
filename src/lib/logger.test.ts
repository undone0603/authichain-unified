import { describe, it, expect, vi } from 'vitest';
import logger from './logger';

describe('Logger', () => {
  it('should be defined', () => {
    expect(logger).toBeDefined();
    expect(logger.info).toBeTypeOf('function');
  });

  it('should log messages', () => {
    const spy = vi.spyOn(logger, 'info');
    logger.info('test message');
    expect(spy).toHaveBeenCalledWith('test message');
  });
});
