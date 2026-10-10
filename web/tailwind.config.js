/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        vcc: {
          navy: '#0D1B3E',
          'navy-light': '#1A2D5A',
          'navy-deep': '#081229',
          blue: '#1E88E5',
          'blue-dark': '#1565C0',
          'blue-light': '#42A5F5',
          gold: '#F9A825',
          teal: '#00897B',
          gray: '#607D8B',
          'gray-light': '#B0BEC5',
          white: '#FFFFFF',
          danger: '#E53935',
          success: '#43A047',
          warning: '#FB8C00',
        },
      },
      fontFamily: {
        heading: ['"Bahnschrift SemiBold SemiCondensed"', '"Barlow Condensed"', '"Gill Sans"', 'Arial', 'sans-serif'],
        body: ['Inter', 'Arial', 'sans-serif'],
      },
      screens: { xs: '390px' },
    },
  },
  plugins: [],
};
