import React from 'react';
import { Card } from 'primereact/card';

import './CardComponent.scss';

const CardComponent = ({ cardTitle = "", children }) => {
  return (
    <div className='common-card'>
      <Card title={cardTitle} >
        {children}
      </Card>
    </div>
  )
};

export default CardComponent;