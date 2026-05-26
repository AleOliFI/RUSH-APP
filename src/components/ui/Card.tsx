import React from 'react';
import { View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <View
      className={`bg-bg-card rounded-3xl p-5 ${className ?? ''}`}
      {...props}
    >
      {children}
    </View>
  );
}
