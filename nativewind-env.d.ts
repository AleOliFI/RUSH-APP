/// <reference types="nativewind/types" />

// O `expo-env.d.ts` (que referencia expo/types e declara imports de CSS) é
// gerado pelo Expo e fica no gitignore, então no CI ele não existe. Sem esta
// declaração, `import '../global.css'` falha com TS2882 apenas no CI.
declare module '*.css';
