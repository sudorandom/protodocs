import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { useProtoRoute } from './useProtoRoute';

describe('useProtoRoute', () => {
  it('parses empty pathname correctly', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
    );
    const { result } = renderHook(() => useProtoRoute(), { wrapper });

    expect(result.current.packagePath).toBe('');
    expect(result.current.symbolPath).toBe('');
    expect(result.current.activeTab).toBe('files');
    expect(result.current.searchQuery).toBe('');
  });

  it('parses package and symbol path correctly', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/google.protobuf/Timestamp?tab=services&q=time']}>
        {children}
      </MemoryRouter>
    );
    const { result } = renderHook(() => useProtoRoute(), { wrapper });

    expect(result.current.packagePath).toBe('google.protobuf');
    expect(result.current.symbolPath).toBe('Timestamp');
    expect(result.current.activeTab).toBe('services');
    expect(result.current.searchQuery).toBe('time');
  });
});
