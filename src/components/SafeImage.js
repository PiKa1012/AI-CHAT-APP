import React, { useState, useEffect } from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import * as FileSystem from 'expo-file-system';

export function SafeImage({ uri, style, fallbackStyle, fallbackText, fallbackIcon }) {
  const [imageExists, setImageExists] = useState(null);

  useEffect(() => {
    checkImage();
  }, [uri]);

  const checkImage = async () => {
    if (!uri || uri.length <= 1) {
      setImageExists(false);
      return;
    }
    
    if (uri.startsWith('http') || uri.startsWith('https')) {
      setImageExists(true);
      return;
    }

    try {
      const info = await FileSystem.getInfoAsync(uri);
      setImageExists(info.exists);
    } catch (e) {
      setImageExists(false);
    }
  };

  if (imageExists === null) {
    return <View style={[style, styles.placeholder]} />;
  }

  if (imageExists) {
    return <Image source={{ uri }} style={style} />;
  }

  return (
    <View style={[style, fallbackStyle || styles.fallback]}>
      <Text style={styles.fallbackText}>{fallbackText || '?'}</Text>
    </View>
  );
}

export function SafeAvatar({ uri, size = 40, name, color = '#4A90D9', style }) {
  const [imageExists, setImageExists] = useState(null);

  useEffect(() => {
    checkImage();
  }, [uri]);

  const checkImage = async () => {
    if (!uri || uri.length <= 1) {
      setImageExists(false);
      return;
    }
    
    if (uri.startsWith('http') || uri.startsWith('https')) {
      setImageExists(true);
      return;
    }

    try {
      const info = await FileSystem.getInfoAsync(uri);
      setImageExists(info.exists);
    } catch (e) {
      setImageExists(false);
    }
  };

  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (imageExists === null) {
    return <View style={[avatarStyle, { backgroundColor: '#f0f0f0' }, style]} />;
  }

  if (imageExists) {
    return <Image source={{ uri }} style={[avatarStyle, style]} />;
  }

  return (
    <View style={[avatarStyle, { backgroundColor: color, justifyContent: 'center', alignItems: 'center' }, style]}>
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: 'bold' }}>
        {name?.[0] || '?'}
      </Text>
    </View>
  );
}

export async function checkFileExists(uri) {
  if (!uri || uri.length <= 1) return false;
  if (uri.startsWith('http') || uri.startsWith('https')) return true;
  
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch (e) {
    return false;
  }
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#f0f0f0',
  },
  fallback: {
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: '#999',
    fontWeight: 'bold',
  },
});
