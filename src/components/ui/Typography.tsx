import React from 'react';
import { Text, type TextProps } from 'react-native';

interface TypographyProps extends TextProps {
  children: React.ReactNode;
}

export function H1({ children, className, ...props }: TypographyProps) {
  return (
    <Text className={`text-3xl font-bold text-text-primary ${className ?? ''}`} {...props}>
      {children}
    </Text>
  );
}

export function H2({ children, className, ...props }: TypographyProps) {
  return (
    <Text className={`text-2xl font-bold text-text-primary ${className ?? ''}`} {...props}>
      {children}
    </Text>
  );
}

export function H3({ children, className, ...props }: TypographyProps) {
  return (
    <Text className={`text-xl font-semibold text-text-primary ${className ?? ''}`} {...props}>
      {children}
    </Text>
  );
}

export function Body({ children, className, ...props }: TypographyProps) {
  return (
    <Text className={`text-base text-text-primary leading-relaxed ${className ?? ''}`} {...props}>
      {children}
    </Text>
  );
}

export function Caption({ children, className, ...props }: TypographyProps) {
  return (
    <Text className={`text-sm text-text-secondary ${className ?? ''}`} {...props}>
      {children}
    </Text>
  );
}

export function Label({ children, className, ...props }: TypographyProps) {
  return (
    <Text className={`text-xs font-semibold uppercase tracking-widest text-text-muted ${className ?? ''}`} {...props}>
      {children}
    </Text>
  );
}
