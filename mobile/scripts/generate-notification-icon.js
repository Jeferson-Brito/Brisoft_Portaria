const path = require('path');
const sharp = require(require.resolve('sharp', { paths: [path.join(__dirname, '..', '..', 'backend')] }));

const svg = `<svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <path fill="#ffffff" d="M48 6c2.6 0 15.2 8.6 24.4 11.2 2.4.6 3.6 2.8 3.6 5.2V52c0 20.2-12.4 33.4-27.2 38.8-.5.2-1.1.2-1.6 0C31.4 85.4 20 72.2 20 52V22.4c0-2.4 1.2-4.6 3.6-5.2C33 14.6 45.4 6 48 6zm-2.2 28.5c-1.6 0-2.9 1.3-2.9 2.9v16.4c0 1.6 1.3 2.9 2.9 2.9h4.4c1.6 0 2.9-1.3 2.9-2.9V37.4c0-1.6-1.3-2.9-2.9-2.9h-4.4zm0 26.2c-1.6 0-2.9 1.3-2.9 2.9v4.4c0 1.6 1.3 2.9 2.9 2.9h4.4c1.6 0 2.9-1.3 2.9-2.9v-4.4c0-1.6-1.3-2.9-2.9-2.9h-4.4z"/>
</svg>`;

const out = path.join(__dirname, '..', 'assets', 'notification-icon.png');

sharp(Buffer.from(svg))
  .resize(96, 96)
  .png()
  .toFile(out)
  .then(() => console.log('Wrote', out))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
