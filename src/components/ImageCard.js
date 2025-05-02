// src/components/ImageCard.js
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './ImageCard.css';

// Added onRemove and showRemove props
function ImageCard({ image, id, onClick, isDragging, onRemove, showRemove }) {

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isOver,
  } = useSortable({
      id: id,
      // Disable sorting interactions if the remove button should be shown
      // to potentially prioritize clicking the remove button. Test this interaction.
      // disabled: showRemove,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0.4 : 1,
  };

  // Main card click handler
  const handleClick = (e) => {
      // Prevent card click if dragging started (dnd-kit activation constraint helps)
      if (isDragging) {
          e.preventDefault(); e.stopPropagation(); return;
      }
      // Let click proceed if not dragging
      onClick(image);
  }

  // Remove button click handler
  const handleRemoveClick = (e) => {
      e.preventDefault(); // Prevent card click
      e.stopPropagation(); // IMPORTANT: Prevent drag start when clicking button
      console.log(`Remove button clicked for: ${id}`);
      onRemove(id); // Call the handler passed from App
  }

  return (
    // Apply dnd-kit ref and styles to the root element
    <div
        ref={setNodeRef}
        style={style}
        className={`image-card ${isDragging ? 'dragging' : ''} ${isOver ? 'over' : ''}`}
        // Apply drag attributes/listeners conditionally? Or always allow drag?
        // Applying them always allows dragging even if remove button is visible.
        {...attributes}
        {...listeners}
        // Let the main click handler manage when the action occurs
        onClick={handleClick}
    >
      <img src={image.src} alt={image.id} style={{ pointerEvents: 'none' }}/>

      {/* --- Remove Button --- */}
      {/* Conditionally render based on the setting prop */}
      {showRemove && (
        <button
            className="image-card-remove-button"
            onClick={handleRemoveClick} // Use specific handler
            title="Remove from list"
            aria-label="Remove image from list"
            // Stop dnd listeners from activating on the button itself
            // This is handled implicitly by stopPropagation in handleRemoveClick
            // but adding it here can be extra safety.
             onPointerDown={(e) => e.stopPropagation()}
        >
           ×
        </button>
      )}
    </div>
  );
}

export default ImageCard;