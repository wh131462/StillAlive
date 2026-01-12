import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
}

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

function getBackgroundColor(name: string): string {
  const colorList = [
    '#f87171', // red
    '#fb923c', // orange
    '#fbbf24', // amber
    '#a3e635', // lime
    '#34d399', // emerald
    '#22d3ee', // cyan
    '#60a5fa', // blue
    '#a78bfa', // violet
    '#f472b6', // pink
  ];
  const index = name.charCodeAt(0) % colorList.length;
  return colorList[index];
}

export default function Avatar({ uri, name = '?', size = 40 }: AvatarProps) {
  const borderRadius = size / 2;
  const fontSize = size * 0.4;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: getBackgroundColor(name),
        },
      ]}
    >
      <Text style={[styles.initial, { fontSize }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.slate100,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: colors.white,
    fontWeight: '600',
  },
});
