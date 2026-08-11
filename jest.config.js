/**
 * Testes da lógica pura em src/lib.
 *
 * Escopo deliberadamente estreito: estes módulos não importam React Native,
 * então rodam com ts-jest direto, sem o preset do Expo. Isso mantém a suíte
 * rápida e livre da fragilidade do transform de RN — se um dia houver teste de
 * componente, ele pede um projeto separado com jest-expo.
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/lib'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  collectCoverageFrom: ['src/lib/**/*.ts', '!src/lib/**/*.spec.ts'],
};
