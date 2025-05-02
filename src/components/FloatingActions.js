// src/components/FloatingActions.js
import React from 'react';
import './FloatingActions.css';

// --- SVG Icons ---
const MoonIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg> );
const SunIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg> );
const ArrowUpIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg> );
const AnimationOnIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> );
const AnimationOffIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> );
// No DustbinIcon needed

// Removed Dustbin related props from function signature
function FloatingActions({
  isDarkMode,
  toggleDarkMode,
  showScrollTop,
  scrollToTop,
  animationsEnabled,
  toggleAnimations,
}) {
  return (
    <div className="floating-actions-container">
      {/* Scroll to Top Button */}
      {showScrollTop && ( <button className="fab-button scroll-top-button" onClick={scrollToTop} title="Scroll to Top"><ArrowUpIcon /></button> )}

      {/* Animation Toggle Button */}
      <button className="fab-button animation-toggle-button" onClick={toggleAnimations} title={animationsEnabled ? 'Disable Animations' : 'Enable Animations'}>
        {animationsEnabled ? <AnimationOnIcon /> : <AnimationOffIcon />}
      </button>

      {/* Dark Mode Toggle Button */}
      <button className="fab-button dark-mode-button" onClick={toggleDarkMode} title={isDarkMode ? 'Switch Light' : 'Switch Dark'}>
        {isDarkMode ? <SunIcon /> : <MoonIcon />}
      </button>

      {/* --- REMOVED Dustbin Droppable Area --- */}

    </div>
  );
}

export default FloatingActions;