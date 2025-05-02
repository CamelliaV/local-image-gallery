// src/utils/debounce.js
export function debounce(func, wait) {
  let timeout;

  // This is the function that will be returned and assigned to the event listener
  function executedFunction(...args) {
    // Capture the context (`this`) and arguments passed to the event handler
    const context = this;

    // The function to be executed after the debounce timer expires
    const later = () => {
      timeout = null; // Clear the timeout ID
      func.apply(context, args); // Call the original function with original context and args
    };

    // Clear any existing timeout
    clearTimeout(timeout);
    // Set a new timeout
    timeout = setTimeout(later, wait);
  }

  // Add a simple way to clear the pending timeout if needed externally (optional)
  // Note: This might not be strictly necessary for the wheel listener cleanup
  // if the listener itself is removed promptly.
  executedFunction.cancel = () => {
    clearTimeout(timeout);
    timeout = null;
  };


  return executedFunction;
}