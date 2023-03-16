import React from 'react';
import { ConfirmDialog } from 'primereact/confirmdialog';
import "primeicons/primeicons.css";
// import './DialogComponent.scss';

const DialogComponent = ({
  message,
  headerTitle="Confirmation Dialog",
  onSubmit = () => null,
  visible = false,
  children
}) => {

  return (
    <div className='common-dialog'>
      <ConfirmDialog
        className='common-dialog'
        header={headerTitle}
        message={message}
        onClick={onSubmit}
        visible={visible}
        draggable="true"
        modal="false"
      >
        {children}
      </ConfirmDialog>
    </div>
  )
};

export default DialogComponent;