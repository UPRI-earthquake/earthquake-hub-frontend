import React from 'react';
import './LeftSidebarComponent.scss';

const LeftSidebarComponent = ({ children }) => {
  return (
    <div className='common-sidebar'>
      {children}
    </div>
  )
};

export default LeftSidebarComponent;