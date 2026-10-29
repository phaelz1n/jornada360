export function createFirestoreStore({ db, doc, getDoc, setDoc }) {
  const ref = path => doc(db, path);
  return {
    async get(path) {
      const snapshot = await getDoc(ref(path));
      return snapshot.exists() ? snapshot.data() : undefined;
    },
    async set(path, value) {
      await setDoc(ref(path), value);
      return value;
    },
    async merge(path, value) {
      await setDoc(ref(path), value, { merge: true });
      return this.get(path);
    }
  };
}

