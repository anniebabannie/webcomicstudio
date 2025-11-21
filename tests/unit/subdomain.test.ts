import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractSubdomain } from '~/utils/subdomain.server';

describe('extractSubdomain', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('Development environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should return null for localhost without subdomain', () => {
      expect(extractSubdomain('localhost')).toBe(null);
      expect(extractSubdomain('localhost:3000')).toBe(null);
      expect(extractSubdomain('localhost:5173')).toBe(null);
    });

    it('should extract subdomain from localhost', () => {
      expect(extractSubdomain('mycomic.localhost')).toBe('mycomic');
      expect(extractSubdomain('mycomic.localhost:3000')).toBe('mycomic');
      expect(extractSubdomain('test-comic.localhost:5173')).toBe('test-comic');
    });

    it('should return null for www subdomain on localhost', () => {
      expect(extractSubdomain('www.localhost')).toBe(null);
      expect(extractSubdomain('www.localhost:3000')).toBe(null);
    });
  });

  describe('Production environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should return null for base domains', () => {
      expect(extractSubdomain('webcomic.studio')).toBe(null);
      expect(extractSubdomain('wcsstaging.com')).toBe(null);
    });

    it('should extract subdomain from webcomic.studio', () => {
      expect(extractSubdomain('mycomic.webcomic.studio')).toBe('mycomic');
      expect(extractSubdomain('test-comic.webcomic.studio')).toBe('test-comic');
    });

    it('should extract subdomain from wcsstaging.com', () => {
      expect(extractSubdomain('mycomic.wcsstaging.com')).toBe('mycomic');
      expect(extractSubdomain('staging-test.wcsstaging.com')).toBe('staging-test');
    });

    it('should return null for www subdomain', () => {
      expect(extractSubdomain('www.webcomic.studio')).toBe(null);
      expect(extractSubdomain('www.wcsstaging.com')).toBe(null);
    });

    it('should handle ports in production', () => {
      expect(extractSubdomain('mycomic.webcomic.studio:443')).toBe('mycomic');
      expect(extractSubdomain('mycomic.wcsstaging.com:8080')).toBe('mycomic');
    });
  });

  describe('Edge cases', () => {
    it('should return null for null input', () => {
      expect(extractSubdomain(null)).toBe(null);
    });

    it('should return null for empty string', () => {
      expect(extractSubdomain('')).toBe(null);
    });

    it('should return null for single-part hostnames', () => {
      expect(extractSubdomain('localhost')).toBe(null);
      expect(extractSubdomain('example')).toBe(null);
    });

    it('should return null for unknown two-part domains in production', () => {
      process.env.NODE_ENV = 'production';
      expect(extractSubdomain('example.com')).toBe(null);
      expect(extractSubdomain('google.com')).toBe(null);
    });

    it('should return null for unknown multi-part domains', () => {
      process.env.NODE_ENV = 'production';
      expect(extractSubdomain('sub.example.com')).toBe(null);
      expect(extractSubdomain('api.github.com')).toBe(null);
    });
  });
});
