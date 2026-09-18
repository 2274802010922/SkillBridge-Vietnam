// Offline build fixture only. Never configure NEXT_FONT_GOOGLE_MOCKED_RESPONSES on Vercel.
// Layout/font visual acceptance still requires the real production font files.
module.exports = {
  "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap": "@font-face { font-family: 'Be Vietnam Pro'; src: local('Arial'); }",
  "https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap": "@font-face { font-family: 'Geist Mono'; src: local('Courier New'); }",
};
