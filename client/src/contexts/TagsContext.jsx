import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { tagsApi } from '../services/api';
import { useToast } from './ToastContext';

const TagsContext = createContext();

export const useTags = () => useContext(TagsContext);

// Module-level ref so NotesContext socket handlers can read the current value
// without subscribing to TagsContext (which would cause mass re-renders).
export const pickerNoteIdRef = { current: null };

export const TagsProvider = ({ children }) => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [hiddenTagIds, setHiddenTagIds] = useState(new Set());
  const [pickerOpenForNoteId, _setPickerOpenForNoteId] = useState(null);

  const setPickerOpenForNoteId = useCallback((noteId) => {
    pickerNoteIdRef.current = noteId;
    _setPickerOpenForNoteId(noteId);
  }, []);

  const { showToast } = useToast();

  // Load all tags
  const loadTags = useCallback(async ({ silent = false } = {}) => {
    // Only flip loading=true on initial load. Background refreshes (e.g. after
    // a note change) must not toggle loading, or consumers gated on
    // `tagsLoading` (QuickAccess pinned folders, etc.) flicker empty for a
    // frame and shift the layout.
    if (!silent) setLoading(true);
    try {
      const response = await tagsApi.getAllTags();
      
      // Initialize hiddenTagIds based on tag visibility in database
      const initialHiddenTagIds = new Set();
      
      // Log each tag's visibility
      response.tags.forEach(tag => {
        //console.log(`Loaded tag ${tag.id} (${tag.name}) with visibility:`, tag.visible);
        
        // Add hidden tags to the set
        if (tag.visible === false) {
          console.log(`Tag ${tag.name} is hidden (visible = false)`);
          initialHiddenTagIds.add(tag.id);
        }
      });
      
      // Update the hidden tags set
      setHiddenTagIds(initialHiddenTagIds);
      console.log(`Initialized ${initialHiddenTagIds.size} hidden tags`);
      
      // Update tags state
      setTags(response.tags);
      setError(null);
    } catch (err) {
      setError('Failed to load tags');
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Create a new tag. Pass { silent: true } to suppress the default toast when
  // the caller shows its own (e.g. folders/subfolders).
  const createTag = async (name, visible = true, isFolder = false, parentId = null, { silent = false } = {}) => {
    try {
      const response = await tagsApi.createTag(name, visible, isFolder, parentId);
      
      // Use the same deduplication logic from handleTagCreated
      setTags(prevTags => {
        // Check if the tag already exists by ID
        const exists = prevTags.some(t => t.id === response.tag.id);
        
        if (exists) {
          console.log(`createTag: Tag ${response.tag.id} already exists in state, updating it`);
          // Replace with new version
          return prevTags.map(t => t.id === response.tag.id ? response.tag : t);
        } else {
          console.log(`createTag: Adding new tag ${response.tag.id} to state`);
          // Add new tag
          return [...prevTags, response.tag];
        }
      });
      
      await loadTags({ silent: true });

      // Show success toast (unless the caller will show its own)
      if (!silent) {
        showToast(response.tag.is_folder ? `Folder ${response.tag.name} created` : `Tag #${response.tag.name} created`);
      }

      // Log successful creation
      console.log('Tag created successfully:', response.tag);
      return response.tag;
    } catch (err) {
      // Check if this is a duplicate tag error (status 400)
      if (err.response && err.response.status === 400 && err.response.data.tag) {
        // Tag already exists - return the existing tag from the error
        console.log('Tag already exists, returning existing tag:', err.response.data.tag);
        
        // Very important: Update the state with this existing tag
        // This ensures QuickAccess and other components know about it
        setTags(prevTags => {
          // Check if we already have this tag in state
          const exists = prevTags.some(t => t.id === err.response.data.tag.id);
          
          if (!exists) {
            console.log(`Adding existing tag ${err.response.data.tag.id} to state`);
            return [...prevTags, err.response.data.tag];
          }
          return prevTags;
        });
        
        return err.response.data.tag;
      }
      setError('Failed to create tag');
      console.error(err);
      return null;
    }
  };

  // Update a tag
  const updateTag = async (id, updates) => {
    try {
      const response = await tagsApi.updateTag(id, updates);
      setTags(prevTags => 
        prevTags.map(tag => tag.id === id ? response.tag : tag)
      );
      await loadTags({ silent: true });
      return response.tag;
    } catch (err) {
      setError('Failed to update tag');
      console.error(err);
      return null;
    }
  };

  // Rename a tag
  const renameTag = async (id, name) => {
    return await updateTag(id, { name });
  };

  // Toggle tag visibility
  const toggleTagVisibility = async (id, visible) => {
    try {
      const response = await tagsApi.toggleTagVisibility(id, visible);
      setTags(prevTags =>
        prevTags.map(tag => tag.id === id ? { ...tag, ...response.tag } : tag)
      );
      await loadTags({ silent: true });
      return response.tag;
    } catch (err) {
      setError('Failed to toggle tag visibility');
      console.error(err);
      return null;
    }
  };

  // Delete a tag. Pass { silent: true } to suppress the default toast (e.g. when
  // a folder caller shows its own "Folder and N notes deleted" message).
  // Returns { success, deletedNotesCount } so callers can report the note count.
  const deleteTag = async (id, options = {}) => {
    const { silent = false } = options;
    try {
      // Get the tag name before deleting for the toast
      const tagToDelete = tags.find(tag => tag.id === id);
      const tagName = tagToDelete ? tagToDelete.name : '';

      const result = await tagsApi.deleteTag(id, options);
      setTags(prevTags => prevTags.filter(tag => tag.id !== id));
      await loadTags({ silent: true });

      // Show success toast (unless the caller will show its own)
      if (tagName && !silent) {
        showToast(tagToDelete?.is_folder ? `Folder ${tagName} deleted` : `Tag #${tagName} deleted`);
      }

      return { success: true, deletedNotesCount: result?.deletedNotesCount ?? 0 };
    } catch (err) {
      setError('Failed to delete tag');
      console.error(err);
      return { success: false, deletedNotesCount: 0 };
    }
  };

  // Get visible tags
  const getVisibleTags = useCallback(() => {
    return tags.filter(tag => !hiddenTagIds.has(tag.id));
  }, [tags, hiddenTagIds]);
  
  // Check if a tag is hidden
  const isTagHidden = useCallback((tagId) => {
    return hiddenTagIds.has(tagId);
  }, [hiddenTagIds]);
  
  // Toggle tag hidden state
  const toggleTagHidden = (tagId) => {
    setHiddenTagIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
        console.log(`Showing tag ${tagId}`);
      } else {
        newSet.add(tagId);
        console.log(`Hiding tag ${tagId}`);
      }
      return newSet;
    });
  };

  // Initial load of tags
  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // Refresh tags after note changes via API so the UI updates without socket.
  useEffect(() => {
    const refreshTagsFromApi = () => {
      loadTags({ silent: true });
    };

    refreshTagsFromApi();
    return () => {};
  }, [loadTags]);

  // Toggle modal visibility
  const toggleTagsModal = () => {
    setShowTagsModal(prevState => !prevState);
  };

  const value = {
    tags,
    loading,
    error,
    loadTags,
    createTag,
    updateTag,
    renameTag,
    toggleTagVisibility, // For API calls
    toggleTagHidden,     // For in-memory state
    deleteTag,
    getVisibleTags,
    isTagHidden,
    hiddenTagIds,
    pickerOpenForNoteId,
    setPickerOpenForNoteId,
    showTagsModal,
    toggleTagsModal,
    setShowTagsModal
  };

  return (
    <TagsContext.Provider value={value}>
      {children}
    </TagsContext.Provider>
  );
};

export default TagsContext;