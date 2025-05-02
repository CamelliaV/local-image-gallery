// src/App.js
import React, { useState, useEffect, useCallback, useRef } from 'react'
import ImageGrid from './components/ImageGrid'
import FullScreenImage from './components/FullScreenImage'
import FloatingActions from './components/FloatingActions'
import InfiniteScrollLoader from './components/InfiniteScrollLoader'
import { debounce } from './utils/debounce'
// --- DND Imports ---
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy
} from '@dnd-kit/sortable'
import './App.css'
// --- End DND Imports ---
// --- Icons ---
const SettingsIcon = () => (
  <span title="Settings" style={{ fontSize: '1.5em', cursor: 'pointer' }}>
    ⚙️
  </span>
)
// --- End Icons ---

const BATCH_SIZE = 15
const SCROLL_BUFFER = 300
const SCROLL_TOP_VISIBILITY_THRESHOLD = 300

// Helper: Check if file is an image
const isImageFile = file => file && file.type && file.type.startsWith('image/')

// Helper: Generate unique ID for directory selections
const generateImageId = (file, basePathHint = '') => {
  const relativePath =
    file.webkitRelativePath && file.webkitRelativePath.trim() !== ''
      ? file.webkitRelativePath
      : file.name
  let combinedPath
  if (basePathHint && !relativePath.startsWith(basePathHint + '/')) {
    combinedPath = `${basePathHint}/${relativePath}`.replace('//', '/')
  } else {
    combinedPath = relativePath
  }
  const finalId = combinedPath.replace(/\\/g, '/') // Normalize slashes
  return finalId
}

// Helper: Create Blob URL
const createBlobUrl = file => {
  if (file instanceof File) {
    try {
      return URL.createObjectURL(file)
    } catch (error) {
      console.error('Error creating blob URL:', error, 'for file:', file.name)
      return null
    }
  }
  console.warn('Attempted to create blob URL for non-File object:', file)
  return null
}

// Helper: Revoke Blob URL
const revokeBlobUrl = url => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
    // console.log(`Revoked URL: ${url.substring(url.length - 10)}`);
  }
}

