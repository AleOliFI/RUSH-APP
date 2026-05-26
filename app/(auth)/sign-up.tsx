import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Link, router } from 'expo-router';
import { H1, Body, Caption } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { useSignUp } from '../../src/hooks/useAuth';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const signUp = useSignUp();

  async function handleSignUp() {
    if (!name || !email || !password) {
      setError('Preencha todos os campos.');
      return;
    }
    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await signUp(email.trim(), password, name.trim());
    setLoading(false);
    if (err) {
      setError(err.message ?? 'Erro ao criar conta. Tente novamente.');
    } else {
      router.replace('/(auth)/onboarding/profile');
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg-primary"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-6 py-12 gap-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-2">
          <Text className="text-brand-green text-4xl font-black tracking-tighter">RUSH</Text>
          <H1>Crie sua conta</H1>
          <Body className="text-text-secondary">
            Comece gratuitamente. Sem cartão de crédito.
          </Body>
        </View>

        <View className="gap-4">
          <View className="gap-1.5">
            <Caption>Nome completo</Caption>
            <TextInput
              className="bg-bg-card text-text-primary border border-bg-border rounded-2xl px-4 py-3.5 text-base"
              placeholder="Seu nome"
              placeholderTextColor="#525252"
              autoCapitalize="words"
              autoComplete="name"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View className="gap-1.5">
            <Caption>E-mail</Caption>
            <TextInput
              className="bg-bg-card text-text-primary border border-bg-border rounded-2xl px-4 py-3.5 text-base"
              placeholder="seu@email.com"
              placeholderTextColor="#525252"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View className="gap-1.5">
            <Caption>Senha (mínimo 8 caracteres)</Caption>
            <TextInput
              className="bg-bg-card text-text-primary border border-bg-border rounded-2xl px-4 py-3.5 text-base"
              placeholder="••••••••"
              placeholderTextColor="#525252"
              secureTextEntry
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {error ? (
            <Text className="text-brand-red text-sm">{error}</Text>
          ) : null}

          <Button
            title="Criar conta grátis"
            size="lg"
            loading={loading}
            onPress={handleSignUp}
          />
        </View>

        <View className="items-center">
          <Body className="text-text-secondary">
            Já tem conta?{' '}
            <Link href="/(auth)/sign-in" asChild>
              <TouchableOpacity>
                <Text className="text-brand-green font-semibold">Entrar</Text>
              </TouchableOpacity>
            </Link>
          </Body>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
