// src/App.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ImageGrid from './components/ImageGrid';
import FullScreenImage from './components/FullScreenImage';
import FloatingActions from './components/FloatingActions';
import InfiniteScrollLoader from './components/InfiniteScrollLoader';
import { debounce } from './utils/debounce';
import './App.css';

const BATCH_SIZE = 15;
const SCROLL_BUFFER = 300;
const SCROLL_TOP_VISIBILITY_THRESHOLD = 300;

// Helper: Check if a file is an image based on type
const isImageFile = (file) => file && file.type && file.type.startsWith('image/');

// Helper: Generate unique ID using relative path for directory selections
const generateImageId = (file, basePathHint = '') => {
    const relativePath = (file.webkitRelativePath && file.webkitRelativePath.trim() !== '') ? file.webkitRelativePath : file.name;
    let combinedPath;
    if (basePathHint && !relativePath.startsWith(basePathHint + '/')) {
        combinedPath = `${basePathHint}/${relativePath}`.replace('//', '/');
    } else {
        combinedPath = relativePath;
    }
    const finalId = combinedPath.replace(/\\/g, '/'); // Normalize slashes
    // console.log(`[generateImageId] Hint: ${basePathHint}, RelPath: ${relativePath} -> ID: ${finalId}`);
    return finalId;
};

// Helper: Create Blob URL
const createBlobUrl = (file) => {
    if (file instanceof File) { // Ensure it's a File object
        try {
            return URL.createObjectURL(file);
        } catch (error) {
            console.error("Error creating blob URL:", error, "for file:", file.name);
            return null;
        }
    }
    console.warn("Attempted to create blob URL for non-File object:", file);
    return null; // Or a placeholder URL
}

// Helper: Revoke Blob URL
const revokeBlobUrl = (url) => {
    if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
        // console.log(`Revoked URL: ${url.substring(url.length - 10)}`); // Log last part for debugging
    }
}


