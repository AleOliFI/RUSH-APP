import React from 'react';
import { View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'accent';
}

export function Card({ children, className, variant = 'default', ...props }: CardProps) {
  const base =
    variant === 'accent'
      ? 'bg-bg-card border border-rush-red/30 rounded-2xl p-5'
      : 'bg-bg-card border border-bg-border rounded-2xl p-5';

  return (
    <View className={`${base} ${className ?? ''}`} {...props}>
      {children}
    </View>
  );
}