function App() {
  // --- State ---
  const [userImages, setUserImages] = useState([]) // { id, fileHandle }
  const [selectedImage, setSelectedImage] = useState(null) // { id, fileHandle, src? }
  const [currentImageIndex, setCurrentImageIndex] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [displayedImages, setDisplayedImages] = useState([]) // { id, fileHandle, src }
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [filteredImageSource, setFilteredImageSource] = useState([]) // { id, fileHandle }
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode')
    return savedMode ? JSON.parse(savedMode) : false
  })
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [animationsEnabled, setAnimationsEnabled] = useState(() => {
    const saved = localStorage.getItem('animationsEnabled')
    return saved !== null ? JSON.parse(saved) : true // Default true
  })
  const [activeDragId, setActiveDragId] = useState(null)
  // --- Settings State ---
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false)
  const [showRemoveButton, setShowRemoveButton] = useState(() => {
    // Setting for remove button visibility
    const saved = localStorage.getItem('showRemoveButton')
    return saved ? JSON.parse(saved) : true // Default shown
  })

  // --- Refs ---
  const debouncedLoadMoreRef = useRef()
  const debouncedScrollCheckRef = useRef()
  const fileInputRef = useRef(null)
  const prevDisplayedImagesRef = useRef([])
  const settingsButtonRef = useRef(null)
  const settingsDropdownRef = useRef(null)

  // --- Effects ---

  // Dark Mode Effect
  useEffect(() => {
    if (isDarkMode) document.body.classList.add('dark-mode')
    else document.body.classList.remove('dark-mode')
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode))
  }, [isDarkMode])

  // Scroll Top Visibility Effect
  useEffect(() => {
    const checkScrollTop = () =>
      setShowScrollTop(window.scrollY > SCROLL_TOP_VISIBILITY_THRESHOLD)
    debouncedScrollCheckRef.current = debounce(checkScrollTop, 150)
    window.addEventListener('scroll', debouncedScrollCheckRef.current)
    checkScrollTop() // Initial check
    return () => {
      window.removeEventListener('scroll', debouncedScrollCheckRef.current)
      if (debouncedScrollCheckRef.current?.cancel)
        debouncedScrollCheckRef.current.cancel()
    }
  }, [])

  // Animation Enable/Disable Effect
  useEffect(() => {
    if (animationsEnabled) {
      document.body.classList.add('animations-enabled')
    } else {
      document.body.classList.remove('animations-enabled')
    }
    localStorage.setItem('animationsEnabled', JSON.stringify(animationsEnabled))
  }, [animationsEnabled])

  // Filtering Effect (userImages or searchTerm change -> update filteredImageSource)
  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim()
    const filtered = !lowerCaseSearchTerm
      ? userImages
      : userImages.filter(image =>
          image.id.toLowerCase().includes(lowerCaseSearchTerm)
        )
    setFilteredImageSource(filtered)
  }, [searchTerm, userImages]) // Depends on userImages for source and order

  // Display Batch Effect & URL Management
  // (filteredImageSource changes -> update displayedImages with fresh Blob URLs & clean up old ones)
  useEffect(() => {
    const previousBatch = prevDisplayedImagesRef.current
    previousBatch.forEach(img => revokeBlobUrl(img.src))

    const newBatchRaw = filteredImageSource.slice(0, BATCH_SIZE)
    const newBatchWithUrls = newBatchRaw
      .map(imgData => ({
        ...imgData,
        src: createBlobUrl(imgData.fileHandle)
      }))
      .filter(img => img.src !== null)

    setDisplayedImages(newBatchWithUrls)
    setHasMore(filteredImageSource.length > BATCH_SIZE)
    prevDisplayedImagesRef.current = newBatchWithUrls // Store current batch for next cleanup
    setIsLoadingMore(false) // Ensure loading more stops if filter changes
  }, [filteredImageSource]) // This effect depends ONLY on the filtered source changing

  // Load More Images Function
  const loadMoreImages = useCallback(() => {
    if (isLoadingMore || isProcessingFiles || !hasMore) return
    const currentLength = displayedImages.length
    if (currentLength >= filteredImageSource.length) {
      setHasMore(false)
      return
    }
    setIsLoadingMore(true)

    setTimeout(() => {
      const nextBatchRaw = filteredImageSource.slice(
        currentLength,
        currentLength + BATCH_SIZE
      )
      const nextBatchWithUrls = nextBatchRaw
        .map(imgData => ({
          ...imgData,
          src: createBlobUrl(imgData.fileHandle)
        }))
        .filter(img => img.src !== null)

      if (nextBatchWithUrls.length > 0) {
        const updatedDisplayedImages = [
          ...displayedImages,
          ...nextBatchWithUrls
        ]
        setDisplayedImages(updatedDisplayedImages)
        prevDisplayedImagesRef.current = updatedDisplayedImages // Update ref with full list
        setHasMore(updatedDisplayedImages.length < filteredImageSource.length)
      } else {
        setHasMore(false)
      }
      setIsLoadingMore(false)
    }, 500)
  }, [
    isLoadingMore,
    isProcessingFiles,
    hasMore,
    displayedImages,
    filteredImageSource
  ])

  // Scroll Handling Effect (triggers loadMoreImages)
  useEffect(() => {
    debouncedLoadMoreRef.current = debounce(loadMoreImages, 300)
    const handleScroll = () => {
      const isNearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.offsetHeight - SCROLL_BUFFER
      if (isNearBottom && hasMore && !isLoadingMore && !isProcessingFiles) {
        debouncedLoadMoreRef.current()
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (debouncedLoadMoreRef.current?.cancel)
        debouncedLoadMoreRef.current.cancel()
    }
  }, [hasMore, isLoadingMore, isProcessingFiles, loadMoreImages])

  // Save remove button preference to localStorage
  useEffect(() => {
    localStorage.setItem('showRemoveButton', JSON.stringify(showRemoveButton))
  }, [showRemoveButton])

  // Close settings dropdown if clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
      if (
        showSettingsDropdown &&
        settingsButtonRef.current &&
        !settingsButtonRef.current.contains(event.target) &&
        settingsDropdownRef.current &&
        !settingsDropdownRef.current.contains(event.target)
      ) {
        setShowSettingsDropdown(false)
      }
    }
    if (showSettingsDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      document.removeEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSettingsDropdown])

  // --- Directory Selection Handler (Using webkitdirectory) ---
  const handleFileSelect = event => {
    const files = event.target.files
    if (!files || files.length === 0) return
    setIsProcessingFiles(true)
    // console.log(`[Input] Received ${files.length} file system entries (incl. subdirs).`);
    const firstFile = files[0]
    let basePathHint = ''
    if (
      firstFile?.webkitRelativePath &&
      firstFile.webkitRelativePath !== firstFile.name
    ) {
      const pathParts = firstFile.webkitRelativePath.split('/')
      if (pathParts.length > 1) basePathHint = pathParts[0]
    }
    if (!basePathHint) basePathHint = `selection_${Date.now()}`
    const imageFilesOnly = Array.from(files).filter(isImageFile)
    if (imageFilesOnly.length === 0) {
      setIsProcessingFiles(false)
      event.target.value = null
      return
    }
    const newImageObjectsRaw = imageFilesOnly.map(file => ({
      id: generateImageId(file, basePathHint),
      fileHandle: file
    }))
    setUserImages(prevImages => {
      // Append strategy
      const existingIds = new Set(prevImages.map(img => img.id))
      const addedImages = []
      newImageObjectsRaw.forEach(newImgData => {
        if (!existingIds.has(newImgData.id)) {
          addedImages.push(newImgData)
          existingIds.add(newImgData.id)
        } else {
          console.warn(`[State Update] Skipping duplicate ID: ${newImgData.id}`)
        }
      })
      return addedImages.length > 0
        ? [...prevImages, ...addedImages]
        : prevImages
    })
    setIsProcessingFiles(false)
    event.target.value = null
  }

  // --- Clear User Images Handler ---
  const clearUserImages = () => {
    prevDisplayedImagesRef.current.forEach(img => revokeBlobUrl(img.src))
    prevDisplayedImagesRef.current = []
    setUserImages([])
    setSearchTerm('')
    setSelectedImage(null)
    setCurrentImageIndex(null)
  }

  // --- DND Setup ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor)
  )
  // No need for useDroppable for dustbin anymore

  // DND Event Handlers
  const handleDragStart = event => {
    setActiveDragId(event.active.id)
    document.body.classList.add('dragging-active')
  }

  const handleDragEnd = event => {
    const { active, over } = event
    setActiveDragId(null)
    document.body.classList.remove('dragging-active')

    if (!over) {
      return
    } // Dropped outside

    // Handle Reordering (check if dropped over a *different* sortable item)
    if (active.id !== over.id && userImages.some(img => img.id === over.id)) {
      setUserImages(currentImages => {
        const oldIndex = currentImages.findIndex(img => img.id === active.id)
        const newIndex = currentImages.findIndex(img => img.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return currentImages
        return arrayMove(currentImages, oldIndex, newIndex)
      })
    }
  }

  const handleDragCancel = () => {
    setActiveDragId(null)
    document.body.classList.remove('dragging-active')
  }

  // Get data for drag overlay preview
  const getDraggedImage = () => {
    if (!activeDragId) return null
    const rawImageData = userImages.find(img => img.id === activeDragId)
    if (!rawImageData) return null
    return { ...rawImageData, src: createBlobUrl(rawImageData.fileHandle) }
  }
  const draggedImageForOverlay = getDraggedImage() // Prepare data for overlay

  // --- Image Removal Handler (Passed to ImageCard) ---
  const handleRemoveImage = useCallback(idToRemove => {
    // Optional: Add confirmation dialog based on a setting if desired
    // if (confirm(`Remove image "${idToRemove}" from the list?`)) { ... }

    console.log(`[Remove] Request to remove image: ${idToRemove}`)
    setUserImages(currentImages =>
      currentImages.filter(img => img.id !== idToRemove)
    )

    // The change to userImages triggers filter -> display effects,
    // which implicitly handles revoking the blob URL for the removed image.
  }, []) // Empty dependency array is fine here

  // --- Other Handlers ---
  const triggerFileSelect = () => fileInputRef.current?.click()
  const handleImageClick = image => {
    const index = displayedImages.findIndex(img => img.id === image.id)
    setSelectedImage(image)
    setCurrentImageIndex(index !== -1 ? index : null)
  }
  const handleCloseFullScreen = () => {
    setSelectedImage(null)
    setCurrentImageIndex(null)
  }
  const handleNavigate = direction => {
    let currentValidIndex = currentImageIndex
    if (currentValidIndex === null && selectedImage) {
      currentValidIndex = displayedImages.findIndex(
        img => img.id === selectedImage.id
      )
      if (currentValidIndex === -1) return
      setCurrentImageIndex(currentValidIndex)
    } else if (currentValidIndex === null) {
      return
    }
    const newIndex = currentValidIndex + direction
    if (newIndex >= 0 && newIndex < displayedImages.length) {
      setSelectedImage(displayedImages[newIndex])
      setCurrentImageIndex(newIndex)
    }
  }
  const toggleDarkMode = () => setIsDarkMode(prev => !prev)
  const scrollToTop = () =>
    window.scrollTo({ top: 0, behavior: animationsEnabled ? 'smooth' : 'auto' })
  const handleSearchChange = event => setSearchTerm(event.target.value)
  const toggleAnimations = () => setAnimationsEnabled(prev => !prev)

  // --- Settings Handlers ---
  const toggleSettings = e => {
    e.stopPropagation()
    setShowSettingsDropdown(prev => !prev)
  }
  const handleRemoveButtonToggle = () => {
    // Toggles visibility of remove button on cards
    setShowRemoveButton(prev => !prev)
    setShowSettingsDropdown(false) // Close dropdown
  }

  // Combined busy state
  const isBusy = isProcessingFiles || isLoadingMore

  // --- Render ---
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="App">
        {/* --- Top Bar Area --- */}
        <div className="top-bar">
          <div className="directory-controls">
            <button
              onClick={triggerFileSelect}
              disabled={isBusy}
              className="action-button"
            >
              {isProcessingFiles ? 'Processing...' : 'Add Image Directory'}
            </button>
            {userImages.length > 0 && (
              <button
                onClick={clearUserImages}
                disabled={isBusy}
                className="action-button clear-button"
              >
                Clear Images ({userImages.length})
              </button>
            )}
            {/* Corrected Input for Directory Selection */}
            <input
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFileSelect}
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
            />
          </div>
          {/* --- Settings Button & Dropdown --- */}
          <div className="settings-container" ref={settingsButtonRef}>
            <button
              onClick={toggleSettings}
              className="settings-button"
              aria-label="Settings"
            >
              <SettingsIcon />
            </button>
            {showSettingsDropdown && (
              <div
                className="settings-dropdown"
                ref={settingsDropdownRef}
                onClick={e => e.stopPropagation()}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={showRemoveButton}
                    onChange={handleRemoveButtonToggle}
                  />
                  Show Remove Button
                </label>
                {/* Add more settings later */}
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <h1>My Image Gallery</h1>

        {/* Search Input */}
        {userImages.length > 0 && (
          <div className="search-container">
            <input
              type="text"
              placeholder={`Search ${userImages.length}...`}
              value={searchTerm}
              onChange={handleSearchChange}
              className="search-input"
              disabled={isBusy}
            />
          </div>
        )}

        {/* Initial Message */}
        {userImages.length === 0 && !isProcessingFiles && (
          <p className="no-results">Add a directory to begin.</p>
        )}

        {/* --- Image Grid --- */}
        <SortableContext
          items={displayedImages.map(img => img.id)}
          strategy={rectSortingStrategy}
        >
          <ImageGrid
            images={displayedImages}
            onImageClick={handleImageClick}
            activeDragId={activeDragId}
            onRemoveImage={handleRemoveImage} // Pass remove handler
            showRemoveButton={showRemoveButton} // Pass setting state
          />
        </SortableContext>

        {/* Infinite Scroll Loader */}
        {isLoadingMore && <InfiniteScrollLoader />}

        {/* End/No Results Indicators */}
        {!isBusy &&
          !hasMore &&
          displayedImages.length > 0 &&
          filteredImageSource.length > 0 && (
            <p className="all-loaded-indicator">
              All {filteredImageSource.length} images shown.
            </p>
          )}
        {!isBusy &&
          userImages.length > 0 &&
          searchTerm &&
          filteredImageSource.length === 0 && (
            <p className="no-results">
              No images found matching "{searchTerm}"...
            </p>
          )}

        {/* Full Screen Modal */}
        {selectedImage && (
          <FullScreenImage
            key={selectedImage.src || selectedImage.id}
            image={selectedImage}
            currentIndex={currentImageIndex}
            images={displayedImages}
            onClose={handleCloseFullScreen}
            onNavigate={handleNavigate}
          />
        )}

        {/* Floating Action Buttons (No dustbin props needed) */}
        <FloatingActions
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          showScrollTop={showScrollTop}
          scrollToTop={scrollToTop}
          animationsEnabled={animationsEnabled}
          toggleAnimations={toggleAnimations}
        />

        {/* DND Drag Overlay for Preview */}
        <DragOverlay dropAnimation={null}>
          {activeDragId && draggedImageForOverlay ? (
            <div className="image-card-overlay-preview">
              <img
                src={draggedImageForOverlay.src}
                alt={draggedImageForOverlay.id}
                // Simple cleanup for overlay URL when it disappears
                // Note: If drag ends abruptly, this might not fire.
                // A dedicated effect tracking the overlay URL would be more robust.
                onLoad={() => {
                  /* Can track URL here if needed */
                }}
                onError={() => console.error('Overlay image failed')}
                ref={node => {
                  // Attempt to revoke when node is removed (imperfect)
                  // if (!node && draggedImageForOverlay?.src) {
                  //    revokeBlobUrl(draggedImageForOverlay.src);
                  // }
                }}
              />
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}

export default App
