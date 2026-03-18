import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from './firebase.js';
import { getStoredHash, isAuthenticated, showPasscodeModal } from './auth.js';

function compressImage(file, maxWidth = 1200, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        quality
      );
    };
    img.src = url;
  });
}

export async function uploadMemory(file, caption, onProgress) {
  if (!isAuthenticated()) {
    const hash = await showPasscodeModal();
    if (!hash) throw new Error('Authentication cancelled');
  }

  const compressed = await compressImage(file);
  const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const storageRef = ref(storage, `memories/${filename}`);

  const metadata = {
    customMetadata: { passcodeHash: getStoredHash() },
  };

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, compressed, metadata);

    task.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => reject(error),
      async () => {
        try {
          const downloadURL = await getDownloadURL(task.snapshot.ref);
          const doc = await addDoc(collection(db, 'memories'), {
            url: downloadURL,
            caption: caption || '',
            filename,
            createdAt: serverTimestamp(),
            passcodeHash: getStoredHash(),
          });
          resolve({ id: doc.id, url: downloadURL, caption });
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}
