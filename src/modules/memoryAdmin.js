import { doc, deleteDoc } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { db, storage } from './firebase.js';

export async function deleteMemory(memory) {
  // memory: { id, filename }
  if (!memory || !memory.id) throw new Error('Missing memory id');

  const docRef = doc(db, 'memories', memory.id);
  await deleteDoc(docRef);

  // Best-effort storage cleanup (filename stored on the Firestore doc).
  if (memory.filename) {
    const fileRef = ref(storage, `memories/${memory.filename}`);
    await deleteObject(fileRef).catch(() => {});
  }
}

