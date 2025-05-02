// src/utils/imageLoader.js
function importAll(r) {
  // The keys are like './image1.jpg'. We extract the filename.
  // r(key) actually imports the module (the image path/data).
  return r.keys().map(key => ({
    id: key.replace('./', ''), // Use filename as a pseudo-id
    src: r(key) // The actual imported image source
  }));
}

// Tell Webpack to require all files in ../imgs ending with common image extensions
// false means don't look in subdirectories
const imageContext = require.context('../imgs', false, /\.(png|jpe?g|svg|gif)$/);

// Execute the function to get the array of image objects
const images = importAll(imageContext);

export default images;