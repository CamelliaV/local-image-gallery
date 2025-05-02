// src/components/ImageGrid.js
import React from 'react';
import Masonry from 'react-masonry-css'; // Import the library
import ImageCard from './ImageCard';
import './ImageGrid.css'; // We'll update this CSS file

function ImageGrid({ images, onImageClick }) {

  // Define responsive breakpoints for the columns
  const breakpointColumnsObj = {
    default: 5, // Default number of columns
    1500: 4, // 4 columns at 1500px screen width and above
    1200: 3, // 3 columns at 1200px screen width and above
    900: 2,  // 2 columns at 900px screen width and above
    600: 1   // 1 column at 600px screen width and below
  };

  // Check if images is defined and is an array before mapping
  if (!Array.isArray(images)) {
    console.warn("ImageGrid received invalid 'images' prop:", images);
    return null; // Or return some fallback UI
  }


  return (
    <Masonry
      breakpointCols={breakpointColumnsObj}
      className="my-masonry-grid" // Container class
      columnClassName="my-masonry-grid_column" // Column class
    >
      {/* Map over the images array */}
      {images.map((image) => (
        <ImageCard
          key={image.id} // Use the unique image ID as key
          image={image}
          onClick={onImageClick}
        />
      ))}
    </Masonry>
  );
}

export default ImageGrid;