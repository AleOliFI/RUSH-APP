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
  primary: 'bg-brand-green',
  secondary: 'bg-bg-card border border-bg-border',
  ghost: 'bg-transparent',
  danger: 'bg-brand-red',
};

const textVariants = {
  primary: 'text-bg-primary font-semibold',
  secondary: 'text-text-primary font-medium',
  ghost: 'text-brand-green font-medium',
  danger: 'text-white font-semibold',
};

const sizes = {
  sm: 'px-4 py-2 rounded-xl',
  md: 'px-6 py-3.5 rounded-2xl',
  lg: 'px-8 py-4 rounded-2xl',
};

const textSizes = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
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
        disabled || loading ? 'opacity-50' : ''
      } ${className ?? ''}`}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#0A0A0A' : '#22C55E'}
        />
      ) : (
        <Text className={`${textVariants[variant]} ${textSizes[size]}`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
