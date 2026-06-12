import js from '@eslint/js'
import ts from 'typescript-eslint'
import vue from 'eslint-plugin-vue'

export default ts.config(
    { ignores: ['public/**', 'dist/**', 'node_modules/**', 'legacy/**'] },
    js.configs.recommended,
    ...ts.configs.recommended,
    ...vue.configs['flat/recommended'],
    {
        files: ['**/*.vue'],
        languageOptions: {
            parserOptions: { parser: ts.parser },
        },
    },
    {
        rules: {
            'vue/multi-word-component-names': 'off',
            // Formatierung übernimmt Prettier – stilistische Vue-Regeln deaktivieren.
            'vue/max-attributes-per-line': 'off',
            'vue/singleline-html-element-content-newline': 'off',
            'vue/html-self-closing': 'off',
            'vue/html-closing-bracket-newline': 'off',
            'vue/first-attribute-linebreak': 'off',
            'vue/attributes-order': 'off',
        },
    },
)
