// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductCard from './ProductCard';

describe('ProductCard', () => {
  it('renders title and description', () => {
    render(<ProductCard title="My Product" description="A test product" />);
    expect(screen.getByText('My Product')).toBeTruthy();
    expect(screen.getByText('A test product')).toBeTruthy();
  });

  it('shows score when provided', () => {
    render(<ProductCard title="P" score={87.3} />);
    expect(screen.getByText(/87/)).toBeTruthy();
    expect(screen.getByText('/100')).toBeTruthy();
  });

  it('calls onPrimaryClick when View is clicked', () => {
    const onClick = vi.fn();
    render(<ProductCard title="P" onPrimaryClick={onClick} />);
    const btn = screen.getByRole('button', { name: /view/i });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });
});
