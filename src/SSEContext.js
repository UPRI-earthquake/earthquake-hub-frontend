import React from 'react';

/**
 * React context for sharing the EventSource instance between components.
 */
const SSEContext = React.createContext({ eventSource: null });

export default SSEContext;
