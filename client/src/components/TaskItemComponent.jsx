import React from 'react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import styled from 'styled-components'
import SVGCheckboxCircle from './SVGCheckboxCircle'
import Icon from './Icons'

const DeleteTaskButton = styled.button`
  display: inline-flex;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: -2px 0 0 4px;
  padding: 0;
  color: var(--text-color-secondary);
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0.65;

  &:hover,
  &:focus-visible {
    color: var(--error-color, #c23b3b);
    background: var(--button-hover-color);
    opacity: 1;
  }

  &:focus-visible {
    outline: 2px solid var(--foreground-color);
    outline-offset: 1px;
  }
`;

const TaskItemComponent = ({ node, updateAttributes, editor, deleteNode }) => {
  const handleChange = (checked) => {
    // Prevent the editor from gaining focus during this operation
    const wasFocused = editor?.isFocused || false;
    
    // Temporarily disable focus events on the editor
    if (editor?.view?.dom) {
      const originalTabIndex = editor.view.dom.tabIndex;
      editor.view.dom.tabIndex = -1;
      
      // Update attributes
      updateAttributes({ checked });
      
      // Restore the original tabIndex and blur if it wasn't focused before
      setTimeout(() => {
        if (editor?.view?.dom) {
          editor.view.dom.tabIndex = originalTabIndex;
          
          // If editor wasn't focused before and is now focused, blur it
          if (!wasFocused && editor.isFocused) {
            editor.commands.blur();
          }
        }
      }, 0);
    } else {
      // Fallback if we can't access the DOM
      updateAttributes({ checked });
    }
  }
  return (
    <NodeViewWrapper
      as="li"
      data-type="taskItem"
      data-checked={node.attrs.checked}
      style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ flex: '0 0 auto', marginTop: '-2px' }}>
          <SVGCheckboxCircle
            checked={node.attrs.checked}
            onChange={handleChange}
            id={`task-${Date.now()}-${Math.random()}`}
            label=""
          />
        </div>
        <NodeViewContent
          as="div"
          style={{
            flex: '1 1 0%',
            minWidth: 0,
            minHeight: '1.2em',
            marginLeft: '4px',
            lineHeight: 1.3,
            cursor: 'text',
            textDecoration: node.attrs.checked ? 'line-through' : 'none',
            opacity: 1,
            transition: 'opacity 0.2s ease, text-decoration 0.2s ease',
          }}
        />
        <DeleteTaskButton
          type="button"
          aria-label="Delete checklist item"
          title="Delete checklist item"
          contentEditable={false}
          style={{ marginTop: '-2px' }}
          onMouseDown={event => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            deleteNode();
          }}
        >
          <Icon name="trash" size={16} />
        </DeleteTaskButton>
      </div>
    </NodeViewWrapper>
  )
}

export default TaskItemComponent
