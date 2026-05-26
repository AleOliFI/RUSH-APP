import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type TouchableOpacityProps,
} from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variants = {
  primary:   'bg-rush-red',
  secondary: 'bg-bg-card border border-bg-border',
  ghost:     'bg-transparent border border-bg-border',
  danger:    'bg-rush-red',
};

const textVariants = {
  primary:   'text-text-primary font-bold',
  secondary: 'text-text-primary font-semibold',
  ghost:     'text-rush-lime font-semibold',
  danger:    'text-text-primary font-bold',
};

const sizes = {
  sm: 'px-4 py-2 rounded-sm',
  md: 'px-6 py-3.5 rounded-sm',
  lg: 'px-8 py-4 rounded-sm',
};

const textSizes = {
  sm: 'text-sm tracking-widest uppercase',
  md: 'text-base tracking-widest uppercase',
  lg: 'text-lg tracking-widest uppercase',
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <TouchableOpacity
      className={`${variants[variant]} ${sizes[size]} flex-row items-center justify-center ${
        disabled || loading ? 'opacity-40' : ''
      } ${className ?? ''}`}
      disabled={disabled || loading}
      activeOpacity={0.75}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'ghost' ? '#ccff00' : '#f7f5f3'}
        />
      ) : (
        <Text className={`${textVariants[variant]} ${textSizes[size]}`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
