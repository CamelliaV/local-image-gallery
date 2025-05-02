// src/components/FullScreenImage.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { debounce } from '../utils/debounce'; // Adjust path if needed
import './FullScreenImage.css';

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const SCALE_STEP = 0.2;
const WHEEL_DEBOUNCE_MS = 100; // Milliseconds to wait after wheel event

function FullScreenImage({ image, currentIndex, images, onClose, onNavigate }) {
  const [scale, setScale] = useState(1);
  const debouncedWheelNavigate = useRef(null); // Ref to store the debounced function

  // --- Keyboard Event Handler ---
  const handleKeyDown = useCallback((event) => {
    if (!image) return;
    // console.log("Keydown:", event.key);
    switch (event.key) {
      case 'ArrowLeft':
        if (currentIndex > 0) {
          onNavigate(-1); setScale(1);
        }
        break;
      case 'ArrowRight':
        if (currentIndex < images.length - 1) {
          onNavigate(1); setScale(1);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        setScale(prevScale => Math.min(prevScale + SCALE_STEP, MAX_SCALE));
        break;
      case 'ArrowDown':
        event.preventDefault();
        setScale(prevScale => Math.max(prevScale - SCALE_STEP, MIN_SCALE));
        break;
      case 'Escape':
        onClose();
        break;
      default: break;
    }
  }, [onClose, onNavigate, currentIndex, images.length, image]); // Dependencies for keyboard handler

  // Effect to add/remove keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    // console.log("Fullscreen Keydown listener ADDED");
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // console.log("Fullscreen Keydown listener REMOVED");
    };
  }, [handleKeyDown]); // Re-attach if handler changes


  // --- Click Outside Handler (Feature 1) ---
  // This should already work: Click on overlay closes, click on content stops propagation.
  const handleBackgroundClick = (e) => {
    // Close only if the click is directly on the overlay background
    if (e.target === e.currentTarget) {
      // console.log("Background clicked, closing.");
      onClose();
    } else {
      // console.log("Clicked on child, not closing.");
    }
  };


  // --- Mouse Wheel Handler Logic (Feature 2) ---
  const handleWheelNavigation = useCallback((event) => {
    if (!image || !onNavigate) return; // Ensure props are available

    // We prevent default scrolling inside the listener setup
    // console.log("Wheel deltaY:", event.deltaY);

    if (event.deltaY > 5) { // Threshold to prevent minor trackpad noise, scrolling down/away -> Next
      if (currentIndex < images.length - 1) {
        // console.log("Wheel navigating NEXT");
        onNavigate(1);
        setScale(1);
      }
    } else if (event.deltaY < -5) { // Threshold, scrolling up/towards -> Previous
      if (currentIndex > 0) {
        // console.log("Wheel navigating PREV");
        onNavigate(-1);
        setScale(1);
      }
    }
  }, [image, onNavigate, currentIndex, images.length]); // Dependencies for wheel handler


  // Create the debounced version of the wheel handler
  useEffect(() => {
      // Assign the debounced function to the ref
      debouncedWheelNavigate.current = debounce(handleWheelNavigation, WHEEL_DEBOUNCE_MS);
      // console.log("Debounced wheel handler created/updated");
  }, [handleWheelNavigation]); // Recreate debounce wrapper if base handler logic changes


  // Effect to add/remove Wheel listener to the overlay
  useEffect(() => {
    const overlayElement = document.querySelector('.full-screen-overlay'); // Find the overlay
    if (!overlayElement) {
        console.warn("Could not find .full-screen-overlay element to attach wheel listener.");
        return;
    }

    // Define the actual listener function that calls the debounced handler
    const wheelListener = (event) => {
      event.preventDefault(); // Prevent page scrolling BEHIND the modal
      if (debouncedWheelNavigate.current) {
        debouncedWheelNavigate.current(event); // Call the debounced function
      }
    };

    // Add the listener to the overlay element
    // Use passive: false because we need to call preventDefault()
    overlayElement.addEventListener('wheel', wheelListener, { passive: false });
    // console.log("Wheel listener ADDED to overlay");

    // Cleanup function runs on component unmount
    return () => {
      overlayElement.removeEventListener('wheel', wheelListener, { passive: false });
      // console.log("Wheel listener REMOVED from overlay");
      // Optional: Cancel any pending debounced call on unmount
      if (debouncedWheelNavigate.current && debouncedWheelNavigate.current.cancel) {
        // console.log("Cancelling pending debounced wheel call");
        debouncedWheelNavigate.current.cancel();
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount and cleanup on unmount


  // --- Render Logic ---
  if (!image) return null;

  const showPrev = currentIndex > 0;
  const showNext = currentIndex < images.length - 1;

  return (
    // Add the background click handler here
    <div className="full-screen-overlay" onClick={handleBackgroundClick}>

      {/* Navigation and Close Buttons */}
      {showPrev && (
        <button
            className="nav-button prev-button"
            // Stop propagation so click doesn't trigger background close
            onClick={(e) => { e.stopPropagation(); onNavigate(-1); setScale(1); }}
            title="Previous (Left Arrow / Scroll Up)" // Updated title
        >
           {/* Using text arrows for simplicity, replace with SVG/Icon if preferred */}
           ←
        </button>
      )}
      {showNext && (
        <button
            className="nav-button next-button"
            onClick={(e) => { e.stopPropagation(); onNavigate(1); setScale(1); }}
            title="Next (Right Arrow / Scroll Down)" // Updated title
        >
           →
        </button>
      )}
      <button
        className="close-button"
        // Also stop propagation for the close button click
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        title="Close (Escape / Click Background)" // Updated title
      >
         ×
      </button>

      {/* --- Wrapper for Content (Image Area + Text) ---
          Add stopPropagation here to prevent clicks inside closing the modal */}
      <div className="image-view-area" onClick={(e) => e.stopPropagation()}>

        {/* --- Container for Image - Handles Zoom Clipping --- */}
        <div className="image-zoom-container">
          <img
            key={image.src || image.id} // Use src if available, key helps reset zoom/pan state on nav
            src={image.src}
            alt={image.id} // Use id which includes path for alt text
            className="full-screen-image"
            style={{ transform: `scale(${scale})` }}
            // No onClick needed here
          />
        </div>

        {/* --- Filename (Sibling to zoom container) --- */}
        <p className="image-filename">
          {image.id} {/* Display the unique ID (includes path) */}
        </p>
      </div>
    </div>
  );
}

export default FullScreenImage;