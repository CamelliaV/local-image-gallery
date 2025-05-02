// src/components/ImageCard.js
import React from 'react';
import './ImageCard.css'; // We'll create this CSS file next

function ImageCard({ image, onClick }) {
  return (
    <div className="image-card" onClick={() => onClick(image)}>
      <img src={image.src} alt={image.id} />
    </div>
  );
}

export default ImageCard;