/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Couleurs ivoiriennes officielles
        'ci-orange': '#FF8C00',
        'ci-white': '#FFFFFF',
        'ci-green': '#009E60',
        
        // Variations pour les états hover/active
        'ci-orange-dark': '#E67E00',
        'ci-orange-light': '#FFA726',
        'ci-green-dark': '#008054',
        'ci-green-light': '#00B976',
        
        // Couleurs complémentaires
        'ci-gray': {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        }
      },
      backgroundImage: {
        'ci-gradient': 'linear-gradient(135deg, #FF8C00 0%, #FFFFFF 50%, #009E60 100%)',
        'ci-gradient-vertical': 'linear-gradient(180deg, #FF8C00 0%, #FFFFFF 50%, #009E60 100%)',
        'ci-gradient-orange': 'linear-gradient(135deg, #FF8C00 0%, #FFA726 100%)',
        'ci-gradient-green': 'linear-gradient(135deg, #009E60 0%, #00B976 100%)',
      },
      boxShadow: {
        'ci': '0 4px 14px 0 rgba(255, 140, 0, 0.39)',
        'ci-green': '0 4px 14px 0 rgba(0, 158, 96, 0.39)',
      }
    },
  },
  plugins: [],
}