function App() {
    // --- State ---
    const [userImages, setUserImages] = useState([]); // Shape: { id: string, fileHandle: File }
    const [selectedImage, setSelectedImage] = useState(null); // Shape: { id: string, fileHandle: File, src?: string }
    const [currentImageIndex, setCurrentImageIndex] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [displayedImages, setDisplayedImages] = useState([]); // Shape: { id: string, fileHandle: File, src: string }
    const [isProcessingFiles, setIsProcessingFiles] = useState(false); // For directory processing
    const [isLoadingMore, setIsLoadingMore] = useState(false); // For infinite scroll loading
    const [hasMore, setHasMore] = useState(true);
    const [filteredImageSource, setFilteredImageSource] = useState([]); // Shape: { id: string, fileHandle: File }

    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedMode = localStorage.getItem('darkMode');
        return savedMode ? JSON.parse(savedMode) : false;
    });
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [animationsEnabled, setAnimationsEnabled] = useState(() => {
        const saved = localStorage.getItem('animationsEnabled');
        return saved !== null ? JSON.parse(saved) : true; // Default true
    });

    // --- Refs ---
    const debouncedLoadMoreRef = useRef();
    const debouncedScrollCheckRef = useRef();
    const fileInputRef = useRef(null);
    const prevDisplayedImagesRef = useRef([]); // Stores previous batch {id, fileHandle, src} for cleanup

    // --- Effects ---

    // Dark Mode Effect
    useEffect(() => {
        if (isDarkMode) document.body.classList.add('dark-mode');
        else document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    }, [isDarkMode]);

    // Scroll Top Visibility Effect
    useEffect(() => {
        const checkScrollTop = () => setShowScrollTop(window.scrollY > SCROLL_TOP_VISIBILITY_THRESHOLD);
        debouncedScrollCheckRef.current = debounce(checkScrollTop, 150);
        window.addEventListener('scroll', debouncedScrollCheckRef.current);
        checkScrollTop(); // Initial check
        return () => {
            window.removeEventListener('scroll', debouncedScrollCheckRef.current);
            if (debouncedScrollCheckRef.current?.cancel) debouncedScrollCheckRef.current.cancel();
        };
    }, []);

    // Animation Enable/Disable Effect
    useEffect(() => {
        if (animationsEnabled) {
            document.body.classList.add('animations-enabled');
        } else {
            document.body.classList.remove('animations-enabled');
        }
        localStorage.setItem('animationsEnabled', JSON.stringify(animationsEnabled));
    }, [animationsEnabled]);

    // Filtering Effect (userImages or searchTerm change -> update filteredImageSource)
    useEffect(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
        const filtered = !lowerCaseSearchTerm
          ? userImages // These only have {id, fileHandle}
          : userImages.filter(image => image.id.toLowerCase().includes(lowerCaseSearchTerm));
        setFilteredImageSource(filtered);
        // console.log(`[Filter Effect] Filtered source updated: ${filtered.length} items`);
    }, [searchTerm, userImages]);

    // Display Batch Effect & URL Management
    // (filteredImageSource changes -> update displayedImages with fresh Blob URLs & clean up old ones)
    useEffect(() => {
        // console.log(`[Display Effect] Running. Filtered source size: ${filteredImageSource.length}.`);

        // --- Step 1: Revoke URLs from the PREVIOUS batch ---
        const previousBatch = prevDisplayedImagesRef.current;
        // console.log(`[Display Effect] Revoking ${previousBatch.length} previous blob URLs.`);
        previousBatch.forEach(img => revokeBlobUrl(img.src));

        // --- Step 2: Create new batch and generate NEW URLs ---
        const newBatchRaw = filteredImageSource.slice(0, BATCH_SIZE);
        const newBatchWithUrls = newBatchRaw.map(imgData => ({
            ...imgData, // id, fileHandle
            src: createBlobUrl(imgData.fileHandle) // Generate fresh URL
        })).filter(img => img.src !== null); // Filter out any potential null URLs from errors

        // console.log(`[Display Effect] Generated ${newBatchWithUrls.length} new blob URLs for initial display.`);

        // --- Step 3: Update state ---
        setDisplayedImages(newBatchWithUrls);
        setHasMore(filteredImageSource.length > BATCH_SIZE);

        // --- Step 4: Store current batch (with URLs) for next cleanup ---
        prevDisplayedImagesRef.current = newBatchWithUrls;

        // Ensure loading indicators are off
        setIsLoadingMore(false);
        // Don't reset isProcessingFiles here; its finally block handles it

    }, [filteredImageSource]); // This effect depends ONLY on the filtered source changing

    // --- Load More Images Function ---
    const loadMoreImages = useCallback(() => {
        if (isLoadingMore || isProcessingFiles || !hasMore) return;

        const currentLength = displayedImages.length;
        if (currentLength >= filteredImageSource.length) {
            setHasMore(false); return;
        }

        setIsLoadingMore(true);

        setTimeout(() => { // Simulate loading time
            const nextBatchRaw = filteredImageSource.slice(
                currentLength,
                currentLength + BATCH_SIZE
            );

            // --- Generate URLs for the new batch ONLY ---
            const nextBatchWithUrls = nextBatchRaw.map(imgData => ({
                ...imgData, // id, fileHandle
                src: createBlobUrl(imgData.fileHandle)
            })).filter(img => img.src !== null); // Filter out errors

            // console.log(`[Load More] Generated ${nextBatchWithUrls.length} URLs for new batch.`);

            if (nextBatchWithUrls.length > 0) {
                // --- Append to displayedImages ---
                const updatedDisplayedImages = [...displayedImages, ...nextBatchWithUrls];
                setDisplayedImages(updatedDisplayedImages);

                // --- Update the ref for cleanup tracking ---
                // Store the *complete* new list including the appended items
                prevDisplayedImagesRef.current = updatedDisplayedImages;

                setHasMore(updatedDisplayedImages.length < filteredImageSource.length);
            } else {
                setHasMore(false);
            }
            setIsLoadingMore(false);
        }, 500);
    }, [isLoadingMore, isProcessingFiles, hasMore, displayedImages, filteredImageSource]); // Need displayedImages here for append

    // Scroll Handling Effect (triggers loadMoreImages)
    useEffect(() => {
        debouncedLoadMoreRef.current = debounce(loadMoreImages, 300);
        const handleScroll = () => {
            const isNearBottom = window.innerHeight + window.scrollY >= document.documentElement.offsetHeight - SCROLL_BUFFER;
            if (isNearBottom && hasMore && !isLoadingMore && !isProcessingFiles) {
                debouncedLoadMoreRef.current();
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (debouncedLoadMoreRef.current?.cancel) debouncedLoadMoreRef.current.cancel();
        };
    }, [hasMore, isLoadingMore, isProcessingFiles, loadMoreImages]);


    // --- Directory Selection Handler ---
    const handleFileSelect = (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsProcessingFiles(true);
        console.log(`[Input] Received ${files.length} file system entries (incl. subdirs).`);

        const firstFile = files[0];
        let basePathHint = '';
        if (firstFile?.webkitRelativePath && firstFile.webkitRelativePath !== firstFile.name) {
            const pathParts = firstFile.webkitRelativePath.split('/');
            if (pathParts.length > 1) basePathHint = pathParts[0];
        }
        if (!basePathHint) basePathHint = `selection_${Date.now()}`;
        // console.log(`[Input] Using BasePathHint: "${basePathHint}"`);

        const imageFilesOnly = Array.from(files).filter(isImageFile);
        // console.log(`[Filter] Found ${imageFilesOnly.length} potential image files.`);

        if (imageFilesOnly.length === 0) {
             setIsProcessingFiles(false); event.target.value = null; return;
        }

        // --- Process files but store only id and fileHandle ---
        const newImageObjectsRaw = imageFilesOnly.map(file => {
            const id = generateImageId(file, basePathHint);
            return { id, fileHandle: file }; // Store raw file data
        });
        // console.log(`[Process] Processed ${newImageObjectsRaw.length} image files into raw objects.`);


        setUserImages(prevImages => { // Append strategy
            const existingIds = new Set(prevImages.map(img => img.id));
            const addedImages = [];
            newImageObjectsRaw.forEach(newImgData => {
                if (!existingIds.has(newImgData.id)) {
                    addedImages.push(newImgData);
                    existingIds.add(newImgData.id);
                } else {
                     console.warn(`[State Update] Skipping duplicate ID: ${newImgData.id}`);
                    // No URL to revoke here
                }
            });
             // console.log(`[State Update] Appending ${addedImages.length} new unique raw image data objects.`);
            return addedImages.length > 0 ? [...prevImages, ...addedImages] : prevImages;
        });

        // Setting userImages triggers filter effect -> display effect (handles URL generation)
        // Only need to manage the processing state here
        setIsProcessingFiles(false); // Set processing false *after* state update initiated
        event.target.value = null; // Clear input
    };

    // --- Clear User Images Handler ---
     const clearUserImages = () => {
         // Revoke URLs currently held in the ref *before* clearing state
         // This prevents the display effect trying to revoke on an empty ref later
         console.log(`[Clear] Revoking ${prevDisplayedImagesRef.current.length} URLs before clearing state.`);
         prevDisplayedImagesRef.current.forEach(img => revokeBlobUrl(img.src));
         prevDisplayedImagesRef.current = []; // Clear the ref

         // Now clear the core data state
         setUserImages([]); // This triggers filter -> display effect, which will now find 0 images
         setSearchTerm('');
         // Reset selection state as well
         setSelectedImage(null);
         setCurrentImageIndex(null);
         console.log("Cleared user images state.");
     };


    // --- Other Handlers ---
    const triggerFileSelect = () => fileInputRef.current?.click();

    const handleImageClick = (image) => { // image received here should have {id, fileHandle, src}
        const index = displayedImages.findIndex(img => img.id === image.id);
        setSelectedImage(image); // Pass the full object with src
        setCurrentImageIndex(index !== -1 ? index : null);
    };

    const handleCloseFullScreen = () => {
        setSelectedImage(null);
        setCurrentImageIndex(null);
    };

    const handleNavigate = (direction) => {
        if (currentImageIndex === null) { // Can't navigate if index is unknown
            // Maybe try to find the selectedImage in the current batch again?
             const idx = displayedImages.findIndex(img => img.id === selectedImage?.id);
             if (idx === -1) return; // Still not found, can't navigate
             setCurrentImageIndex(idx); // Found it, update index
             // Now proceed with navigation from the corrected index
             const newIndex = idx + direction;
             if (newIndex >= 0 && newIndex < displayedImages.length) {
                setSelectedImage(displayedImages[newIndex]);
                setCurrentImageIndex(newIndex);
             }
             return;
        }

        // Normal navigation if index is valid
        const newIndex = currentImageIndex + direction;
        if (newIndex >= 0 && newIndex < displayedImages.length) {
            setSelectedImage(displayedImages[newIndex]);
            setCurrentImageIndex(newIndex);
        }
    };

    const toggleDarkMode = () => setIsDarkMode(prev => !prev);

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: animationsEnabled ? 'smooth' : 'auto'
        });
    };

    const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
    };

    const toggleAnimations = () => {
        setAnimationsEnabled(prev => !prev);
    };

    // Combined busy state for UI feedback (e.g., disabling buttons)
    const isBusy = isProcessingFiles || isLoadingMore;

    // --- Render ---
    return (
        <div className="App">
            {/* Directory Controls */}
            <div className="directory-controls">
                <button onClick={triggerFileSelect} disabled={isBusy} className="action-button">
                    {isProcessingFiles ? 'Processing...' : 'Add Image Directory'}
                </button>
                {userImages.length > 0 && (
                    <button onClick={clearUserImages} disabled={isBusy} className="action-button clear-button">
                        Clear Loaded Images ({userImages.length})
                    </button>
                )}
                {/* Hidden input for directory selection */}
                <input
                    type="file"
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={handleFileSelect}
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*" // browser hint
                />
            </div>

            {/* Title */}
            <h1>My Image Gallery</h1>

            {/* Search Input */}
            {userImages.length > 0 && (
                <div className="search-container">
                    <input
                        type="text"
                        placeholder={`Search ${userImages.length} loaded images...`}
                        value={searchTerm}
                        onChange={handleSearchChange}
                        className="search-input"
                        disabled={isBusy} // Disable during processing/loading
                    />
                </div>
            )}

            {/* Initial Message */}
            {userImages.length === 0 && !isProcessingFiles && (
                <p className="no-results">Add a directory containing images to begin.</p>
            )}

            {/* Image Grid - receives images with {id, fileHandle, src} */}
            <ImageGrid images={displayedImages} onImageClick={handleImageClick} />

            {/* Infinite Scroll Loader */}
            {isLoadingMore && <InfiniteScrollLoader />}

            {/* End/No Results Indicators */}
            {!isBusy && !hasMore && displayedImages.length > 0 && filteredImageSource.length > 0 && (
                <p className="all-loaded-indicator">All {filteredImageSource.length} matching images shown.</p>
            )}
             {!isBusy && userImages.length > 0 && searchTerm && filteredImageSource.length === 0 && (
                 <p className="no-results">No images found matching "{searchTerm}" in the loaded directories.</p>
             )}
            {/* Message for when images loaded but none match initial (empty) search - should be rare */}
             {!isBusy && userImages.length > 0 && displayedImages.length === 0 && !searchTerm && (
                 <p className="no-results">No images to display (check source or filter).</p>
             )}


            {/* Full Screen Modal - receives image with {id, fileHandle, src} */}
            {selectedImage && (
                <FullScreenImage
                    key={selectedImage.src || selectedImage.id} // Use src if available, fallback id
                    image={selectedImage} // Pass the object including src
                    currentIndex={currentImageIndex} // Pass index, navigation handles null check
                    images={displayedImages} // Pass the current batch with URLs
                    onClose={handleCloseFullScreen}
                    onNavigate={handleNavigate}
                />
            )}

            {/* Floating Action Buttons */}
            <FloatingActions
                isDarkMode={isDarkMode}
                toggleDarkMode={toggleDarkMode}
                showScrollTop={showScrollTop}
                scrollToTop={scrollToTop}
                animationsEnabled={animationsEnabled}
                toggleAnimations={toggleAnimations}
            />
        </div>
    );
}

export default App;