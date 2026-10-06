import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
export default [{
  files: ['src/**/*.{js,jsx}'],
  ignores: ['src/**/*.test.jsx'],
  languageOptions: {ecmaVersion: 'latest', sourceType: 'module', parserOptions: {ecmaFeatures: {jsx: true}}, globals: globals.browser},
  plugins: {'react-hooks': reactHooks},
  rules: {'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error'},
}];
