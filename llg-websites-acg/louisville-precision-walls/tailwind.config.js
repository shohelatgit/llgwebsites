/** @type {import('tailwindcss').Config} */
export default {
  content: ['./**/*.html', './**/*.js', './**/*.ts'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1F2A25',
          900: '#1F2A25',
          800: '#25322D',
          700: '#2A3630',
          600: '#B85D2A',
          500: '#B85D2A',
          400: '#D67C3A',
          300: '#6E7270',
          200: '#EDE9E4',
          100: '#F4F1EC',
          50: '#F4F1EC',
        },
        secondary: { DEFAULT: '#B85D2A', light: '#D67C3A' },
        accent: {
          cyan: '#B85D2A',
          blue: '#1F2A25',
          silver: { 50: '#F4F1EC', 100: '#EDE9E4', 200: '#D6D6D6', 300: '#8A8E8C', 400: '#6E7270', 500: '#6E7270', 600: '#1F2A25' },
          copper: { DEFAULT: '#B85D2A', 500: '#B85D2A', 600: '#A35226', 700: '#1F2A25' },
        },
        background: { DEFAULT: '#F4F1EC', light: '#F4F1EC', white: '#ffffff' },
        text: { DEFAULT: '#1F2A25', light: 'rgba(31,42,37,0.68)', lighter: 'rgba(31,42,37,0.52)' },
      },
      fontFamily: {
        heading: ['Saira Stencil One', 'sans-serif'],
        body: ['Work Sans', 'sans-serif'],
        accent: ['Kalam', 'cursive'],
        display: ['Saira Stencil One', 'sans-serif'],
        sans: ['Work Sans', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-silver': 'linear-gradient(135deg, #F4F1EC 0%, #EDE9E4 100%)',
        'gradient-hero': 'linear-gradient(135deg, rgba(31,42,37,0.88) 0%, rgba(184,93,42,0.55) 50%, rgba(214,124,58,0.42) 100%)',
        'gradient-navy': 'linear-gradient(135deg, #1F2A25 0%, #25322D 100%)',
      },
    },
  },
  plugins: [],
}
