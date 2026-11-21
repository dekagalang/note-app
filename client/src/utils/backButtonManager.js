import { useEffect, useRef } from 'react';

const handlers = new Map();
let nextHandlerId = 0;

export const backButtonManager = {
  register(handler, priority = 0) {
    const id = ++nextHandlerId;
    handlers.set(id, { handler, priority, order: id });
    return () => handlers.delete(id);
  },

  handleBackButton() {
    const orderedHandlers = [...handlers.values()].sort(
      (left, right) => right.priority - left.priority || right.order - left.order,
    );

    for (const { handler } of orderedHandlers) {
      try {
        if (handler() === true) return true;
      } catch (error) {
        console.error('[BackButtonManager] Handler failed:', error);
      }
    }

    return false;
  },
};

export const useBackButtonHandler = (active, handler, priority = 0) => {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return undefined;
    return backButtonManager.register(() => handlerRef.current(), priority);
  }, [active, priority]);
};