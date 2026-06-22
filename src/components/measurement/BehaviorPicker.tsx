import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BEHAVIOR_OPTIONS, type Behavior } from '../../lib/algorithms/behaviors';
import { Label, Caption } from '../ui/Typography';
import { Button } from '../ui/Button';

interface BehaviorPickerProps {
  onSave: (behaviors: Behavior[]) => Promise<void>;
}

export function BehaviorPicker({ onSave }: BehaviorPickerProps) {
  const [selected, setSelected] = useState<Set<Behavior>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(b: Behavior) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
  }

  async function handleSave() {
    setLoading(true);
    await onSave([...selected]);
    setLoading(false);
    setSaved(true);
  }

  if (saved) {
    return (
      <View className="items-center py-3">
        <Text className="text-brand-green text-sm font-semibold">✓ Fatores registrados</Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="gap-0.5">
        <Label>O que aconteceu ontem?</Label>
        <Caption className="text-text-secondary">
          Ajuda a identificar o que impacta sua recuperação.
        </Caption>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {BEHAVIOR_OPTIONS.map((opt) => {
          const isSelected = selected.has(opt.key);
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => toggle(opt.key)}
              activeOpacity={0.7}
              className={`flex-row items-center gap-1.5 px-3 py-2 rounded-2xl border ${
                isSelected
                  ? 'bg-brand-green/15 border-brand-green'
                  : 'bg-bg-card border-bg-border'
              }`}
            >
              <Text className="text-base">{opt.emoji}</Text>
              <Text
                className={`text-sm font-medium ${
                  isSelected ? 'text-brand-green' : 'text-text-secondary'
                }`}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Button
        title={selected.size === 0 ? 'Nada a registrar' : `Salvar (${selected.size})`}
        variant="secondary"
        loading={loading}
        onPress={handleSave}
      />
    </View>
  );
}
