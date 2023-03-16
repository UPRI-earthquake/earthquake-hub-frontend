import React from 'react';
import { Dialog } from 'primereact/dialog';

import "primeicons/primeicons.css";
import './ModalComponent.scss';

const ModalComponent = ({ headerTitle = "", visible = false, setVisible, children }) => {

  return (
    <Dialog
      className="common-modal"
      header={headerTitle}
      visible={visible}
      onHide={() => setVisible(false)}
      draggable={false}
    >
      {children}
    </Dialog>
  )
};

export default ModalComponent;