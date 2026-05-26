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
import { useSignIn } from '../../src/hooks/useAuth';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const signIn = useSignIn();

  async function handleSignIn() {
    if (!email || !password) {
      setError('Preencha todos os campos.');
      return;
    }
    setLoading(true);
    setError('');
    const err = await signIn(email.trim(), password);
    setLoading(false);
    if (err) {
      setError('E-mail ou senha inválidos.');
    } else {
      router.replace('/(tabs)');
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
          <H1>Bem-vindo de volta</H1>
          <Body className="text-text-secondary">
            Seu treinador de recuperação baseado em ciência.
          </Body>
        </View>

        <View className="gap-4">
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
            <Caption>Senha</Caption>
            <TextInput
              className="bg-bg-card text-text-primary border border-bg-border rounded-2xl px-4 py-3.5 text-base"
              placeholder="••••••••"
              placeholderTextColor="#525252"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {error ? (
            <Text className="text-brand-red text-sm">{error}</Text>
          ) : null}

          <Button
            title="Entrar"
            size="lg"
            loading={loading}
            onPress={handleSignIn}
          />
        </View>

        <View className="items-center">
          <Body className="text-text-secondary">
            Não tem conta?{' '}
            <Link href="/(auth)/sign-up" asChild>
              <TouchableOpacity>
                <Text className="text-brand-green font-semibold">Criar conta grátis</Text>
              </TouchableOpacity>
            </Link>
          </Body>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
