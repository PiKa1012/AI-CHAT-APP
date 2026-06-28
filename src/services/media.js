import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

export async function requestMediaPermission() {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  return status === 'granted';
}

export async function requestImagePickerPermission() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

export async function pickImageFromGallery() {
  const hasPermission = await requestImagePickerPermission();
  if (!hasPermission) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });

  if (!result.canceled) {
    return result.assets[0].uri;
  }
  return null;
}

export async function pickMultipleImagesFromGallery() {
  const hasPermission = await requestImagePickerPermission();
  if (!hasPermission) {
    return [];
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 0.8,
  });

  if (!result.canceled) {
    return result.assets.map(asset => asset.uri);
  }
  return [];
}

export { pickImageFromGallery as pickImage, pickMultipleImagesFromGallery as pickMultipleImages };

export async function saveToAlbum(uri, albumName = 'AI陪伴') {
  try {
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) return null;

    const asset = await MediaLibrary.createAssetAsync(uri);
    
    let album = await MediaLibrary.getAlbumAsync(albumName);
    if (!album) {
      album = await MediaLibrary.createAlbumAsync(albumName, asset, false);
    } else {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    }
    
    return asset.uri;
  } catch (error) {
    console.error('保存到相册失败:', error);
    return null;
  }
}

export async function getLocalUri(assetUri) {
  try {
    const info = await FileSystem.getInfoAsync(assetUri);
    if (info.exists) {
      return assetUri;
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function copyToAppStorage(uri, folder = 'images') {
  try {
    const fileName = `${folder}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const destPath = `${FileSystem.documentDirectory}${folder}/${fileName}`;
    
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}${folder}/`, { intermediates: true });
    await FileSystem.copyAsync({ from: uri, to: destPath });
    
    return destPath;
  } catch (error) {
    console.error('复制文件失败:', error);
    return null;
  }
}


