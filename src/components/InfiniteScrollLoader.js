// src/components/InfiniteScrollLoader.js
import React from 'react';
import './InfiniteScrollLoader.css';

function InfiniteScrollLoader() {
  return (
    <div className="infinite-loader-container">
      <div className="loader-dot"></div>
      <div className="loader-dot"></div>
      <div className="loader-dot"></div>
    </div>
  );
}

export default InfiniteScrollLoader;