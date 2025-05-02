// src/components/ImageGrid.js
import React from 'react';
import Masonry from 'react-masonry-css';
import ImageCard from './ImageCard';
import './ImageGrid.css';

// Added onRemoveImage and showRemoveButton props
function ImageGrid({ images, onImageClick, activeDragId, onRemoveImage, showRemoveButton }) {

  const breakpointColumnsObj = {
    default: 5, 1500: 4, 1200: 3, 900: 2, 600: 1
  };

  if (!Array.isArray(images)) {
    console.warn("ImageGrid received invalid 'images' prop:", images);
    return null;
  }

  return (
    <Masonry
      breakpointCols={breakpointColumnsObj}
      className="my-masonry-grid"
      columnClassName="my-masonry-grid_column"
    >
      {images.map((image) => (
        <ImageCard
          key={image.id} // Important for React and DND
          image={image} // Pass full image object {id, fileHandle, src}
          id={image.id} // Pass ID explicitly for useSortable
          onClick={onImageClick}
          isDragging={activeDragId === image.id} // Pass dragging state
          onRemove={onRemoveImage} // Pass remove handler down
          showRemove={showRemoveButton} // Pass setting down
        />
      ))}
    </Masonry>
  );
}

export default ImageGrid;