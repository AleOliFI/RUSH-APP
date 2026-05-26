import React from 'react';
import { Text, type TextProps } from 'react-native';

interface TypographyProps extends TextProps {
  children: React.ReactNode;
}

export function H1({ children, className, ...props }: TypographyProps) {
  return (
    <Text
      className={`font-display text-4xl font-black uppercase tracking-tight text-text-primary ${className ?? ''}`}
      {...props}
    >
      {children}
    </Text>
  );
}

export function H2({ children, className, ...props }: TypographyProps) {
  return (
    <Text
      className={`font-display text-3xl font-black uppercase tracking-tight text-text-primary ${className ?? ''}`}
      {...props}
    >
      {children}
    </Text>
  );
}

export function H3({ children, className, ...props }: TypographyProps) {
  return (
    <Text
      className={`font-display text-2xl font-black uppercase tracking-tight text-text-primary ${className ?? ''}`}
      {...props}
    >
      {children}
    </Text>
  );
}

export function Body({ children, className, ...props }: TypographyProps) {
  return (
    <Text
      className={`font-sans text-base text-text-primary leading-relaxed ${className ?? ''}`}
      {...props}
    >
      {children}
    </Text>
  );
}

export function Caption({ children, className, ...props }: TypographyProps) {
  return (
    <Text
      className={`font-sans text-sm text-text-secondary ${className ?? ''}`}
      {...props}
    >
      {children}
    </Text>
  );
}

export function Label({ children, className, ...props }: TypographyProps) {
  return (
    <Text
      className={`font-sans text-xs font-bold uppercase tracking-widest text-text-secondary ${className ?? ''}`}
      {...props}
    >
      {children}
    </Text>
  );
}

export function SectionNum({ children, className, ...props }: TypographyProps) {
  return (
    <Text
      className={`font-sans text-xs font-bold uppercase tracking-widest text-text-secondary ${className ?? ''}`}
      {...props}
    >
      {children}
    </Text>
  );
}
