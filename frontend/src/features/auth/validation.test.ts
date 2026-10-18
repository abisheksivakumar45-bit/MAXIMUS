import { describe, expect, it } from 'vitest';

import {
  validateDisplayName,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from './validation';

describe('validateDisplayName', () => {
  it('requires a value', () => {
    expect(validateDisplayName('')).toBe('Display name is required.');
    expect(validateDisplayName('   ')).toBe('Display name is required.');
  });

  it('accepts a normal name', () => {
    expect(validateDisplayName('Ada Lovelace')).toBeNull();
  });
});

describe('validateEmail', () => {
  it('rejects an empty or malformed address', () => {
    expect(validateEmail('')).toBe('Email is required.');
    expect(validateEmail('not-an-email')).toBe('Enter a valid email address.');
  });

  it('accepts a valid address', () => {
    expect(validateEmail('person@example.com')).toBeNull();
  });
});

describe('validatePassword', () => {
  it('enforces the minimum length', () => {
    expect(validatePassword('short')).toBe('Password must be at least 10 characters.');
  });

  it('requires a letter and a number', () => {
    expect(validatePassword('0123456789')).toBe('Password must contain at least one letter.');
    expect(validatePassword('abcdefghij')).toBe('Password must contain at least one number.');
  });

  it('accepts a compliant password', () => {
    expect(validatePassword('TestPassword123')).toBeNull();
  });
});

describe('validatePasswordConfirmation', () => {
  it('requires confirmation', () => {
    expect(validatePasswordConfirmation('TestPassword123', '')).toBe('Confirm your password.');
  });

  it('detects mismatches', () => {
    expect(validatePasswordConfirmation('TestPassword123', 'Different123')).toBe(
      'Passwords do not match.',
    );
  });

  it('accepts a matching confirmation', () => {
    expect(validatePasswordConfirmation('TestPassword123', 'TestPassword123')).toBeNull();
  });
});
